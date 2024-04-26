import { FhirClient, User } from '@zapehr/sdk';
import { RelatedPerson, Person, Encounter, Patient } from 'fhir/r4';
import {
  Secrets,
  PatientInfo,
  getSecret,
  SecretsKeys,
  PUBLIC_EXTENSION_BASE_URL,
  formatPhoneNumber,
  createUserResourcesForPatient,
  getRelatedPersonsForPhoneNumber,
  getVirtualServiceResourceExtension,
} from 'ottehr-utils';
import {
  addParticipantsToConversation,
  addRelatedPersonToEncounter,
  createConversation,
  createEncounterForConversation,
  getEncountersForRelatedPersons,
} from './api-requests';

/***
Three cases:
New user, new patient, create a conversation and add the participants including M2M Device and RelatedPerson
Returning user, new patient, get the user's conversation and add the participant RelatedPerson
Returning user, returning patient, get the user's conversation
 */
export async function getConversationSIDForApptParticipants(
  fhirClient: FhirClient,
  patientInfo: PatientInfo,
  fhirPatient: Patient,
  user: User,
  secrets: Secrets | null,
  zapehrToken: string,
): Promise<string | undefined> {
  console.log('Getting/creating conversation sid for appointment.');
  console.log('patient info: ' + JSON.stringify(patientInfo));
  let conversationSID: string | undefined = undefined;
  let patientNumberToText: string | undefined = undefined;

  if (!patientInfo.id && fhirPatient.id) {
    console.log('New patient');
    // If it is a new patient, create a RelatedPerson resource for the Patient
    // and create a Person resource if there is not one for the account
    patientNumberToText = checkUserPhoneNumber(patientInfo, user);
    const userResource = await createUserResourcesForPatient(fhirClient, fhirPatient.id, patientNumberToText);
    const relatedPerson = userResource.relatedPerson;
    const person = userResource.person;
    const newUserFlag = userResource.newUser;

    console.log(5, person.telecom?.find((telecomTemp) => telecomTemp.system === 'phone')?.value);

    if (newUserFlag) {
      conversationSID = await createZapEhrConversationForNewUser(
        fhirClient,
        relatedPerson,
        secrets,
        person,
        user,
        patientInfo,
        zapehrToken,
      );
    } else {
      console.log('Returning user');
      // If it's a returning user we will find an encounter with any RelatedPerson for the user
      conversationSID = await getZapEhrConverstionFromUserEncounter(fhirClient, patientNumberToText, relatedPerson);
    }
  } else {
    console.log('Returning patient');
    conversationSID = await getConversationSIDForUser(user, fhirClient);
  }
  console.log('Returning conversation sid for appointment: ' + conversationSID);
  return conversationSID;
}

export async function createZapEhrConversationForNewUser(
  fhirClient: FhirClient,
  relatedPerson: RelatedPerson,
  secrets: Secrets | null,
  person: Person,
  user: User,
  patient: PatientInfo,
  zapehrToken: string,
): Promise<string | undefined> {
  if (!(person && person.id)) return undefined;
  let conversationSID: string | undefined = undefined;
  const deviceId = getSecret(SecretsKeys.TELEMED_MESSAGING_DEVICE_ID, secrets);

  // Create Encounter
  console.log('New user, creating an Encounter for a conversation');
  const encounter = await createEncounterForConversation(fhirClient, relatedPerson, deviceId);

  // Create conversation
  console.log('Creating a conversation');
  const projApiURL = getSecret(SecretsKeys.PROJECT_API, secrets);
  const conversation = await createConversation(projApiURL, zapehrToken, encounter);
  const conversationResponse = await conversation.json();

  if (!conversation.ok) {
    console.error('Error creating a conversation', conversationResponse);
  } else {
    const conversationEncounter = conversationResponse.encounter as Encounter;
    conversationSID = getConversationSIDFromEncounter(conversationEncounter);
    console.log(`Conversation SID is ${conversationSID}`);

    if (conversationSID) {
      // Add participants
      console.log('Adding participants to the conversation');
      const addParticipantsResponse = await addParticipantsToConversation(
        projApiURL,
        conversationSID,
        zapehrToken,
        encounter,
        deviceId,
        person,
        user,
        patient,
      );
      if (!addParticipantsResponse.ok) {
        const errorMessage = 'Error adding participants to conversation';
        console.error(errorMessage, await addParticipantsResponse.json());
      }
    }
  }
  return conversationSID;
}

