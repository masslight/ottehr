import { FhirClient } from '@zapehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Encounter, EncounterStatusHistory, Patient, Questionnaire, QuestionnaireResponse } from 'fhir/r4';
import { DateTime } from 'luxon';
import {
  DATETIME_FULL_NO_YEAR,
  FHIR_EXTENSION,
  FileDocDataForDocReference,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_CODE,
  INSURANCE_CARD_FRONT_ID,
  PATIENT_PHOTO_CODE,
  PATIENT_PHOTO_ID_PREFIX,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_CARD_CODE,
  PHOTO_ID_FRONT_ID,
  OTTEHR_MODULE,
  PRIVATE_EXTENSION_BASE_URL,
  PaperworkResponse,
  PersonSex,
  SCHOOL_WORK_NOTE_CODE,
  SCHOOL_WORK_NOTE_PREFIX,
  Secrets,
  SecretsKeys,
  ZambdaInput,
  checkAndCreateConsent,
  codingsEqual,
  createFhirClient,
  createFilesDocumentReference,
  getAppointmentResourceById,
  getLocationResource,
  getPatientFirstName,
  getPatientResourceWithVerifiedPhoneNumber,
  getQuestionnaireResponse,
  getSecret,
  topLevelCatch,
} from 'ottehr-utils';
import { getPatientContactEmail } from '../../appointment/create-appointment';
import { getM2MClientToken, getVideoEncounterForAppointment, sendConfirmationMessages } from '../../shared';
import { AuditableZambdaEndpoints, createAuditEvent } from '../../shared/audit';
import {
  createConsentItems,
  getPatientResource,
  updateAppointmentResource,
  updateEncounterResource,
  updatePatientResource,
} from '../../shared/fhir';
import { getRelatedPersonForPatient } from '../../shared/patients';
import { FileURLs, PatientEthnicity, PatientEthnicityCode, PatientRace, PatientRaceCode } from '../../types';
import { validateCreatePaperworkParams } from './validateRequestParameters';

