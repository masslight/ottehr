import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Person, RelatedPerson } from 'fhir/r4b';
import {
  createUserResourcesForPatient,
  getCoding,
  getSecret,
  INVALID_INPUT_ERROR,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  PRIVATE_EXTENSION_BASE_URL,
  Secrets,
  SecretsKeys,
  UpdatePatientAccessPhoneNumbersInput,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  validateJsonBody,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { getPersonPhone } from '../get-access-phone-numbers';

const ZAMBDA_NAME = 'update-access-phone-numbers';

let m2mToken: string;

interface Input extends UpdatePatientAccessPhoneNumbersInput {
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
  const patientRef = `Patient/${input.patientId}`;

  const relatedPersons = (
    await oystehr.fhir.search<RelatedPerson>({
      resourceType: 'RelatedPerson',
      params: [{ name: 'patient', value: patientRef }],
    })
  )
    .unbundle()
    .filter(
      (rp) => getCoding(rp.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code === 'user-relatedperson'
    );

  const persons = (
    await oystehr.fhir.search<Person>({
      resourceType: 'Person',
      params: [{ name: 'relatedperson', value: relatedPersons.map((r) => r.id!).join(',') }],
    })
  ).unbundle();

  const phoneMap = new Map<string, { person: Person; relatedPerson: RelatedPerson }>();

  for (const rp of relatedPersons) {
    const person = persons.find((p) => p.link?.some((l) => l.target?.reference === `RelatedPerson/${rp.id}`));

    if (!person) continue;

    const phone = getPersonPhone(person);
    if (!phone) continue;

    phoneMap.set(phone, { person, relatedPerson: rp });
  }

  const currentPhones = Array.from(phoneMap.keys());
  const desiredPhones = input.phoneNumbers;

  const phonesToRemove = currentPhones.filter((p) => !desiredPhones.includes(p));
  const phonesToAdd = desiredPhones.filter((p) => !currentPhones.includes(p));

  for (const phone of phonesToRemove) {
    const entry = phoneMap.get(phone);
    if (!entry) continue;

    const { person, relatedPerson } = entry;

    const updatedLinks = person.link?.filter((l) => l.target?.reference !== `RelatedPerson/${relatedPerson.id}`);

    await oystehr.fhir.update<Person>({
      ...person,
      link: updatedLinks,
    });

    await oystehr.fhir.delete({
      resourceType: 'RelatedPerson',
      id: relatedPerson.id!,
    });
  }

  for (const phone of phonesToAdd) {
    await createUserResourcesForPatient(oystehr, input.patientId, phone);
  }

  console.log('[UpdateLoginPhones] Completed successfully');
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
