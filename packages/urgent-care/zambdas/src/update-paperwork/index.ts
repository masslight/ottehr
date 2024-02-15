import { APIGatewayProxyResult } from 'aws-lambda';
import { validateUpdatePaperworkParams } from './validateRequestParameters';
import { FileURLs, PatientEthnicity, PatientEthnicityCode, PatientRace, PatientRaceCode } from '../types';
import { createFhirClient } from '../shared/helpers';
import {
  createCardsDocumentReference,
  getAppointmentResource,
  getPatientResource,
  getQuestionnaireResponse,
  updatePatientResource,
} from '../shared/fhir';
import { Appointment, Consent, DocumentReference, Patient, Questionnaire, QuestionnaireResponse } from 'fhir/r4';
import { getAccessToken } from '../shared';
import { AuditableZambdaEndpoints, createAuditEvent } from '../shared/userAuditLog';
import { FhirClient } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { DateTime } from 'luxon';
import { getRelatedPersonForPatient } from '../shared/auth';
import { getEncounterForAppointment } from '../shared/getEncounterDetails';
import { createConsentItems } from '../shared/pdfUtils';
import {
  PRIVATE_EXTENSION_BASE_URL,
  getPatchOperationForNewMetaTag,
  Secrets,
  ZambdaInput,
  topLevelCatch,
  PersonSex,
} from 'ottehr-utils';

// Lifting the token out of the handler function allows it to persist across warm lambda invocations.
export let token: string;

export interface UpdatePaperworkInput {
  appointmentID: string;
  paperwork: PaperworkResponse[];
  files: FileURLs;
  paperworkComplete: boolean;
  ipAddress: string;
}

export interface PaperworkResponse {
  linkId: string;
  response: any;
  type: string;
}