// Lifting the token out of the handler function allows it to persist across warm lambda invocations.
export let token: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    const nowISO = DateTime.now().setZone('UTC').toISO();
    const secrets = input.secrets;
    if (!token) {
      console.log('getting token');
      token = await getM2MClientToken(secrets);
    } else {
      console.log('already have token');
    }

    const fhirClient = createFhirClient(token, getSecret(SecretsKeys.FHIR_API, secrets));
    const questionnaireSearch: Questionnaire[] = await fhirClient.searchResources({
      resourceType: 'Questionnaire',
      searchParams: [
        {
          name: 'name',
          value: 'telemed',
        },
      ],
    });
    const questionnaire: Questionnaire | undefined = questionnaireSearch[0];
    if (!questionnaire.id) {
      throw new Error('Questionnaire does not have ID');
    }
    console.group('validateRequestParameters');
    // Step 1: Validate input
    const { appointmentID, paperwork, paperworkComplete, ipAddress, files } = validateCreatePaperworkParams(
      input,
      questionnaire,
    );
    console.groupEnd();
    console.debug('validateRequestParameters success');

    const encounter = await getVideoEncounterForAppointment(appointmentID, fhirClient);
    if (!encounter || !encounter.id) {
      throw new Error('Encounter does not have ID');
    }

    const { patientID, patientResource, locationID } = await updateResourcesFromPaperwork(
      fhirClient,
      appointmentID,
      encounter.id,
      paperwork,
      secrets,
    );

    const relatedPerson = await getRelatedPersonForPatient(patientID, fhirClient);
    if (!relatedPerson || !relatedPerson.id) {
      throw new Error('RelatedPerson is not defined or does not have ID');
    }
    console.log(`paperworkComplete ${paperworkComplete}`);

    console.log('Creating DocumentReferences for cards');
    await createImagesAndDocsResources(files, patientID, appointmentID, nowISO, fhirClient);
    console.log(
      `Searching for QuestionnaireResponses for Questionnaire with ID ${questionnaire.id} and Encounter with ID ${encounter.id}`,
    );
    const questionnaireResponseResource = await getQuestionnaireResponse(questionnaire.id, encounter.id, fhirClient);

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
        token,
        OTTEHR_MODULE.TM,
        createConsentItems,
      );
    }
    if (questionnaireResponseResource) {
      console.log(`Found a QuestionnaireResponse with ID ${questionnaireResponseResource.id}`);
      await updateQuestionnaireResponse(
        paperwork,
        nowISO,
        questionnaire.id,
        questionnaireResponseResource,
        !!paperworkComplete,
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
        !!paperworkComplete,
        encounter.id,
        patientID,
        relatedPerson.id,
        ipAddress,
        fhirClient,
      );
    }
    await createAuditEvent(AuditableZambdaEndpoints.paperworkUpdate, fhirClient, input, patientID, secrets);

    const { patient, verifiedPhoneNumber } = await getPatientResourceWithVerifiedPhoneNumber(patientID, fhirClient);
    let startTime = DateTime.utc().toISO();
    startTime = DateTime.fromISO(startTime).setZone('UTC').toISO();
    const originalDate = DateTime.fromISO(startTime).setZone('UTC');
    const appointment = await getAppointmentResourceById(appointmentID, fhirClient);
    const location = await getLocationResource(locationID, fhirClient);

    if (relatedPerson?.id && location && patient && appointment) {
      const relatedPersonRef = `RelatedPerson/${relatedPerson.id}`;
      console.log(`Sms data: recipient: ${relatedPersonRef}; verifiedPhoneNumber: ${verifiedPhoneNumber};`);

      if (getSecret(SecretsKeys.SENDGRID_API_KEY, secrets)) {
        await sendConfirmationMessages(
          getPatientContactEmail(patient),
          getPatientFirstName(patient),
          relatedPersonRef,
          originalDate.toFormat(DATETIME_FULL_NO_YEAR), // what should i do with timezone??
          secrets,
          location,
          appointmentID,
          appointment.appointmentType?.text || '',
          verifiedPhoneNumber,
          token,
        );
      }
    }

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

async function updateResourcesFromPaperwork(
  fhirClient: FhirClient,
  appointmentID: NonNullable<Appointment['id']>,
  encounterID: NonNullable<Encounter['id']>,
  paperwork: PaperworkResponse[],
  secrets: Secrets | null,
): Promise<{ patientID: string; patientResource: Patient; locationID: string }> {
  // * Validate internal information *
  console.log('getting update paperwork parameters');

  console.log(`getting appointment resource with id ${appointmentID}`);
  const appointmentDetails: Appointment | undefined = await getAppointmentResourceById(appointmentID, fhirClient);
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
  const responsiblePartyFirstName = paperwork.find(
    (responseTemp) => responseTemp.linkId === 'responsible-party-first-name',
  )?.response;
  const responsiblePartyLastName = paperwork.find(
    (responseTemp) => responseTemp.linkId === 'responsible-party-last-name',
  )?.response;
  const responsiblePartyNumber = paperwork.find(
    (responseTemp) => responseTemp.linkId === 'responsible-party-number',
  )?.response;

  if (responsiblePartyNumber) {
    const rp: ResponsiblePartyContact = {
      number: responsiblePartyNumber,
      lastName: responsiblePartyLastName,
      firstName: responsiblePartyFirstName,
    };
    patientPatchOps.push(...getPatchOpsForNewContactInfo(rp, patientResource));
  }
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

  const resourceUpdatePromises: Promise<unknown>[] = [];

  if (patientPatchOps.length > 0) {
    resourceUpdatePromises.push(updatePatientResource(patientID, patientPatchOps, fhirClient));
  }
  const nowISO = DateTime.utc().toISO();
  resourceUpdatePromises.push(
    updateAppointmentResource(
      appointmentDetails,
      [
        {
          op: 'replace',
          path: '/status',
          value: 'arrived',
        },
        {
          op: 'replace',
          path: '/start',
          value: nowISO,
        },
      ],
      fhirClient,
    ),
  );

  resourceUpdatePromises.push(
    updateEncounterResource(
      encounterID,
      [
        {
          op: 'replace',
          path: '/statusHistory/0/period',
          value: {
            start: nowISO,
          } as EncounterStatusHistory['period'],
        },
      ],
      fhirClient,
    ),
  );

  await Promise.all([...resourceUpdatePromises, syncPhotonPatient(patientResource, secrets)]).catch(() => {
    throw new Error('Updating appointment or patient resource failed');
  });

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
      answer:
        paperworkItem.type === 'form-list'
          ? undefined
          : [
              {
                valueBoolean: paperworkItem.type === 'boolean' ? paperworkItem.response === true : undefined,
                valueDate: paperworkItem.type === 'date' ? paperworkItem.response : undefined,
                valueString: paperworkItem.type === 'text' ? paperworkItem.response : undefined,
              },
            ],
      extension:
        paperworkItem.type === 'form-list'
          ? paperworkItem.response.map((listItem: Record<string, string>) => ({
              url: FHIR_EXTENSION.Paperwork.formListValues.url,
              extension: Object.keys(listItem).map((key) => ({
                url: FHIR_EXTENSION.Paperwork.formListValues.extension.formListValue.url,
                extension: [
                  {
                    url: 'code',
                    valueCode: key,
                  },
                  {
                    url: 'value',
                    valueString: listItem[key],
                  },
                ],
              })),
            }))
          : undefined,
    })),
    extension: [
      {
        url: `${PRIVATE_EXTENSION_BASE_URL}/ip-address`,
        valueString: ipAddress,
      },
    ],
  };
}

