import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Patient } from 'fhir/r4b';
import {
  SEND_BILLING_OUTREACH_NOTIFICATION_ZAMBDA_KEY,
  SendBillingOutreachNotificationInputSchema,
  SendBillingOutreachNotificationResponse,
} from 'utils/lib/types/api/invoicing.types';
import { FHIR_RESOURCE_NOT_FOUND, MISCONFIGURED_ENVIRONMENT_ERROR, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { deliverOutreachNotification } from '../../rcm/scheduled-outreach/executors/outreach-delivery';
import { checkOrCreateM2MClientToken, getUserToken, isM2MClient } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { isOutreachInBillingApp } from '../../shared/invoice-tasks';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { ValidatedZambdaInput, validateWithSchema } from '../../shared/validation';

let m2mToken: string;

const ZAMBDA_NAME = SEND_BILLING_OUTREACH_NOTIFICATION_ZAMBDA_KEY;

type SendBillingOutreachNotificationParams = ValidatedZambdaInput<typeof SendBillingOutreachNotificationInputSchema>;

// Delivered from the clinical workspace, which holds the patient's contacts, chat and mail pipeline.
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateWithSchema(SendBillingOutreachNotificationInputSchema, input);
  // The caller sets the message text, so only the billing outreach executor may call this.
  if (!isM2MClient(getUserToken(input))) throw NOT_AUTHORIZED;
  if (!isOutreachInBillingApp(params.secrets)) {
    throw MISCONFIGURED_ENVIRONMENT_ERROR('Outreach is not enabled in the billing app');
  }

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, params.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, params.secrets);

  const response = await performEffect(oystehr, params);

  // A failed medium is in the results, and the caller sets the Task status.
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export async function performEffect(
  oystehr: Oystehr,
  params: SendBillingOutreachNotificationParams
): Promise<SendBillingOutreachNotificationResponse> {
  const {
    encounterId,
    mediums,
    smsTemplate,
    emailTemplate,
    statementType,
    amountCents,
    dueDate,
    invoiceLink,
    chargeOutcome,
    secrets,
  } = params;

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

  const results = await deliverOutreachNotification({
    oystehr,
    secrets,
    patient,
    encounterRef: `Encounter/${encounterId}`,
    stripeAccount: undefined,
    mediums,
    smsTemplate,
    emailTemplate,
    statementType,
    billingInvoice: { amountCents, dueDate, invoiceLink },
    chargeOutcome,
  });

  return { results };
}
