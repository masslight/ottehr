import Oystehr, { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient, Person, RelatedPerson } from 'fhir/r4b';
import {
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getCoding,
  getSecret,
  INVALID_INPUT_ERROR,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  PRIVATE_EXTENSION_BASE_URL,
  Secrets,
  SecretsKeys,
  UpdatePatientLoginPhoneNumbersInput,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getPersonPhone } from '../get-login-phone-numbers';

const ZAMBDA_NAME = 'update-login-phone-numbers';

let m2mToken: string;

interface Input extends UpdatePatientLoginPhoneNumbersInput {
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (zambdaInput: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const input = validateRequestParameters(zambdaInput);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = createOystehrClient(m2mToken, input.secrets);
    await updateLoginPhoneNumbers(input, oystehr);
    return {
      statusCode: 200,
      body: JSON.stringify({ result: 'success' }),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, zambdaInput.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

const updateLoginPhoneNumbers = async (input: Input, oystehr: Oystehr): Promise<void> => {
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

  const personsToUnlink = resources
    .filter((resource) => resource.resourceType === 'Person')
    .flatMap((person) => {
      const personPhone = getPersonPhone(person);
      if (personPhone && !input.phoneNumbers.includes(personPhone)) {
        person.link = person.link?.filter((link) => link.target?.reference !== userRelatedPersonReference);
        return person;
      }
      return [];
    });

  const existingPersons = (
    await oystehr.fhir.search<Person>({
      resourceType: 'Person',
      params: [
        {
          name: 'telecom',
          value: input.phoneNumbers.join(','),
        },
      ],
    })
  ).unbundle();

  const personsToLink = existingPersons
    .filter((person) => person.link?.find((link) => link.target?.reference === userRelatedPersonReference) == null)
    .map((person) => {
      if (!person.link) {
        person.link = [];
      }
      person.link.push({
        target: { reference: userRelatedPersonReference },
      });
      return person;
    });

  const personsToCreate = input.phoneNumbers
    .filter((phone) => existingPersons.find((person) => getPersonPhone(person) === phone) == null)
    .map<Person>((phone) => {
      return {
        resourceType: 'Person',
        telecom: [{ system: 'phone', value: phone }],
        link: [
          {
            target: { reference: userRelatedPersonReference },
          },
        ],
      };
    });

  const updateOperations: BatchInputPutRequest<Person>[] = [...personsToLink, ...personsToUnlink].map((person) => {
    return {
      method: 'PUT',
      url: `/${person.resourceType}/${person.id}`,
      resource: person,
      ifMatch: `W/"${person?.meta?.versionId}"`,
    };
  });

  const createOperations: BatchInputPostRequest<Person>[] = personsToCreate.map((person) => {
    return {
      method: 'POST',
      url: `/${person.resourceType}`,
      resource: person,
    };
  });

  const transactionOperations = [...updateOperations, ...createOperations];

  console.log('transactionOperations:', JSON.stringify(transactionOperations, null, 2));

  if (transactionOperations.length > 0) {
    await oystehr.fhir.transaction<Person>({
      requests: transactionOperations,
    });
  }
};

const validateRequestParameters = (input: ZambdaInput): Input => {
  const { patientId, phoneNumbers } = validateJsonBody(input);

  if (isValidUUID(patientId) === false) {
    throw INVALID_RESOURCE_ID_ERROR('patientId');
  }

  if (phoneNumbers == null || !Array.isArray(phoneNumbers) || phoneNumbers.length === 0) {
    throw INVALID_INPUT_ERROR('phoneNumbers must be a non-empty array of strings');
  }

  return {
    patientId,
    phoneNumbers: Array.from(new Set(phoneNumbers)),
    secrets: input.secrets,
  };
};