export async function getZapEhrConverstionFromUserEncounter(
  fhirClient: FhirClient,
  patientNumberToText: string,
  relatedPerson: RelatedPerson,
): Promise<string | undefined> {
  let conversationSID: string | undefined = undefined;

  const relatedPersons = await getRelatedPersonsForPhoneNumber(patientNumberToText, fhirClient);
  if (relatedPersons) {
    const relatedPersonIDs = relatedPersons?.map((relatedPersonTemp) => `RelatedPerson/${relatedPersonTemp.id}`);
    // Get an encounter with any RelatedPerson the user has access to
    console.log('Getting an encounter for user');
    const conversationEncounterResults: Encounter[] = (await getEncountersForRelatedPersons(
      fhirClient,
      relatedPersonIDs,
    )) as Encounter[];

    const conversationEncounter = conversationEncounterResults.find((encounter) =>
      getVirtualServiceResourceExtension(encounter, 'twilio-conversations'),
    );

    if (conversationEncounter?.id) {
      console.log(
        `Adding this patient's RelatedPerson ${relatedPerson.id} to Encounter ${conversationEncounterResults[0].id}`,
      );
      await addRelatedPersonToEncounter(fhirClient, conversationEncounter.id, relatedPerson);

      conversationSID = (conversationEncounterResults[0] as Encounter).extension
        ?.find(
          (extensionTemp) => extensionTemp.url === `${PUBLIC_EXTENSION_BASE_URL}/encounter-virtual-service-pre-release`,
        )
        ?.extension?.find((extensionTemp) => extensionTemp.url === 'addressString')?.valueString;
    }
  }
  return conversationSID;
}

export async function getConversationSIDForUser(user: User, fhirClient: FhirClient): Promise<string | undefined> {
  const relatedPersons = await getRelatedPersonsForPhoneNumber(user.name, fhirClient);
  if (relatedPersons) {
    return getConversationSIDForRelatedPersons(relatedPersons, fhirClient);
  }
  return undefined;
}

export async function getConversationSIDForRelatedPersons(
  relatedPersons: RelatedPerson[],
  fhirClient: FhirClient,
): Promise<string | undefined> {
  const relatedPersonIDs = relatedPersons?.map((relatedPersonTemp) => `RelatedPerson/${relatedPersonTemp.id}`);
  // Get an encounter with any RelatedPerson the user has access to
  console.log('Getting an encounter for user');
  const conversationEncounterResults: Encounter[] = (await getEncountersForRelatedPersons(
    fhirClient,
    relatedPersonIDs,
  )) as Encounter[];
  const conversationEncounter = conversationEncounterResults.find((encounter) =>
    getVirtualServiceResourceExtension(encounter, 'twilio-conversations'),
  );
  if (conversationEncounter?.id) {
    return getConversationSIDFromEncounter(conversationEncounter);
  }
  return undefined;
}

function getConversationSIDFromEncounter(encounter: Encounter): string | undefined {
  const conversationSID = encounter.extension
    ?.find(
      (extensionTemp) => extensionTemp.url === `${PUBLIC_EXTENSION_BASE_URL}/encounter-virtual-service-pre-release`,
    )
    ?.extension?.find((extensionTemp) => extensionTemp.url === 'addressString')?.valueString;
  return conversationSID;
}

function checkUserPhoneNumber(patient: PatientInfo, user: User): string {
  let patientNumberToText: string | undefined = undefined;

  // If the user is staff, which happens when using the add-patient page,
  // user.name will not be a phone number, like it would be for a patient. In this
  // case, we must insert the patient's phone number using patient.phoneNumber
  // we use .startsWith('+') because the user's phone number will start with "+"
  const isEHRUser = !user.name.startsWith('+');
  if (isEHRUser) {
    // User is staff
    if (!patient.phoneNumber) {
      throw new Error('No phone number found for patient');
    }
    patientNumberToText = formatPhoneNumber(patient.phoneNumber);
  } else {
    // User is patient and auth0 already appends a +1 to the phone number
    patientNumberToText = user.name;
  }
  return patientNumberToText;
}
