import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Patient } from 'fhir/r4b';
import { getRelatedPersonsForPatient } from 'utils/lib/auth/user-auth.helper';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY } from 'utils/lib/types/api/invoicing.types';
import { FHIR_RESOURCE_NOT_FOUND, RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { sendSmsToRelatedPersons } from '../../shared/communication';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { SendBillingInvoiceSmsParams, validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = SEND_BILLING_INVOICE_SMS_ZAMBDA_KEY;

// Keep invoice SMS in the patient's EHR chat history alongside replies.
// The existing chat reads messages linked to clinical recipients.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.group('validateRequestParameters');
  const params = validateRequestParameters(input);
  const { secrets } = params;
  console.groupEnd();
  console.debug('validateRequestParameters success');

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  await performEffect(oystehr, params);

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Invoice SMS requests accepted' }),
  };
});

export async function performEffect(
  oystehr: Oystehr,
  { encounterId, message, secrets }: SendBillingInvoiceSmsParams
): Promise<void> {
  const resources = (
    await oystehr.fhir.search<Encounter | Patient>({
      resourceType: 'Encounter',
      params: [
        { name: '_id', value: encounterId },
        { name: '_include', value: 'Encounter:patient' },
      ],
    })
  ).unbundle();
  const patient = resources.find((resource): resource is Patient => resource.resourceType === 'Patient');
  if (!patient?.id) throw FHIR_RESOURCE_NOT_FOUND('Patient');

  const relatedPersons = await getRelatedPersonsForPatient(patient.id, oystehr);
  if (!relatedPersons.length) {
    throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR('Patient has no SMS recipients');
  }

  console.log('Sending invoice sms to patient', patient.id);
  await sendSmsToRelatedPersons({
    relatedPersons,
    message,
    oystehr,
    env: getSecret(SecretsKeys.ENVIRONMENT, secrets),
  });
}
