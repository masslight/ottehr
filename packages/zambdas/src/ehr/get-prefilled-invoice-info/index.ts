import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Patient, RelatedPerson, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getActiveAccountGuarantorReference,
  getEmailForIndividual,
  getFullName,
  getPatientReferenceFromAccount,
  getPhoneNumberForIndividual,
  GetPrefilledInvoiceInfoZambdaOutput,
  getSecret,
  SecretsKeys,
  takeContainedOrFind,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'get-prefilled-invoice-info';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets, patientId } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const fhirResources = await getFhirPatientAndResponsibleParty({ oystehr, patientId });
    const smsMessageFromSecret = getSecret(SecretsKeys.INVOICING_DEFAULT_SMS_MESSAGE, secrets);
    const memoFromSecret = getSecret(SecretsKeys.INVOICING_DEFAULT_MEMO_MESSAGE, secrets);
    const dueDateFromSecret = getSecret(SecretsKeys.INVOICING_DEFAULT_DUE_DATE_IN_DAYS, secrets);

    if (fhirResources) {
      const { responsibleParty } = fhirResources;
      const response: Partial<GetPrefilledInvoiceInfoZambdaOutput> = {
        recipientName: getFullName(responsibleParty),
        recipientEmail: getEmailForIndividual(responsibleParty),
        recipientPhoneNumber: getPhoneNumberForIndividual(responsibleParty),
        smsTextMessage: smsMessageFromSecret,
        memo: memoFromSecret,
        dueDate: DateTime.now()
          .plus({ days: parseInt(dueDateFromSecret) })
          .toISODate(),
      };
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }
    return {
      statusCode: 202,
      body: JSON.stringify({}),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
    console.log('Error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
});

async function getFhirPatientAndResponsibleParty(input: {
  oystehr: Oystehr;
  patientId: string;
}): Promise<{ patient: Patient; responsibleParty: RelatedPerson } | undefined> {
  try {
    const { patientId, oystehr } = input;
    console.log('🔍 Fetching FHIR resources for invoiceable patients...');

    const resources = (
      await oystehr.fhir.search({
        resourceType: 'Patient',
        params: [
          {
            name: '_id',
            value: patientId,
          },
          {
            name: '_revinclude',
            value: 'Account:patient',
          },
        ],
      })
    ).unbundle();
    console.log('Fetched FHIR resources:', resources.length);
    const patient = resources.find((resource) => resource.resourceType === 'Patient') as Patient;
    const account = resources.find(
      (resource) =>
        resource.resourceType === 'Account' && getPatientReferenceFromAccount(resource as Account)?.includes(patientId)
    ) as Account;
    if (!patient || !account) return undefined;
    const responsiblePartyRef = getActiveAccountGuarantorReference(account);
    if (responsiblePartyRef) {
      const responsibleParty = takeContainedOrFind(responsiblePartyRef, resources as Resource[], account) as
        | RelatedPerson
        | undefined;
      if (patient && responsibleParty) {
        return { patient, responsibleParty };
      }
    }
    return undefined;
  } catch (error) {
    console.error('Error fetching fhir resources: ', error);
    throw new Error('Error fetching fhir resources: ' + error);
  }
}
