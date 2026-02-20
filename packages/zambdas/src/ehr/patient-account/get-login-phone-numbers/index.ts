import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient, Person, RelatedPerson } from 'fhir/r4b';
import {
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getCoding,
  GetPatientLoginPhoneNumbersInput,
  getSecret,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  PRIVATE_EXTENSION_BASE_URL,
  Secrets,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';

const ZAMBDA_NAME = 'get-login-phone-numbers';

let m2mToken: string;

interface Input extends GetPatientLoginPhoneNumbersInput {
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (zambdaInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const input = validateRequestParameters(zambdaInput);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createOystehrClient(m2mToken, input.secrets);
    const phoneNumbers = await getLoginPhoneNumbers(input, oystehr);
    return {
      statusCode: 200,
      body: JSON.stringify({ phoneNumbers }),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, zambdaInput.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const getLoginPhoneNumbers = async (input: Input, oystehr: Oystehr): Promise<string[]> => {
  const resources = (
    await oystehr.fhir.search<Person | RelatedPerson | Patient>({
      resourceType: 'Patient',
      params: [
        {
          name: '_id',
          value: input.patientId,
        },
        {
          name: '_revinclude',
          value: 'RelatedPerson:patient',
        },
        {
          name: '_revinclude:iterate',
          value: 'Person:relatedperson',
        },
      ],
    })
  ).unbundle();

  const userRelatedPerson = resources.find(
    (resource) =>
      resource.resourceType === 'RelatedPerson' &&
      getCoding(resource.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code === 'user-relatedperson'
  );

  if (!userRelatedPerson) {
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM('Patient user RelatedPerson not found');
  }

  const userRelatedPersonReference = 'RelatedPerson/' + userRelatedPerson.id;

  return resources
    .filter((resource) => resource.resourceType === 'Person')
    .filter((person) => person.link?.find((link) => link.target?.reference === userRelatedPersonReference) != null)
    .map((person) => getPersonPhone(person))
    .filter((value) => value != null);
};

const validateRequestParameters = (input: ZambdaInput): Input => {
  const { patientId } = validateJsonBody(input);

  if (isValidUUID(patientId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('patientId');
  }

  return {
    patientId,
    secrets: input.secrets,
  };
};

export function getPersonPhone(person: Person): string | undefined {
  return person.telecom?.find((tel) => tel.system === 'phone')?.value;
}