interface DocToSaveData {
  code: string;
  display: string;
  text: string;
  files: FileDocDataForDocReference[];
}

async function createImagesAndDocsResources(
  files: FileURLs,
  patientID: string,
  appointmentID: string,
  dateCreated: string,
  fhirClient: FhirClient,
): Promise<void> {
  console.log('reviewing insurance cards and photo id cards');

  const docsToSave: DocToSaveData[] = [];

  const insuranceDocToSave: DocToSaveData = {
    // insurance
    code: INSURANCE_CARD_CODE,
    display: 'Health insurance card',
    files: [],
    text: 'Insurance cards',
  };

  const photoIdDocToSave: DocToSaveData = {
    // photo id
    code: PHOTO_ID_CARD_CODE,
    files: [],
    display: 'Patient data Document',
    text: 'Photo ID cards',
  };

  // patient photos doc
  const patientPhotosDocToSave: DocToSaveData = {
    code: PATIENT_PHOTO_CODE,
    display: 'Patient condition photos',
    text: 'Patient photos',
    files: [],
  };

  // work/school notes
  const workSchoolNotesDocToSave: DocToSaveData = {
    code: SCHOOL_WORK_NOTE_CODE,
    display: 'Functional status assessment note',
    text: 'Patient work/school notes',
    files: [],
  };

  if (files) {
    if (files[INSURANCE_CARD_FRONT_ID]?.z3Url) {
      insuranceDocToSave.files.push({
        url: files[INSURANCE_CARD_FRONT_ID]?.z3Url,
        title: INSURANCE_CARD_FRONT_ID,
      });
    }

    if (files[INSURANCE_CARD_BACK_ID]?.z3Url) {
      insuranceDocToSave.files.push({
        url: files[INSURANCE_CARD_BACK_ID]?.z3Url,
        title: INSURANCE_CARD_BACK_ID,
      });
    }

    if (files[PHOTO_ID_FRONT_ID]?.z3Url) {
      photoIdDocToSave.files.push({
        url: files[PHOTO_ID_FRONT_ID]?.z3Url,
        title: PHOTO_ID_FRONT_ID,
      });
    }

    if (files[PHOTO_ID_BACK_ID]?.z3Url) {
      photoIdDocToSave.files.push({
        url: files[PHOTO_ID_BACK_ID]?.z3Url,
        title: PHOTO_ID_BACK_ID,
      });
    }

    Object.keys(files).forEach((key) => {
      if (key.startsWith(PATIENT_PHOTO_ID_PREFIX) && files[key]?.z3Url) {
        patientPhotosDocToSave.files.push({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          url: files[key].z3Url!,
          title: key,
        });
      }

      if (key.startsWith(SCHOOL_WORK_NOTE_PREFIX) && files[key]?.z3Url) {
        workSchoolNotesDocToSave.files.push({
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          url: files[key].z3Url!,
          title: key,
        });
      }
    });
  }

  docsToSave.push(insuranceDocToSave, photoIdDocToSave, patientPhotosDocToSave, workSchoolNotesDocToSave);

  docsToSave.forEach(async (d) => {
    // Update insurance cards DocumentReferences
    await createFilesDocumentReference({
      files: d.files,
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: d.code,
            display: d.display,
          },
        ],
        text: d.text,
      },
      dateCreated,
      referenceParam: {
        context: {
          related: [{ reference: `Patient/${patientID}` }, { reference: `Appointment/${appointmentID}` }],
        },
      },
      searchParams: [
        {
          name: 'related',
          value: `Patient/${patientID}`,
        },
        {
          name: 'type',
          value: d.code,
        },
      ],
      fhirClient,
      ottehrModule: OTTEHR_MODULE.TM,
    });
  });
}

