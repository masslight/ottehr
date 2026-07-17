import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Person, RelatedPerson } from 'fhir/r4b';
import {
  createUserResourcesForPatient,
  getCoding,
  INVALID_INPUT_ERROR,
  INVALID_RESOURCE_ID_ERROR,
  isValidUUID,
  PRIVATE_EXTENSION_BASE_URL,
  Secrets,
  UpdatePatientLoginPhoneNumbersInput,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  createClinicalOystehrClient,
  reportMissingUserRelatedPerson,
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
  const input = validateRequestParameters(zambdaInput);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, input.secrets);
  await updateLoginPhoneNumbers(input, oystehr);
  return {
    statusCode: 200,
    body: JSON.stringify({ result: 'success' }),
  };
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

  const relatedPersonIds = relatedPersons.map((r) => r.id).filter((id): id is string => !!id);
  const persons = relatedPersonIds.length
    ? (
        await oystehr.fhir.search<Person>({
          resourceType: 'Person',
          params: [{ name: 'relatedperson', value: relatedPersonIds.join(',') }],
        })
      ).unbundle()
    : [];

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

  // Invariant: every Patient must keep at least one user-relatedperson. Refuse the operation if the
  // caller's desired end-state would leave zero. `validateRequestParameters` already rejects an empty
  // `phoneNumbers` input, so this is defense in depth against future callers.
  const remainingAfterOps = currentPhones.length - phonesToRemove.length + phonesToAdd.length;
  if (remainingAfterOps <= 0) {
    throw INVALID_INPUT_ERROR('Patient must keep at least one login phone number');
  }

  // Do additions before removals so a mid-operation failure never leaves the patient with zero RPs.
  for (const phone of phonesToAdd) {
    await createUserResourcesForPatient(oystehr, input.patientId, phone);
  }

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

  // Post-op verification: re-query to confirm the invariant held through the writes.
  const finalRelatedPersons = (
    await oystehr.fhir.search<RelatedPerson>({
      resourceType: 'RelatedPerson',
      params: [{ name: 'patient', value: patientRef }],
    })
  )
    .unbundle()
    .filter(
      (rp) => getCoding(rp.relationship, `${PRIVATE_EXTENSION_BASE_URL}/relationship`)?.code === 'user-relatedperson'
    );

  if (!finalRelatedPersons.length) {
    reportMissingUserRelatedPerson('update-login-phone-numbers:post-op', input.patientId);
    throw new Error(`Invariant violation: patient ${input.patientId} has no user-relatedperson after update`);
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
