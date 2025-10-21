import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Account, Patient, RelatedPerson } from 'fhir/r4b';
import {
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
    const smsMessage = getSecret(SecretsKeys.INVOICING_DEFAULT_SMS_MESSAGE, secrets);

    if (fhirResources) {
      const { responsibleParty } = fhirResources;
      const response: GetPrefilledInvoiceInfoZambdaOutput = {
        responsiblePartyName: getFullName(responsibleParty),
        responsiblePartyEmail: getEmailForIndividual(responsibleParty) ?? '',
        responsiblePartyPhoneNumber: getPhoneNumberForIndividual(responsibleParty) ?? '',
        smsTextMessage: smsMessage,
      };
      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        responsiblePartyName: '',
        responsiblePartyEmail: '',
        responsiblePartyPhoneNumber: '',
      } as GetPrefilledInvoiceInfoZambdaOutput),
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
    const patient = resources.find((resource) => resource.resourceType === 'Patient') as Patient;
    const account = resources.find(
      (resource) =>
        resource.resourceType === 'Account' && getPatientReferenceFromAccount(resource as Account)?.includes(patientId)
    ) as Account;
    if (!patient || !account) return undefined;
    const responsiblePartyRef = getPatientReferenceFromAccount(account);
    if (responsiblePartyRef) {
      const responsibleParty = takeContainedOrFind(responsiblePartyRef, [], account) as RelatedPerson | undefined;
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