interface ResponsiblePartyContact {
  number: string;
  firstName?: string;
  lastName?: string;
}
const getPatchOpsForNewContactInfo = (rp: ResponsiblePartyContact, patient: Patient): Operation[] => {
  const newContact = {
    relationship: [
      {
        coding: [
          {
            system: 'http://terminology.hl7.org/CodeSystem/v2-0131',
            code: 'BP',
            display: 'Billing contact person',
          },
        ],
      },
    ],
    name: {
      use: 'usual',
      family: rp.lastName,
      given: [rp.firstName],
    },
    telecom: [
      {
        system: 'phone',
        use: 'mobile',
        rank: 1,
        value: rp.number,
      },
    ],
  };

  const contacts = patient.contact;
  if (contacts === undefined) {
    return [
      {
        op: 'add',
        value: [newContact],
        path: '/contact',
      },
    ];
  } else if (contacts.length === 0) {
    return [
      {
        op: 'replace',
        value: [newContact],
        path: '/contact',
      },
    ];
  }
  const ops: Operation[] = [];

  const indexOfCurrent = contacts.findIndex((contactEntry) => {
    return contactEntry.relationship?.some((coding) => {
      return codingsEqual(coding, newContact.relationship[0].coding[0]);
    });
  });

  const currentBillingContact = contacts[indexOfCurrent];

  if (indexOfCurrent === undefined || currentBillingContact === undefined) {
    return [
      {
        op: 'add',
        value: newContact,
        path: '/contact/-',
      },
    ];
  }

  ops.push({
    op: 'replace',
    value: newContact.name,
    path: `/contact/${indexOfCurrent}/name`,
  });
  const numbersMatch = (currentBillingContact.telecom ?? []).find((tel) => {
    return tel.value === rp.number && tel.period?.end === undefined;
  });

  if (!numbersMatch) {
    ops.push({
      op: 'replace',
      value: newContact.telecom,
      path: `/contact/${indexOfCurrent}/telecom`,
    });
  }

  return ops;
};

const syncPhotonPatient = async (patient: Patient, secrets: Secrets | null): Promise<void> => {
  console.log(`Start syncing patient with photon patient ${patient.id}`);
  const projectApiURL = getSecret(SecretsKeys.PROJECT_API, secrets);
  try {
    await fetch(`${projectApiURL}/erx/sync-patient/${patient.id}`);
    console.log('Successfuly synced photon patient');
  } catch (error) {
    console.error(`Error trying to sync patient ${patient.id} with photon: `, error);
  }
};