// export interface UpdatePaperworkRes {
//   message: string;
//   patientID: string;
// }

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const nowISO = DateTime.now().setZone('UTC').toISO();
    const secrets = input.secrets;
    if (!token) {
      console.log('getting token');
      token = await getAccessToken(secrets);
    } else {
      console.log('already have token');
    }

    const fhirClient = createFhirClient(token, secrets);
    const questionnaireSearch: Questionnaire[] = await fhirClient.searchResources({
      resourceType: 'Questionnaire',
    });
    const questionnaire: Questionnaire = questionnaireSearch[0];
    if (!questionnaire.id) {
      throw new Error('Questionnaire does not have ID');
    }
    console.group('validateRequestParameters');
    // Step 1: Validate input
    const { appointmentID, paperwork, files, paperworkComplete, ipAddress } = validateUpdatePaperworkParams(
      input,
      questionnaire,
    );
    console.groupEnd();
    console.debug('validateRequestParameters success');

    const { patientID, patientResource, locationID } = await updatePaperwork(fhirClient, appointmentID, paperwork);

    const relatedPerson = await getRelatedPersonForPatient(patientID, fhirClient);
    if (!relatedPerson || !relatedPerson.id) {
      throw new Error('RelatedPerson is not defined or does not have ID');
    }
    const encounter = await getEncounterForAppointment(appointmentID, fhirClient);
    if (!encounter.id || !nowISO) {
      throw new Error('Encounter does not have ID');
    }
    console.log(`paperworkComplete ${paperworkComplete}`);

    console.log('Creating DocumentReferences for cards');
    await createCardsResourcesAndPDFs(files, patientID, appointmentID, nowISO, fhirClient);

    console.log(
      `Searching for QuestionnaireResponses for Questionnaire with ID ${questionnaire.id} and Encounter with ID ${encounter.id}`,
    );
    const questionnaireResponseResource = await getQuestionnaireResponse(questionnaire.id, encounter.id, fhirClient);

    // Create consent PDF and DocumentReference if patient accepted forms
    const hipaa = paperwork.find((data) => data.linkId === 'hipaa-acknowledgement')?.response;
    const consentToTreat = paperwork.find((data) => data.linkId === 'consent-to-treat')?.response;

    if (hipaa && consentToTreat) {
      await checkAndCreateConsent(
        questionnaireResponseResource,
        paperwork,
        patientResource,
        appointmentID,
        locationID,
        nowISO,
        ipAddress,
        fhirClient,
        secrets,
      );
    }

    if (questionnaireResponseResource) {
      console.log(`Found a QuestionnaireResponse with ID ${questionnaireResponseResource.id}`);
      await updateQuestionnaireResponse(
        paperwork,
        nowISO,
        questionnaire.id,
        questionnaireResponseResource,
        paperworkComplete,
        encounter.id,
        patientID,
        relatedPerson.id,
        ipAddress,
        fhirClient,
      );
    } else {
      await createQuestionnaireResponse(
        paperwork,
        nowISO,
        questionnaire.id,
        paperworkComplete,
        encounter.id,
        patientID,
        relatedPerson.id,
        ipAddress,
        fhirClient,
      );
    }

    await createAuditEvent(AuditableZambdaEndpoints.paperworkUpdate, fhirClient, input, patientID, secrets);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully updated appointment paperwork' }),
    };
  } catch (error: any) {
    await topLevelCatch('update-paperwork', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};

async function updatePaperwork(
  fhirClient: FhirClient,
  appointmentID: string,
  paperwork: PaperworkResponse[],
): Promise<{ patientID: string; patientResource: Patient; locationID: string }> {
  // * Validate internal information *
  console.log('getting update paperwork parameters');

  console.log(`getting appointment resource with id ${appointmentID}`);
  const appointmentDetails: Appointment | undefined = await getAppointmentResource(appointmentID, fhirClient);
  if (!appointmentDetails) {
    throw new Error('No appointment found!');
  }

  console.log('getting location id from appointment');
  const locationID =
    appointmentDetails.participant
      ?.find((participantTemp) => participantTemp.actor?.reference?.includes('Location'))
      ?.actor?.reference?.split('/')[1] || '';
  if (!locationID) {
    throw new Error('No location id found');
  }
  console.log(`location id successfully retrieved: ${locationID}`);

  console.log('getting patient id from appointment');
  const patientID =
    appointmentDetails?.participant
      ?.find((participantTemp) => participantTemp.actor?.reference?.includes('Patient'))
      ?.actor?.reference?.split('/')[1] || '';
  if (!patientID) {
    throw new Error('No patient id found!');
  }
  console.log(`patient id successfully retrieved: ${patientID}`);

  // only one patch will be called on patient, anything needing to be added, updated or removed will be added to this array
  const patientPatchOps: Operation[] = [];
  console.log(`getting patient resource with id ${patientID}`);
  const patientResource = await getPatientResource(patientID, fhirClient);
  console.log(`patient retrieved, reviewing input and patient data to build patch operations`);
  console.log('reviewing address');
  const addressLine1 = paperwork.find((responseTemp) => responseTemp.linkId === 'patient-street-address')?.response;
  const addressLine2 = paperwork.find((responseTemp) => responseTemp.linkId === 'patient-street-address-2')?.response;
  const city = paperwork.find((responseTemp) => responseTemp.linkId === 'patient-city')?.response;
  const state = paperwork.find((responseTemp) => responseTemp.linkId === 'patient-state')?.response;
  const zip = paperwork.find((responseTemp) => responseTemp.linkId === 'patient-zip')?.response;
  if (patientResource.address) {
    console.log('building patient patch operations: update address');
    // updates existing address
    // checks if any info is changing
    // accounts for for any missing address lines
    if (addressLine1 !== patientResource.address?.[0].line?.[0]) {
      console.log('addressLine1 changed');
      patientPatchOps.push({
        op: patientResource.address?.[0].line?.[0] ? 'replace' : 'add',
        path: patientResource.address?.[0].line?.[0] ? '/address/0/line/0' : '/address/0/line',
        value: patientResource.address?.[0].line?.[0] ? addressLine1 : [addressLine1],
      });
    }
    if (addressLine2 !== patientResource.address?.[0].line?.[1]) {
      console.log('addressLine2 changed');
      let op: 'replace' | 'add' | 'remove' | undefined = undefined;
      if (addressLine2) {
        op = patientResource.address?.[0].line?.[1] ? 'replace' : 'add';
      } else {
        op = patientResource.address?.[0].line?.[1] ? 'remove' : undefined;
      }
      if (op) {
        patientPatchOps.push({
          op: op,
          path: '/address/0/line/1',
          value: addressLine2,
        });
      }
    }
    if (city !== patientResource.address?.[0].city) {
      console.log('city changed');
      patientPatchOps.push({
        op: patientResource.address?.[0].city ? 'replace' : 'add',
        path: '/address/0/city',
        value: city,
      });
    }
    if (state !== patientResource.address?.[0].state) {
      console.log('state changed');
      patientPatchOps.push({
        op: patientResource.address?.[0].state ? 'replace' : 'add',
        path: '/address/0/state',
        value: state,
      });
    }
    if (zip !== patientResource.address?.[0].postalCode) {
      console.log('zip changed');
      patientPatchOps.push({
        op: patientResource.address?.[0].postalCode ? 'replace' : 'add',
        path: '/address/0/postalCode',
        value: zip,
      });
    }
  } else {
    console.log('building patient patch operations: add address');
    // no existing address, add new address info
    const address: any = {};
    if (addressLine1) address['line'] = [addressLine1];
    if (addressLine2) address['line'].push(addressLine2);
    if (city) address['city'] = city;
    if (state) address['state'] = state;
    if (zip) address['postalCode'] = zip;
    patientPatchOps.push({
      op: 'add',
      path: '/address',
      value: [address],
    });
  }

  console.log('reviewing patient telecom');
  // if any information changes in telecom, flag to be added to the patient patch op array
  let updatePatientTelecom = false;
  // get any telecom data that exists
  const telecom = patientResource?.telecom || [];
  // find existing email info to check against incoming and it's index so that the telecom array can be updated
  const patientResourceEmail = patientResource.telecom?.find((telecom) => telecom.system === 'email')?.value;
  const patientResourceEmailIdx = patientResource.telecom?.findIndex((telecom) => telecom.system === 'email');
  const patientEmail = paperwork.find((responseTemp) => responseTemp.linkId === 'patient-email')?.response;
  const patientNumber = paperwork.find((responseTemp) => responseTemp.linkId === 'patient-number')?.response;
  const guardianEmail = paperwork.find((responseTemp) => responseTemp.linkId === 'guardian-email')?.response;
  const guardianNumber = paperwork.find((responseTemp) => responseTemp.linkId === 'guardian-number')?.response;
  if (patientEmail !== patientResourceEmail) {
    console.log('building telecom patch: patient email');
    if (patientResourceEmailIdx && patientResourceEmail && patientEmail && patientEmail !== '') {
      // there is an existing email within patient telecom and an incoming email
      // since both exist, update the telecom array
      telecom[patientResourceEmailIdx] = { system: 'email', value: patientEmail };
      updatePatientTelecom = true;
    } else if (patientResourceEmailIdx !== undefined && patientResourceEmailIdx > -1) {
      // confirm that the email does exist / was found
      // remove from telecom
      telecom.splice(patientResourceEmailIdx, 1);
      updatePatientTelecom = true;
    } else if (patientEmail !== '' && patientEmail) {
      // confirm that incoming email exists / not blank
      // add to telecom array
      telecom.push({ system: 'email', value: patientEmail });
      updatePatientTelecom = true;
    }
  }
  // find existing phone number info to check against incoming and it's index so that the telecom array can be updated
  const patientResourcePhone = patientResource.telecom?.find((telecom) => telecom.system === 'phone')?.value;
  const patientResourcePhoneIdx = patientResource.telecom?.findIndex((telecom) => telecom.system === 'phone');
  if (patientNumber !== patientResourcePhone) {
    console.log('building telecom patch: patient phone');
    if (patientResourcePhoneIdx && patientResourcePhone && patientNumber && patientNumber !== '') {
      // there is an existing number within patient telecom and an incoming number
      // since both exist, update the telecom array
      telecom[patientResourcePhoneIdx] = { system: 'phone', value: patientNumber };
      updatePatientTelecom = true;
    } else if (patientResourcePhoneIdx !== undefined && patientResourcePhoneIdx > -1) {
      // confirm that the number does exist / was found
      // remove from telecom
      telecom.splice(patientResourcePhoneIdx, 1);
      updatePatientTelecom = true;
    } else if (patientNumber !== '' && patientNumber) {
      // confirm that incoming number exists / not blank
      // add to telecom array
      telecom.push({ system: 'phone', value: patientNumber });
      updatePatientTelecom = true;
    }
  }
  // update patch ops for telecom
  if (updatePatientTelecom) {
    if (telecom.length > 0) {
      console.log('building patient patch operations: update telecom');
      patientPatchOps.push({
        op: patientResource?.telecom ? 'replace' : 'add',
        path: `/telecom`,
        value: telecom,
      });
    } else {
      console.log('building patient patch operations: remove telecom');
      patientPatchOps.push({
        op: 'remove',
        path: `/telecom`,
      });
    }
  }

  console.log('reviewing guardian telecom');
  // if any information changes in contact telecom, flag to be added to the patient patch op array
  let updateGuardianTelecom;
  // find existing guardian contact info and it's index so that the contact array can be updated
  const guardianContact = patientResource?.contact?.find((contact) =>
    contact.relationship?.find((relationship) => relationship?.coding?.[0].code === 'Parent/Guardian'),
  );
  const guardianContactIdx = patientResource?.contact?.findIndex((contact) =>
    contact.relationship?.find((relationship) => relationship?.coding?.[0].code === 'Parent/Guardian'),
  );
  // within the guardian's contact, find the telecom array to compare against incoming information
  const guardianContactTelecom = guardianContact?.telecom || [];
  // grab the guardian's email information from the telecom array
  const guardianResourceEmail = guardianContactTelecom?.find((telecom) => telecom.system === 'email')?.value;
  const guardianResourceEmailIdx = guardianContactTelecom?.findIndex((telecom) => telecom.system === 'email');
  if (guardianEmail !== guardianResourceEmail) {
    console.log('building guardian telecom patch: guardian email');
    // if email exists and is changing
    if (guardianResourceEmailIdx !== undefined && guardianResourceEmailIdx > -1 && guardianEmail) {
      guardianContactTelecom[guardianResourceEmailIdx] = { system: 'email', value: guardianEmail };
    } else if (guardianResourceEmailIdx !== undefined && guardianResourceEmailIdx > -1) {
      // information is being removed
      guardianContactTelecom.splice(guardianResourceEmailIdx, 1);
    } else if (guardianEmail) {
      // email does not exist, it is being added
      guardianContactTelecom.push({ system: 'email', value: guardianEmail });
    }
    updateGuardianTelecom = true;
  }
  // grab guardian's phone info
  const guardianPhone = guardianContact?.telecom?.find((telecom) => telecom.system === 'phone')?.value;
  const guardianPhoneIdx = guardianContact?.telecom?.findIndex((telecom) => telecom.system === 'phone');
  if (guardianNumber !== guardianPhone) {
    console.log('building guardian telecom patch: guardian phone');
    // if phone exists and is changing
    if (guardianPhoneIdx !== undefined && guardianPhoneIdx > -1 && guardianNumber) {
      guardianContactTelecom[guardianPhoneIdx] = { system: 'phone', value: guardianNumber };
    } else if (guardianPhoneIdx !== undefined && guardianPhoneIdx > -1) {
      // phone information is being removed
      guardianContactTelecom.splice(guardianPhoneIdx, 1);
    } else if (guardianNumber) {
      // phone does not exist, it is being added
      guardianContactTelecom.push({ system: 'phone', value: guardianNumber });
    }
    updateGuardianTelecom = true;
  }
  if (updateGuardianTelecom) {
    if (guardianContactTelecom.length > 0) {
      if (guardianContact?.telecom) {
        console.log('building patient patch operations: update guardian telecom');
        patientPatchOps.push({
          op: 'replace',
          path: `/contact/${guardianContactIdx}/telecom`,
          value: guardianContactTelecom,
        });
      } else {
        console.log('building patient patch operations: add guardian telecom');
        patientPatchOps.push({
          op: 'add',
          path: `/contact`,
          value: [
            {
              relationship: [
                {
                  coding: [
                    {
                      system: `${PRIVATE_EXTENSION_BASE_URL}/relationship`,
                      code: 'Parent/Guardian',
                      display: 'Parent/Guardian',
                    },
                  ],
                },
              ],
              telecom: guardianContactTelecom,
            },
          ],
        });
      }
    } else if (guardianContactIdx) {
      console.log('building patient patch operations: remove guardian telecom');
      patientPatchOps.push({
        op: 'remove',
        path: `/contact/${guardianContactIdx}`,
      });
    }
  }

  console.log('reviewing patient extension');
  // if any information changes in patient extension, flag to be added to the patient patch op array
  let updatePatientExtension = false;
  // grab any information currently stored in patient extension
  const patientExtension = patientResource?.extension || [];
  // check if ethnicity is stored in extension
  const patientEthnicity = patientExtension?.find((ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/ethnicity`)
    ?.valueCodeableConcept?.coding?.[0].display;
  // index is needed to specifically update just the ethnicity
  const patientEthnicityIdx = patientExtension?.findIndex(
    (ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/ethnicity`,
  );
  const ethnicity = paperwork.find((responseTemp) => responseTemp.linkId === 'patient-ethnicity')?.response;
  const patientEthnicityExt = {
    url: `${PRIVATE_EXTENSION_BASE_URL}/ethnicity`,
    valueCodeableConcept: {
      coding: [
        {
          system: 'http://hl7.org/fhir/v3/Ethnicity',
          code: ethnicity ? PatientEthnicityCode[ethnicity as PatientEthnicity] : undefined,
          display: ethnicity,
        },
      ],
    },
  };

  if (ethnicity !== patientEthnicity) {
    console.log('building extension patch: patient ethnicity');
    if (patientEthnicityIdx !== undefined && patientEthnicityIdx > -1 && ethnicity) {
      patientExtension[patientEthnicityIdx] = patientEthnicityExt;
    } else if (patientEthnicityIdx !== undefined && patientEthnicityIdx > -1) {
      patientExtension.splice(patientEthnicityIdx, 1);
    } else if (ethnicity) {
      patientExtension.push(patientEthnicityExt);
    }
    updatePatientExtension = true;
  }
  // check if race is stored in extension
  const patientRace = patientResource?.extension?.find((ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/race`)
    ?.valueCodeableConcept?.coding?.[0].display;
  // index is needed to specifically update just the race
  const patientRaceIdx = patientResource?.extension?.findIndex(
    (ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/race`,
  );
  const race = paperwork.find((responseTemp) => responseTemp.linkId === 'patient-race')?.response;
  const patientRaceExt = {
    url: `${PRIVATE_EXTENSION_BASE_URL}/race`,
    valueCodeableConcept: {
      coding: [
        {
          system: 'http://hl7.org/fhir/v3/Race',
          code: race ? PatientRaceCode[race as PatientRace] : undefined,
          display: race,
        },
      ],
    },
  };
  if (race !== patientRace) {
    console.log('building extension patch: patient race');
    if (patientRaceIdx !== undefined && patientRaceIdx > -1 && race) {
      patientExtension[patientRaceIdx] = patientRaceExt;
    } else if (patientRaceIdx !== undefined && patientRaceIdx > -1) {
      patientExtension.splice(patientRaceIdx, 1);
    } else if (race) {
      patientExtension.push(patientRaceExt);
    }
    updatePatientExtension = true;
  }

  const questionnaireBirthSex = paperwork.find((responseTemp) => responseTemp.linkId === 'patient-birth-sex')?.response;
  const questionnaireBirthSexValue = PersonSex[questionnaireBirthSex as keyof typeof PersonSex];
  if (!patientResource.gender || patientResource.gender !== questionnaireBirthSexValue) {
    patientPatchOps.push({
      op: patientResource.gender ? 'replace' : 'add',
      path: '/gender',
      value: questionnaireBirthSexValue,
    });
  }

  const patientFormUser = patientResource?.extension?.find(
    (ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/form-user`,
  )?.valueString;
  const patientFormUserIdx = patientResource?.extension?.findIndex(
    (ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/form-user`,
  );
  const formUser = paperwork.find((response) => response.linkId === 'patient-filling-out-as')?.response;
  const patientFormUserExt = {
    url: `${PRIVATE_EXTENSION_BASE_URL}/form-user`,
    valueString: formUser === 'Patient (Self)' ? 'Patient' : formUser, // update Patient (self) to be stored as Patient
  };

  if (patientFormUser !== formUser) {
    console.log('building extension patch: form user');
    if (patientFormUserIdx !== undefined && patientFormUserIdx > -1) {
      patientExtension[patientFormUserIdx] = patientFormUserExt;
    }
    updatePatientExtension = true;
  }

  const pointOfDiscovery = paperwork.find((response) => response.linkId === 'patient-point-of-discovery');
  if (pointOfDiscovery) {
    console.log('patient point-of-discovery field passed');
    const existingPatientPointOfDiscoveryExt = patientExtension.find(
      (ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/point-of-discovery`,
    );

    if (!existingPatientPointOfDiscoveryExt) {
      console.log('setting patient point-of-discovery field');
      patientExtension.push({
        url: `${PRIVATE_EXTENSION_BASE_URL}/point-of-discovery`,
        valueString: pointOfDiscovery.response,
      });
    }

    updatePatientExtension = true;
  }

  if (updatePatientExtension) {
    if (patientExtension.length > 0) {
      console.log('building patient patch operations: update patient extension');
      patientPatchOps.push({
        op: patientResource.extension ? 'replace' : 'add',
        path: `/extension`,
        value: patientExtension,
      });
    } else {
      console.log('building patient patch operations: remove patient extension');
      patientPatchOps.push({
        op: 'remove',
        path: `/extension`,
      });
    }
  }

  if (patientPatchOps.length > 0) {
    await updatePatientResource(patientID, patientPatchOps, fhirClient);
  }

  return { patientID, patientResource, locationID };
}

async function updateQuestionnaireResponse(
  paperwork: PaperworkResponse[],
  nowISO: string,
  questionnaireID: string,
  questionnaireResponse: QuestionnaireResponse,
  paperworkComplete: boolean,
  encounterID: string,
  patientID: string,
  relatedPersonID: string,
  ipAddress: string,
  fhirClient: FhirClient,
): Promise<string> {
  console.log(
    `Updating a QuestionnaireResponse for Questionnaire ${questionnaireID} and QuestionnaireResponse ${questionnaireResponse.id}`,
  );
  const questionnaireResponseResource = makeQuestionnaireResponseResource(
    paperwork,
    nowISO,
    questionnaireID,
    paperworkComplete,
    encounterID,
    patientID,
    relatedPersonID,
    ipAddress,
  );

  if (questionnaireResponse.status === 'completed' && paperworkComplete) {
    questionnaireResponseResource.status = 'amended';
  }

  console.log(4, JSON.stringify(questionnaireResponseResource));
  questionnaireResponseResource.id = questionnaireResponse.id;
  await fhirClient.updateResource(questionnaireResponseResource);
  console.log(
    `Updated a QuestionnaireResponse for Questionnaire ${questionnaireID} with ID ${questionnaireResponse.id}`,
  );
  return questionnaireResponse.id || '';
}

async function createQuestionnaireResponse(
  paperwork: PaperworkResponse[],
  nowISO: string,
  questionnaireID: string,
  paperworkComplete: boolean,
  encounterID: string,
  patientID: string,
  relatedPersonID: string,
  ipAddress: string,
  fhirClient: FhirClient,
): Promise<string> {
  console.log(`Creating a QuestionnaireResponse for Questionnaire ${questionnaireID}`);
  const questionnaireResponseResource = makeQuestionnaireResponseResource(
    paperwork,
    nowISO,
    questionnaireID,
    paperworkComplete,
    encounterID,
    patientID,
    relatedPersonID,
    ipAddress,
  );
  const questionnaireResponse: QuestionnaireResponse = await fhirClient.createResource(questionnaireResponseResource);
  console.log(
    `Created a QuestionnaireResponse for Questionnaire ${questionnaireID} with ID ${questionnaireResponse.id}`,
  );
  return questionnaireResponse.id || '';
}

function makeQuestionnaireResponseResource(
  paperwork: PaperworkResponse[],
  nowISO: string,
  questionnaireID: string,
  paperworkComplete: boolean,
  encounterID: string,
  patientID: string,
  relatedPersonID: string,
  ipAddress: string,
): QuestionnaireResponse {
  return {
    resourceType: 'QuestionnaireResponse',
    // todo check
    questionnaire: `Questionnaire/${questionnaireID}`,
    // todo check
    status: paperworkComplete ? 'completed' : 'in-progress',
    subject: { reference: `Patient/${patientID}` },
    encounter: { reference: `Encounter/${encounterID}` },
    authored: nowISO,
    // todo check
    source: { reference: `RelatedPerson/${relatedPersonID}` },
    item: paperwork.map((paperworkItem) => ({
      linkId: paperworkItem.linkId,
      answer: [
        {
          valueBoolean: paperworkItem.type === 'boolean' ? paperworkItem.response === true : undefined,
          valueDate: paperworkItem.type === 'date' ? paperworkItem.response : undefined,
          valueString: paperworkItem.type === 'text' ? paperworkItem.response : undefined,
        },
      ],
    })),
    extension: [
      {
        url: `${PRIVATE_EXTENSION_BASE_URL}/ip-address`,
        valueString: ipAddress,
      },
    ],
  };
}

async function createCardsResourcesAndPDFs(
  files: FileURLs,
  patientID: string,
  appointmentID: string,
  dateCreated: string,
  fhirClient: FhirClient,
): Promise<void> {
  console.log('reviewing insurance cards');
  const insuranceCardFrontUrl = files?.['insurance-card-front']?.z3Url;
  const insuranceCardBackUrl = files?.['insurance-card-back']?.z3Url;
  const insuranceCardCode = '64290-0';

  // Update insurance cards DocumentReferences
  await createCardsDocumentReference(
    insuranceCardFrontUrl,
    insuranceCardBackUrl,
    'insurance-card-front',
    'insurance-card-back',
    {
      coding: [
        {
          system: 'http://loinc.org',
          code: insuranceCardCode,
          display: 'Health insurance card',
        },
      ],
      text: 'Insurance cards',
    },
    dateCreated,
    {
      context: {
        related: [{ reference: `Patient/${patientID}` }],
      },
    },
    [
      {
        name: 'related',
        value: `Patient/${patientID}`,
      },
      {
        name: 'type',
        value: insuranceCardCode,
      },
    ],
    fhirClient,
  );

  console.log('reviewing photo id cards');
  const photoIdCardFrontUrl = files?.['id-front']?.z3Url;
  const photoIdCardBackUrl = files?.['id-back']?.z3Url;
  const photoIdCardCode = '55188-7';

  // Update photo ID cards DocumentReferences
  await createCardsDocumentReference(
    photoIdCardFrontUrl,
    photoIdCardBackUrl,
    'id-front',
    'id-back',
    {
      coding: [
        {
          system: 'http://loinc.org',
          code: photoIdCardCode,
          display: 'Patient data Document',
        },
      ],
      text: 'Photo ID cards',
    },
    dateCreated,
    {
      context: {
        related: [{ reference: `Patient/${patientID}` }],
      },
    },
    [
      {
        name: 'related',
        value: `Patient/${patientID}`,
      },
      {
        name: 'type',
        value: photoIdCardCode,
      },
    ],
    fhirClient,
  );
}

async function checkAndCreateConsent(
  questionnaireResponseResource: QuestionnaireResponse | undefined,
  paperwork: PaperworkResponse[],
  patientResource: Patient,
  appointmentID: string,
  locationID: string,
  createdDate: string,
  ipAddress: string,
  fhirClient: FhirClient,
  secrets: Secrets | null,
): Promise<void> {
  console.log('Checking DocumentReferences for consent forms');
  const oldConsentResponse = {
    signature: questionnaireResponseResource?.item?.find((response) => response.linkId === 'signature')?.answer?.[0]
      .valueString,
    fullName: questionnaireResponseResource?.item?.find((response) => response.linkId === 'full-name')?.answer?.[0]
      .valueString,
    relationship: questionnaireResponseResource?.item?.find(
      (response) => response.linkId === 'consent-form-signer-relationship',
    )?.answer?.[0].valueString,
  };

  const newConsentResponse = {
    signature: paperwork.find((question) => question.linkId === 'signature')?.response,
    fullName: paperwork.find((question) => question.linkId === 'full-name')?.response,
    relationship: paperwork.find((question) => question.linkId === 'consent-form-signer-relationship')?.response,
  };

  // Search for existing consent DocumentReferences for the appointment
  let oldConsentDocRefs: DocumentReference[] | undefined = undefined;
  let oldConsentResources: Consent[] | undefined = undefined;
  if (questionnaireResponseResource) {
    oldConsentDocRefs = await fhirClient.searchResources<DocumentReference>({
      resourceType: 'DocumentReference',
      searchParams: [
        {
          name: 'status',
          value: 'current',
        },
        {
          name: 'type',
          value: '59284-0',
        },
        {
          name: 'subject',
          value: `Patient/${patientResource.id}`,
        },
        {
          name: 'related',
          value: `Appointment/${appointmentID}`,
        },
      ],
    });

    oldConsentResources = await fhirClient.searchResources<Consent>({
      resourceType: 'Consent',
      searchParams: [
        { name: 'patient', value: `Patient/${patientResource.id}` },
        { name: 'status', value: 'active' },
      ],
    });
  }

  // Create consent PDF, DocumentReference, and Consent resource if there are none or signer information changes
  // if (
  //   !oldConsentDocRefs?.length ||
  //   !oldConsentResources?.length ||
  //   oldConsentResponse.signature !== newConsentResponse.signature ||
  //   oldConsentResponse.fullName !== newConsentResponse.fullName ||
  //   oldConsentResponse.relationship !== newConsentResponse.relationship
  // ) {
  //   await createConsentItems(
  //     createdDate,
  //     patientResource,
  //     {
  //       signature: newConsentResponse.signature,
  //       fullName: newConsentResponse.fullName,
  //       relationship: newConsentResponse.relationship,
  //     },
  //     appointmentID,
  //     locationID,
  //     ipAddress,
  //     fhirClient,
  //     token,
  //     secrets,
  //   );

  //   // Update prior consent DocumentReferences statuses to superseded
  //   if (oldConsentDocRefs?.length) {
  //     for (const oldDocRef of oldConsentDocRefs) {
  //       await fhirClient
  //         .patchResource({
  //           resourceType: 'DocumentReference',
  //           resourceId: oldDocRef.id || '',
  //           operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
  //         })
  //         .catch((error) => {
  //           throw new Error(`Failed to update DocumentReference ${oldDocRef.id} status: ${JSON.stringify(error)}`);
  //         });
  //       console.log(`DocumentReference ${oldDocRef.id} status changed to superseded`);
  //     }
  //   }

  //   // Update prior Consent resource statuses to inactive
  //   if (oldConsentResources?.length) {
  //     for (const oldConsentResource of oldConsentResources || []) {
  //       await fhirClient
  //         .patchResource({
  //           resourceType: 'Consent',
  //           resourceId: oldConsentResource.id || '',
  //           operations: [
  //             {
  //               op: 'replace',
  //               path: '/status',
  //               value: 'inactive',
  //             },
  //           ],
  //         })
  //         .catch((error) => {
  //           throw new Error(`Failed to update Consent ${oldConsentResource.id} status: ${JSON.stringify(error)}`);
  //         });
  //       console.log(`Consent ${oldConsentResource.id} status changed to inactive`);
  //     }
  //   }
  // } else {
  //   console.log('No changes to consent');
  // }
}
