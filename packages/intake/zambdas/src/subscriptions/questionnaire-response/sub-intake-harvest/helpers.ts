import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { AddOperation, Operation } from 'fast-json-patch';
import {
  Attachment,
  Coding,
  Consent,
  ContactPoint,
  Coverage,
  DocumentReference,
  Flag,
  InsurancePlan,
  List,
  Location,
  Organization,
  Patient,
  QuestionnaireResponse,
  QuestionnaireResponseItem,
  Reference,
  RelatedPerson,
  Task,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  codingsEqual,
  CONSENT_CODE,
  ConsentSigner,
  consolidateOperations,
  ContactTelecomConfig,
  coverageFieldPaths,
  createConsentResource,
  createFilesDocumentReferences,
  createPatchOperationForTelecom,
  DATE_OF_BIRTH_URL,
  DateComponents,
  extractResourceTypeAndPath,
  FHIR_EXTENSION,
  FileDocDataForDocReference,
  flattenIntakeQuestionnaireItems,
  getArrayInfo,
  getCurrentValue,
  getPatchOperationToAddOrUpdateExtension,
  getPatchOperationToRemoveExtension,
  getPhoneNumberForIndividual,
  getResourcesFromBatchInlineRequests,
  INSURANCE_CARD_BACK_2_ID,
  INSURANCE_CARD_BACK_ID,
  INSURANCE_CARD_CODE,
  INSURANCE_CARD_FRONT_2_ID,
  INSURANCE_CARD_FRONT_ID,
  INSURANCE_COVERAGE_CODING,
  IntakeQuestionnaireItem,
  isoStringFromDateComponents,
  OTTEHR_BASE_URL,
  OTTEHR_MODULE,
  PATIENT_PHOTO_CODE,
  PATIENT_PHOTO_ID_PREFIX,
  PatientEthnicity,
  PatientEthnicityCode,
  patientFieldPaths,
  PatientMasterRecordResource,
  PatientMasterRecordResourceType,
  PatientRace,
  PatientRaceCode,
  PHOTO_ID_BACK_ID,
  PHOTO_ID_CARD_CODE,
  PHOTO_ID_FRONT_ID,
  PRACTICE_NAME_URL,
  PRIVACY_POLICY_CODE,
  PRIVATE_EXTENSION_BASE_URL,
  RELATED_PERSON_SAME_AS_PATIENT_ADDRESS_URL,
  relatedPersonFieldPaths,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_TEMPLATE_CODE,
  SCHOOL_WORK_NOTE_WORK_ID,
  SUBSCRIBER_RELATIONSHIP_CODE_MAP,
  uploadPDF,
} from 'utils';
import { v4 as uuid } from 'uuid';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';
import { createOrUpdateFlags } from '../../../paperwork/sharedHelpers';
import { createPdfBytes } from '../../../shared/pdf';

const IGNORE_CREATING_TASKS_FOR_REVIEW = true;

interface ResponsiblePartyContact {
  number: string;
  firstName?: string;
  lastName?: string;
}

interface DocToSaveData {
  code: string;
  display: string;
  text: string;
  files: FileDocDataForDocReference[];
  dateCreated: string;
  references: { context?: DocumentReference['context']; subject?: DocumentReference['subject'] };
}

interface CreateConsentResourcesInput {
  questionnaireResponse: QuestionnaireResponse;
  patientResource: Patient;
  locationResource?: Location;
  appointmentId: string;
  oystehrAccessToken: string;
  oystehr: Oystehr;
  secrets: Secrets | null;
  listResources?: List[];
}

export const getPatientAddressPatchOps = (
  paperwork: QuestionnaireResponseItem[],
  patientResource: Patient
): Operation[] => {
  const patientPatchOps: Operation[] = [];
  const flattenedPaperwork = flattenIntakeQuestionnaireItems(
    paperwork as IntakeQuestionnaireItem[]
  ) as QuestionnaireResponseItem[];
  console.log('patientResource for patching', JSON.stringify(patientResource, null, 2));
  const addressLine1 = flattenedPaperwork.find((item) => item.linkId === 'patient-street-address')?.answer?.[0]
    ?.valueString;
  const addressLine2 = flattenedPaperwork.find((item) => item.linkId === 'patient-street-address-2')?.answer?.[0]
    ?.valueString;
  const city = flattenedPaperwork.find((item) => item.linkId === 'patient-city')?.answer?.[0]?.valueString;
  const state = flattenedPaperwork.find((item) => item.linkId === 'patient-state')?.answer?.[0]?.valueString;
  const zip = flattenedPaperwork.find((item) => item.linkId === 'patient-zip')?.answer?.[0]?.valueString;

  const responsiblePartyFirstName = flattenedPaperwork.find((item) => item.linkId === 'responsible-party-first-name')
    ?.answer?.[0]?.valueString;
  const responsiblePartyLastName = flattenedPaperwork.find((item) => item.linkId === 'responsible-party-last-name')
    ?.answer?.[0]?.valueString;
  const responsiblePartyNumber = flattenedPaperwork.find((item) => item.linkId === 'responsible-party-number')
    ?.answer?.[0]?.valueString;

  if (responsiblePartyNumber) {
    const rp: ResponsiblePartyContact = {
      number: responsiblePartyNumber,
      lastName: responsiblePartyLastName,
      firstName: responsiblePartyFirstName,
    };
    patientPatchOps.push(...getPatchOpsForNewContactInfo(rp, patientResource));
  }
  if (patientResource.address == undefined) {
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
  } else {
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
  }
  return patientPatchOps;
};

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
    return contactEntry.relationship?.some((relationship) => {
      const coding = (relationship.coding ?? []) as Coding[];
      return codingsEqual((coding[0] ?? {}) as Coding, newContact.relationship[0].coding[0]);
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

export const getPatientTelecomPatchOps = (
  paperwork: QuestionnaireResponseItem[],
  patientResource: Patient
): Operation[] => {
  console.log('reviewing patient telecom');
  const patientPatchOps: Operation[] = [];
  // if any information changes in telecom, flag to be added to the patient patch op array
  let updatePatientTelecom = false;
  // get any telecom data that exists
  const telecom = patientResource?.telecom || [];
  // find existing email info to check against incoming and it's index so that the telecom array can be updated
  const patientResourceEmail = patientResource.telecom?.find((telecom) => telecom.system === 'email')?.value;
  const patientResourceEmailIdx = patientResource.telecom?.findIndex((telecom) => telecom.system === 'email');

  const flattenedPaperwork = flattenIntakeQuestionnaireItems(
    paperwork as IntakeQuestionnaireItem[]
  ) as QuestionnaireResponseItem[];
  const patientEmail = flattenedPaperwork.find((item) => item.linkId === 'patient-email')?.answer?.[0]?.valueString;
  const patientNumber = flattenedPaperwork.find((item) => item.linkId === 'patient-number')?.answer?.[0]?.valueString;
  const guardianEmail = flattenedPaperwork.find((item) => item.linkId === 'guardian-email')?.answer?.[0]?.valueString;
  const guardianNumber = flattenedPaperwork.find((item) => item.linkId === 'guardian-number')?.answer?.[0]?.valueString;

  if (patientEmail !== patientResourceEmail) {
    console.log('building telecom patch: patient email');
    if (patientResourceEmailIdx && patientResourceEmail && patientEmail && patientEmail !== '') {
      // there is an existing email within patient telecom and an incoming email
      // since both exist, update the telecom array
      console.log('building telecom patch: patient email branch 1');
      telecom[patientResourceEmailIdx] = { system: 'email', value: patientEmail };
      updatePatientTelecom = true;
    } else if (patientResourceEmailIdx !== undefined && patientResourceEmailIdx > -1) {
      // confirm that the email does exist / was found
      // remove from telecom
      console.log('building telecom patch: patient email branch 2');
      if (patientEmail !== '' && patientEmail) {
        telecom.splice(patientResourceEmailIdx, 1, { system: 'email', value: patientEmail });
      } else {
        telecom.splice(patientResourceEmailIdx, 1);
      }
      updatePatientTelecom = true;
    } else if (patientEmail !== '' && patientEmail) {
      // confirm that incoming email exists / not blank
      // add to telecom array
      console.log('building telecom patch: patient email branch 3');
      telecom.push({ system: 'email', value: patientEmail });
      updatePatientTelecom = true;
    }
  }
  // find existing phone number info to check against incoming and it's index so that the telecom array can be updated
  const patientResourcePhone = telecom?.find((telecom) => telecom.system === 'phone')?.value;
  const patientResourcePhoneIdx = telecom?.findIndex((telecom) => telecom.system === 'phone');
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
      if (patientNumber && patientNumber !== '') {
        telecom.splice(patientResourcePhoneIdx, 1, { system: 'phone', value: patientNumber });
      } else {
        telecom.splice(patientResourcePhoneIdx, 1);
      }
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
    console.log('updating patient telecom', JSON.stringify(telecom));
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
  const guardianContact = patientResource?.contact?.find(
    (contact) => contact.relationship?.find((relationship) => relationship?.coding?.[0].code === 'Parent/Guardian')
  );
  const guardianContactIdx = patientResource?.contact?.findIndex(
    (contact) => contact.relationship?.find((relationship) => relationship?.coding?.[0].code === 'Parent/Guardian')
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
  return patientPatchOps;
};

export const getPatientExtensionPatchOps = (
  paperwork: QuestionnaireResponseItem[],
  patientResource: Patient
): Operation[] => {
  const patientPatchOps: Operation[] = [];

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
    (ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/ethnicity`
  );

  const flattenedPaperwork = flattenIntakeQuestionnaireItems(
    paperwork as IntakeQuestionnaireItem[]
  ) as QuestionnaireResponseItem[];
  const ethnicity = flattenedPaperwork.find((item) => item.linkId === 'patient-ethnicity')?.answer?.[0]?.valueString;

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
    (ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/race`
  );
  const race = flattenedPaperwork.find((item) => item.linkId === 'patient-race')?.answer?.[0]?.valueString;
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

  const pointOfDiscovery = flattenedPaperwork.find((item) => item.linkId === 'patient-point-of-discovery')?.answer?.[0];
  if (pointOfDiscovery) {
    console.log('patient point-of-discovery field passed');
    const existingPatientPointOfDiscoveryExt = patientExtension.find(
      (ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/point-of-discovery`
    );

    if (!existingPatientPointOfDiscoveryExt) {
      console.log('setting patient point-of-discovery field');
      patientExtension.push({
        url: `${PRIVATE_EXTENSION_BASE_URL}/point-of-discovery`,
        valueString: pointOfDiscovery.valueString,
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
  return patientPatchOps;
};

export async function createConsentResources(input: CreateConsentResourcesInput): Promise<void> {
  const {
    questionnaireResponse,
    patientResource,
    locationResource,
    appointmentId,
    oystehrAccessToken,
    oystehr,
    secrets,
    listResources,
  } = input;
  console.log('Checking DocumentReferences for consent forms');
  const paperwork = questionnaireResponse.item ?? [];

  const flattenedPaperwork = flattenIntakeQuestionnaireItems(
    paperwork as IntakeQuestionnaireItem[]
  ) as QuestionnaireResponseItem[];
  const consentSigner: ConsentSigner = {
    signature: flattenedPaperwork.find((item) => item.linkId === 'signature')?.answer?.[0]?.valueString,
    fullName: flattenedPaperwork.find((question) => question.linkId === 'full-name')?.answer?.[0]?.valueString,
    relationship: flattenedPaperwork.find((question) => question.linkId === 'consent-form-signer-relationship')
      ?.answer?.[0]?.valueString,
  } as ConsentSigner;
  console.log('consentSigner', consentSigner);
  if (consentSigner.signature === undefined) {
    throw new Error('Consent signature missing from QuestionnaireResponse');
  }
  if (consentSigner.fullName === undefined) {
    throw new Error('Consent signer full name missing from QuestionnaireResponse');
  }
  if (consentSigner.relationship === undefined) {
    throw new Error('Consent signer relationship missing from QuestionnaireResponse');
  }

  // Search for existing consent DocumentReferences for the appointment
  let oldConsentDocRefs: DocumentReference[] | undefined = undefined;
  let oldConsentResources: Consent[] | undefined = undefined;
  if (questionnaireResponse) {
    console.log('searching for old conset doc refs');
    oldConsentDocRefs = (
      await oystehr.fhir.search<DocumentReference>({
        resourceType: 'DocumentReference',
        params: [
          {
            name: 'status',
            value: 'current',
          },
          {
            name: 'type',
            value: CONSENT_CODE,
          },
          {
            name: 'subject',
            value: `Patient/${patientResource.id}`,
          },
          {
            name: 'related',
            value: `Appointment/${appointmentId}`,
          },
        ],
      })
    ).unbundle();
    if (oldConsentDocRefs?.[0]?.id) {
      console.log('searching for old consent resources');
      oldConsentResources = (
        await oystehr.fhir.search<Consent>({
          resourceType: 'Consent',
          params: [
            { name: 'patient', value: `Patient/${patientResource.id}` },
            { name: 'status', value: 'active' },
            { name: 'source-reference', value: `DocumentReference/${oldConsentDocRefs?.[0]?.id}` }, // todo check this is right
          ],
        })
      ).unbundle();
    }
  }

  // Create consent PDF, DocumentReference, and Consent resource if there are none or signer information changes
  // Update prior consent DocumentReferences statuses to superseded
  if (oldConsentDocRefs?.length) {
    for (const oldDocRef of oldConsentDocRefs) {
      await oystehr.fhir
        .patch({
          resourceType: 'DocumentReference',
          id: oldDocRef.id || '',
          operations: [{ op: 'replace', path: '/status', value: 'superseded' }],
        })
        .catch((error) => {
          throw new Error(`Failed to update DocumentReference ${oldDocRef.id} status: ${JSON.stringify(error)}`);
        });
      console.log(`DocumentReference ${oldDocRef.id} status changed to superseded`);
    }
  }

  // Update prior Consent resource statuses to inactive
  if (oldConsentResources?.length) {
    for (const oldConsentResource of oldConsentResources || []) {
      await oystehr.fhir
        .patch({
          resourceType: 'Consent',
          id: oldConsentResource.id || '',
          operations: [
            {
              op: 'replace',
              path: '/status',
              value: 'inactive',
            },
          ],
        })
        .catch((error) => {
          throw new Error(`Failed to update Consent ${oldConsentResource.id} status: ${JSON.stringify(error)}`);
        });
      console.log(`Consent ${oldConsentResource.id} status changed to inactive`);
    }
  }

  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const bucket = `${projectId}-consent-forms`;
  // any non-IL val should do the trick here
  const locationState = locationResource?.address?.state ?? 'NY';
  const baseUploadURL = `${getSecret(SecretsKeys.PROJECT_API, secrets)}/z3/${bucket}/${
    patientResource.id
  }/${Date.now()}`;
  const consentDocument =
    locationState === 'IL' ? './CTT.and.Guarantee.of.Payment.Illinois-S.pdf' : './CTT.and.Guarantee.of.Payment-S.pdf';
  const pdfsToCreate = [
    {
      uploadURL: `${baseUploadURL}-consent-to-treat.pdf`,
      copyFromPath: consentDocument,
      formTitle: 'Consent to Treat and Guarantee of Payment',
      resourceTitle: 'Consent forms',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: CONSENT_CODE,
            display: 'Consent Documents',
          },
        ],
        text: 'Consent forms',
      },
    },
    {
      uploadURL: `${baseUploadURL}-hippa-acknowledgement.pdf`,
      copyFromPath: './HIPAA.Acknowledgement-S.pdf',
      formTitle: 'HIPAA Acknowledgement',
      resourceTitle: 'HIPPA forms',
      type: {
        coding: [
          {
            system: 'http://loinc.org',
            code: PRIVACY_POLICY_CODE,
            display: 'Privacy Policy',
          },
        ],
        text: 'HIPAA Acknowledgement forms',
      },
    },
  ];
  const nowIso = DateTime.now().setZone('UTC').toISO() || '';

  const isVirtualLocation =
    locationResource?.extension?.find(
      (ext) => ext.url === 'https://extensions.fhir.zapehr.com/location-form-pre-release'
    )?.valueCoding?.code === 'vi';

  const facilityName = isVirtualLocation
    ? 'Ottehr Telemedicine'
    : locationResource?.identifier?.find(
        (identifierTemp) => identifierTemp.system === `${OTTEHR_BASE_URL}/r4/facility-name`
      )?.value;

  const ipAddress = questionnaireResponse.extension?.find((ext) => {
    return ext.url === FHIR_EXTENSION.Paperwork.submitterIP.url;
  })?.valueString;

  const timezone = questionnaireResponse.item?.find((item) => {
    return item.linkId === 'signature-timezone';
  })?.answer?.[0]?.valueString;

  for (const pdfInfo of pdfsToCreate) {
    console.log(`creating ${pdfInfo.formTitle} PDF`, JSON.stringify(pdfInfo));
    const errMessage = (action: string, errorMsg: any): string => {
      return `Failed to ${action} ${pdfInfo.formTitle} PDF. ${errorMsg}`;
    };
    console.log('getting pdf bytes');
    const pdfBytes = await createPdfBytes(
      patientResource,
      consentSigner,
      nowIso.trim(),
      ipAddress?.trim() ?? '',
      pdfInfo,
      secrets,
      timezone?.trim(),
      facilityName
    ).catch((error: any) => {
      console.log('createPdfBytes error', error);
      throw new Error(errMessage('create', error.message));
    });
    // fs.writeFileSync(`./consent-forms-${patientResource.id}.pdf`, pdfBytes);

    console.log('uploading pdf');
    await uploadPDF(pdfBytes, pdfInfo.uploadURL, oystehrAccessToken, patientResource.id).catch((error) => {
      throw new Error(errMessage('upload', error.message));
    });
  }

  console.log('pdfsToCreate len', pdfsToCreate.length);
  for (const pdfInfo of pdfsToCreate) {
    const documentReferences = await createFilesDocumentReferences({
      files: [{ url: pdfInfo.uploadURL, title: pdfInfo.formTitle }],
      type: pdfInfo.type,
      dateCreated: nowIso,
      oystehr,
      references: {
        subject: {
          reference: `Patient/${patientResource.id}`,
        },
        context: {
          related: [
            {
              reference: `Appointment/${appointmentId}`,
            },
          ],
        },
      },
      generateUUID: randomUUID,
      listResources,
      searchParams: [],
      meta: {
        // for backward compatibility. TODO: remove this
        tag: [{ code: OTTEHR_MODULE.IP }, { code: OTTEHR_MODULE.TM }],
      },
    });

    if (!documentReferences?.[0]?.id) {
      throw new Error('No consent document reference id found');
    }

    // Create FHIR Consent resource
    if (pdfInfo.type.coding[0].code === CONSENT_CODE) {
      await createConsentResource(patientResource.id ?? '', documentReferences?.[0]?.id, nowIso, oystehr);
    }
  }
}

export async function createDocumentResources(
  quesionnaireResponse: QuestionnaireResponse,
  patientID: string,
  appointmentID: string,
  oystehr: Oystehr,
  listResources: List[]
): Promise<void> {
  console.log('reviewing insurance cards and photo id cards');

  const docsToSave: DocToSaveData[] = [];

  const items = (quesionnaireResponse.item as IntakeQuestionnaireItem[]) ?? [];
  const flattenedPaperwork = flattenIntakeQuestionnaireItems(items) as QuestionnaireResponseItem[];

  const photoIdFront = flattenedPaperwork.find((item) => {
    return item.linkId === PHOTO_ID_FRONT_ID;
  })?.answer?.[0]?.valueAttachment;
  const photoIdBack = flattenedPaperwork.find((item) => {
    return item.linkId === PHOTO_ID_BACK_ID;
  })?.answer?.[0]?.valueAttachment;

  const insuranceCardFront = flattenedPaperwork.find((item) => {
    return item.linkId === INSURANCE_CARD_FRONT_ID;
  })?.answer?.[0]?.valueAttachment;
  const insuranceCardBack = flattenedPaperwork.find((item) => {
    return item.linkId === INSURANCE_CARD_BACK_ID;
  })?.answer?.[0]?.valueAttachment;

  const insuranceCardFrontSecondary = flattenedPaperwork.find((item) => {
    return item.linkId === INSURANCE_CARD_FRONT_2_ID;
  })?.answer?.[0]?.valueAttachment;
  const insuranceCardBackSecondary = flattenedPaperwork.find((item) => {
    return item.linkId === INSURANCE_CARD_BACK_2_ID;
  })?.answer?.[0]?.valueAttachment;

  const patientConditionPhoto = flattenedPaperwork.find((item) => {
    return item.linkId === `${PATIENT_PHOTO_ID_PREFIX}s`;
  })?.answer?.[0]?.valueAttachment;

  const schoolNote = flattenedPaperwork.find((item) => {
    return item.linkId === SCHOOL_WORK_NOTE_SCHOOL_ID;
  })?.answer?.[0]?.valueAttachment;

  const workNote = flattenedPaperwork.find((item) => {
    return item.linkId === SCHOOL_WORK_NOTE_WORK_ID;
  })?.answer?.[0]?.valueAttachment;

  const idCards: Attachment[] = [];
  if (photoIdBack) {
    idCards.push(photoIdBack);
  }
  if (photoIdFront) {
    idCards.push(photoIdFront);
  }

  const insuranceCards: Attachment[] = [];
  if (insuranceCardFront) {
    insuranceCards.push(insuranceCardFront);
  }
  if (insuranceCardBack) {
    insuranceCards.push(insuranceCardBack);
  }

  if (insuranceCardFrontSecondary) {
    insuranceCards.push(insuranceCardFrontSecondary);
  }
  if (insuranceCardBackSecondary) {
    insuranceCards.push(insuranceCardBackSecondary);
  }

  const schoolWorkNotes: Attachment[] = [];
  if (schoolNote) {
    schoolWorkNotes.push(schoolNote);
  }
  if (workNote) {
    schoolWorkNotes.push(workNote);
  }

  if (idCards.length) {
    const sorted = sortAttachmentsByCreationTime(idCards);
    const dateCreated = sorted[0].creation ?? '';
    const photoIdDocToSave = {
      // photo id
      code: PHOTO_ID_CARD_CODE,
      files: sorted.map((attachment) => {
        const { url = '', title = '' } = attachment;
        return {
          url,
          title,
        };
      }),
      references: {
        context: { related: [{ reference: `Patient/${patientID}` }] },
      },
      display: 'Patient data Document',
      text: 'Photo ID cards',
      dateCreated,
    };
    docsToSave.push(photoIdDocToSave);
  }

  if (insuranceCards.length) {
    const sorted = sortAttachmentsByCreationTime(insuranceCards);
    const dateCreated = sorted[0].creation ?? '';
    const insuranceDocToSave = {
      code: INSURANCE_CARD_CODE,
      files: sorted.map((attachment) => {
        const { url = '', title = '' } = attachment;
        return {
          url,
          title,
        };
      }),
      references: {
        context: { related: [{ reference: `Patient/${patientID}` }] },
      },
      display: 'Health insurance card',
      text: 'Insurance cards',
      dateCreated,
    };
    docsToSave.push(insuranceDocToSave);
  }

  if (patientConditionPhoto) {
    const dateCreated = patientConditionPhoto.creation ?? '';
    const conditionPhotosToSave = {
      code: PATIENT_PHOTO_CODE,
      files: [patientConditionPhoto].map((attachment) => {
        const { url = '', title = '' } = attachment;
        return {
          url,
          title,
        };
      }),
      references: {
        subject: { reference: `Patient/${patientID}` },
        context: { related: [{ reference: `Appointment/${appointmentID}` }] },
      },
      display: 'Patient condition photos',
      text: 'Patient photos',
      dateCreated,
    };
    docsToSave.push(conditionPhotosToSave);
  }

  if (schoolWorkNotes.length) {
    const sorted = sortAttachmentsByCreationTime(schoolWorkNotes);
    const dateCreated = sorted[0].creation ?? '';
    const schoolWorkNotesToSave = {
      code: SCHOOL_WORK_NOTE_TEMPLATE_CODE,
      files: schoolWorkNotes.map((attachment) => {
        const { url = attachment.url || '', title = attachment.title || '' } = attachment;
        return {
          url,
          title,
        };
      }),
      references: {
        subject: { reference: `Patient/${patientID}` },
        context: { related: [{ reference: `Appointment/${appointmentID}` }] },
      },
      display: 'Patient status assessment note template',
      text: 'Patient status assessment note template',
      dateCreated,
    };
    docsToSave.push(schoolWorkNotesToSave);
  }

  console.log('docsToSave len', docsToSave.length);
  for (const d of docsToSave) {
    await createFilesDocumentReferences({
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
      dateCreated: d.dateCreated,
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
      references: d.references,
      oystehr,
      generateUUID: randomUUID,
      listResources,
      meta: {
        // for backward compatibility. TODO: remove this
        tag: [{ code: OTTEHR_MODULE.IP }, { code: OTTEHR_MODULE.TM }],
      },
    });
  }
}

export async function flagPaperworkEdit(patientID: string, encounterID: string, oystehr: Oystehr): Promise<void> {
  const now = DateTime.now().toUTC().toISO();

  // get paperwork-edit flag
  const existingFlags = (
    await oystehr.fhir.search<Flag>({
      resourceType: 'Flag',
      params: [
        {
          name: 'encounter',
          value: `Encounter/${encounterID}`,
        },
        {
          name: '_tag',
          value: 'paperwork-edit',
        },
        {
          name: '_sort',
          value: '-date',
        },
      ],
    })
  ).unbundle();

  // filter out inactive statuses because FHIR R4B does not support status search on Flag
  const activeFlags = existingFlags.filter((flag) => flag.status === 'active');

  await createOrUpdateFlags('paperwork-edit', activeFlags, patientID, encounterID, now, oystehr);
}

const sortAttachmentsByCreationTime = (attachments: Attachment[]): Attachment[] => {
  return attachments.sort((a1, a2) => {
    const creation1 = a1.creation;
    const creation2 = a2.creation;

    if (!creation1 && !creation2) {
      return 0;
    } else if (!creation1) {
      return 1;
    } else if (!creation2) {
      return -1;
    }

    const date1 = DateTime.fromISO(creation1);
    const date2 = DateTime.fromISO(creation2);

    if (!date1.isValid && !date2.isValid) {
      return 0;
    } else if (!date1.isValid) {
      return 1;
    } else if (!date2.isValid) {
      return -1;
    }

    if (date1 === date2) {
      return 0;
    }
    return date1 < date2 ? -1 : 1;
  });
};

const paperworkToPatientFieldMap: Record<string, string> = {
  'patient-first-name': patientFieldPaths.firstName,
  'patient-middle-name': patientFieldPaths.middleName,
  'patient-last-name': patientFieldPaths.lastName,
  'patient-birth-date': patientFieldPaths.birthDate,
  'patient-pronouns': patientFieldPaths.preferredPronouns,
  'patient-pronouns-custom': patientFieldPaths.preferredPronounsCustom,
  'patient-birth-sex': patientFieldPaths.gender,
  'patient-birth-sex-missing': patientFieldPaths.genderIdentityDetails,
  'patient-number': patientFieldPaths.phone,
  'patient-email': patientFieldPaths.email,
  'pcp-first': patientFieldPaths.pcpFirstName,
  'pcp-last': patientFieldPaths.pcpLastName,
  'pcp-number': patientFieldPaths.pcpPhone,
  'pcp-practice': patientFieldPaths.practiceName,
  'pcp-address': patientFieldPaths.pcpStreetAddress,
  'patient-street-address': patientFieldPaths.streetAddress,
  'patient-street-address-2': patientFieldPaths.streetAddressLine2,
  'patient-city': patientFieldPaths.city,
  'patient-state': patientFieldPaths.state,
  'patient-zip': patientFieldPaths.zip,
  'patient-filling-out-as': patientFieldPaths.fillingOutAs,
  'guardian-email': patientFieldPaths.parentGuardianEmail,
  'guardian-number': patientFieldPaths.parentGuardianPhone,
  'patient-ethnicity': patientFieldPaths.ethnicity,
  'patient-race': patientFieldPaths.race,
  'patient-point-of-discovery': patientFieldPaths.pointOfDiscovery,
  'responsible-party-relationship': patientFieldPaths.responsiblePartyRelationship,
  'responsible-party-first-name': patientFieldPaths.responsiblePartyFirstName,
  'responsible-party-last-name': patientFieldPaths.responsiblePartyLastName,
  'responsible-party-birth-sex': patientFieldPaths.responsiblePartyGender,
  'responsible-party-date-of-birth': patientFieldPaths.responsiblePartyBirthDate,
  'responsible-party-number': patientFieldPaths.responsiblePartyPhone,
  'insurance-carrier': coverageFieldPaths.carrier,
  'insurance-member-id': coverageFieldPaths.memberId,
  'policy-holder-first-name': relatedPersonFieldPaths.firstName,
  'policy-holder-middle-name': relatedPersonFieldPaths.middleName,
  'policy-holder-last-name': relatedPersonFieldPaths.lastName,
  'policy-holder-date-of-birth': relatedPersonFieldPaths.birthDate,
  'policy-holder-birth-sex': relatedPersonFieldPaths.gender,
  'policy-holder-address-as-patient': relatedPersonFieldPaths.sameAsPatientAddress,
  'policy-holder-address': relatedPersonFieldPaths.streetAddress,
  'policy-holder-address-additional-line': relatedPersonFieldPaths.addressLine2,
  'policy-holder-city': relatedPersonFieldPaths.city,
  'policy-holder-state': relatedPersonFieldPaths.state,
  'policy-holder-zip': relatedPersonFieldPaths.zip,
  'patient-relationship-to-insured': coverageFieldPaths.relationship,
};

const pathToLinkIdMap: Record<string, string> = Object.entries(paperworkToPatientFieldMap).reduce(
  (acc, [linkId, path]) => {
    acc[path] = linkId;
    return acc;
  },
  {} as Record<string, string>
);

const BIRTH_SEX_MAP: Record<string, string> = {
  Male: 'male',
  Female: 'female',
  Intersex: 'other',
};

const PRIMARY_INSURANCE_LINK_IDS = ['insurance-carrier', 'insurance-member-id', 'patient-relationship-to-insured'];

const SECONDARY_INSURANCE_LINK_IDS = PRIMARY_INSURANCE_LINK_IDS.map((id) => `${id}-2`);

const PRIMARY_POLICY_HOLDER_LINK_IDS = [
  'policy-holder-first-name',
  'policy-holder-middle-name',
  'policy-holder-last-name',
  'policy-holder-date-of-birth',
  'policy-holder-birth-sex',
  'policy-holder-address-as-patient',
  'policy-holder-address',
  'policy-holder-address-additional-line',
  'policy-holder-city',
  'policy-holder-state',
  'policy-holder-zip',
  'patient-relationship-to-insured',
];

const SECONDARY_POLICY_HOLDER_LINK_IDS = PRIMARY_POLICY_HOLDER_LINK_IDS.map((id) => `${id}-2`);

interface ConflictingUpdate {
  operation: Operation;
  resourceReference: Reference['reference'];
}

interface ResourcePatchOperations {
  patchOpsForDirectUpdate: Operation[];
  conflictingUpdates: ConflictingUpdate[];
}

interface MasterRecordPatchOperations {
  patient: ResourcePatchOperations;
  coverage: { [key: string]: ResourcePatchOperations }; // key is Coverage.id
  relatedPerson: { [key: string]: ResourcePatchOperations }; // key is RelatedPerson.id
}

export interface PatientMasterRecordResources {
  patient: Patient;
  relatedPersons?: RelatedPerson[];
  coverages?: Coverage[];
}

export function createMasterRecordPatchOperations(
  questionnaireResponse: QuestionnaireResponse,
  resources: PatientMasterRecordResources
): MasterRecordPatchOperations {
  const flattenedPaperwork = flattenIntakeQuestionnaireItems(
    questionnaireResponse.item as IntakeQuestionnaireItem[]
  ) as QuestionnaireResponseItem[];

  const result: MasterRecordPatchOperations = {
    patient: { patchOpsForDirectUpdate: [], conflictingUpdates: [] },
    coverage: {},
    relatedPerson: {},
  };

  const tempOperations = {
    patient: [] as Operation[],
    coverage: {} as { [key: string]: Operation[] },
    relatedPerson: {} as { [key: string]: Operation[] },
  };

  // Define telecom configurations
  const contactTelecomConfigs: Record<string, ContactTelecomConfig> = {
    'patient-number': { system: 'phone' },
    'patient-email': { system: 'email' },
    'guardian-number': { system: 'phone' },
    'guardian-email': { system: 'email' },
    'responsible-party-number': { system: 'phone', use: 'mobile' },
    'pcp-number': { system: 'phone' },
  };

  flattenedPaperwork.forEach((item) => {
    const value = extractValueFromItem(item);
    if (value === undefined) return;

    // Remove '-2' suffix for secondary fields
    const baseFieldId = item.linkId === 'patient-street-address-2' ? item.linkId : item.linkId.replace(/-2$/, '');

    const fullPath = paperworkToPatientFieldMap[baseFieldId];
    if (!fullPath) return;

    const { resourceType, path } = extractResourceTypeAndPath(fullPath);
    let operation: Operation | undefined;

    switch (resourceType) {
      case 'Patient': {
        // Handle telecom fields
        const contactTelecomConfig = contactTelecomConfigs[item.linkId];
        if (contactTelecomConfig) {
          operation = createPatchOperationForTelecom(
            value as string | boolean,
            contactTelecomConfig,
            resources.patient,
            path
          );
          if (operation) tempOperations.patient.push(operation);
          return;
        }

        // Handle extensions
        if (path.startsWith('/extension/')) {
          const url = path.replace('/extension/', '');
          const currentValue = getCurrentValue(resources.patient, path);
          if (value !== currentValue) {
            if (value === '') {
              if (currentValue !== undefined && currentValue !== null) {
                operation = getPatchOperationToRemoveExtension(resources.patient, { url });
              }
            } else {
              operation = getPatchOperationToAddOrUpdateExtension(
                resources.patient,
                { url, value: String(value) },
                currentValue
              );
            }
            if (operation) tempOperations.patient.push(operation);
          }
          return;
        }

        // Handle array fields
        const { isArray, parentPath } = getArrayInfo(path);
        if (isArray) {
          const effectiveArrayValue = getEffectiveValue(resources.patient, parentPath, tempOperations.patient);
          const arrayMatch = path.match(/^(.+)\/(\d+)$/);

          if (arrayMatch) {
            const [, arrayPath, indexStr] = arrayMatch;
            const targetIndex = parseInt(indexStr);
            const currentArray = Array.isArray(effectiveArrayValue)
              ? [...effectiveArrayValue]
              : new Array(targetIndex + 1).fill(undefined);

            if (value === '') {
              currentArray[targetIndex] = undefined;
            } else {
              currentArray[targetIndex] = value;
            }

            const cleanArray = currentArray.filter(
              (item, index) => item !== undefined || index < currentArray.length - 1
            );

            if (cleanArray.length > 0) {
              operation = {
                op: effectiveArrayValue === undefined ? 'add' : 'replace',
                path: arrayPath,
                value: cleanArray,
              };
            } else {
              operation = {
                op: 'remove',
                path: arrayPath,
              };
            }
            if (operation) tempOperations.patient.push(operation);
          }
          return;
        }

        // TODO: make handler for nested extensions
        // Special handler for responsible-party-date-of-birth
        if (item.linkId === 'responsible-party-date-of-birth') {
          const url = DATE_OF_BIRTH_URL;
          const currentValue = getCurrentValue(resources.patient, path);
          if (value !== currentValue) {
            operation = {
              op: 'add',
              path: '/contact/0/extension',
              value: [
                {
                  url: url,
                  valueString: value,
                },
              ],
            };
            if (operation) tempOperations.patient.push(operation);
          }
          return;
        }
        // Special handler for practice-name
        if (item.linkId === 'pcp-practice') {
          const url = PRACTICE_NAME_URL;
          const currentValue = getCurrentValue(resources.patient, path);
          if (value !== currentValue) {
            operation = {
              op: 'add',
              path: '/contained/0/extension',
              value: [
                {
                  url: url,
                  valueString: value,
                },
              ],
            };
            if (operation) tempOperations.patient.push(operation);
          }
          return;
        }

        // Handle regular fields
        const currentValue = getCurrentValue(resources.patient, path);
        if (value !== currentValue) {
          operation = createBasicPatchOperation(value, path, currentValue);
        }
        if (operation) tempOperations.patient.push(operation);
        break;
      }

      case 'Coverage': {
        const coverage = resources.coverages && findRelevantCoverage(resources.coverages, item);

        if (coverage) {
          const currentValue = getCurrentValue(coverage, path);

          if (baseFieldId === 'insurance-carrier') {
            if ((value as Reference).display !== currentValue) {
              operation = createBasicPatchOperation((value as Reference).display!, path, currentValue);
            }
          } else if (value !== currentValue) {
            operation = createBasicPatchOperation(value, path, currentValue);
          }

          if (operation) {
            tempOperations.coverage[coverage.id!] = tempOperations.coverage[coverage.id!] || [];
            tempOperations.coverage[coverage.id!].push(operation);
          }
        }
        break;
      }

      case 'RelatedPerson': {
        const relatedPerson = findRelevantRelatedPerson(resources, item);

        if (relatedPerson) {
          const currentValue = getCurrentValue(relatedPerson, path);
          if (value !== currentValue) {
            operation = createBasicPatchOperation(value, path, currentValue);
          }

          if (operation) {
            tempOperations.relatedPerson[relatedPerson.id!] = tempOperations.relatedPerson[relatedPerson.id!] || [];
            tempOperations.relatedPerson[relatedPerson.id!].push(operation);
          }
        }
        break;
      }
    }
  });

  // Separate operations for each resource
  // Separate Patient operations
  result.patient = separateResourceUpdates(tempOperations.patient, resources.patient, 'Patient');

  // Prepare Patient direct operations for executing
  result.patient.patchOpsForDirectUpdate = addAuxiliaryPatchOperations(result.patient.patchOpsForDirectUpdate);
  result.patient.patchOpsForDirectUpdate = consolidateOperations(
    result.patient.patchOpsForDirectUpdate,
    resources.patient
  );

  // Separate Coverage operations
  Object.entries(tempOperations.coverage).forEach(([coverageId, ops]) => {
    const coverage = resources.coverages?.find((c) => c.id === coverageId);
    if (coverage) {
      result.coverage[coverageId] = separateResourceUpdates(ops, coverage, 'Coverage');
    }
  });

  // Separate RelatedPerson operations
  Object.entries(tempOperations.relatedPerson).forEach(([relatedPersonId, ops]) => {
    const relatedPerson = resources.relatedPersons?.find((rp) => rp.id === relatedPersonId);
    if (relatedPerson) {
      result.relatedPerson[relatedPersonId] = separateResourceUpdates(ops, relatedPerson, 'RelatedPerson');
    }
  });

  return result;
}

function separateResourceUpdates(
  patchOps: Operation[],
  resource: Patient | Coverage | RelatedPerson,
  resourceType: string
): ResourcePatchOperations {
  const patchOpsForDirectUpdate: Operation[] = [];
  const conflictingUpdates: ConflictingUpdate[] = [];

  patchOps.forEach((patchOp) => {
    if (patchOp.op === 'add' || IGNORE_CREATING_TASKS_FOR_REVIEW) {
      patchOpsForDirectUpdate.push(patchOp);
    } else {
      const currentValue = getCurrentValue(resource, patchOp.path);
      if (!currentValue || currentValue === '') {
        patchOpsForDirectUpdate.push(patchOp);
      } else {
        conflictingUpdates.push({
          operation: patchOp,
          resourceReference: `${resourceType}/${resource.id}`,
        });
      }
    }
  });

  return { patchOpsForDirectUpdate, conflictingUpdates };
}

export function hasConflictingUpdates(operations: MasterRecordPatchOperations): boolean {
  return (
    operations.patient.conflictingUpdates.length > 0 ||
    Object.values(operations.coverage).some((ops) => ops.conflictingUpdates.length > 0) ||
    Object.values(operations.relatedPerson).some((ops) => ops.conflictingUpdates.length > 0)
  );
}

function createBasicPatchOperation(
  value: string | number | boolean | Reference,
  path: string,
  currentValue: string | number | boolean | undefined
): Operation | undefined {
  if (!value || value === '') {
    return currentValue !== undefined ? { op: 'remove', path } : undefined;
  }
  return {
    op: currentValue === undefined ? 'add' : 'replace',
    path,
    value,
  };
}

function findRelevantCoverage(coverages: Coverage[], item: QuestionnaireResponseItem): Coverage | undefined {
  let order: number;
  if (item.linkId.endsWith('-2')) {
    order = 2;
  } else {
    order = 1;
  }

  return coverages.find((c) => c.order === order);
}

function findRelevantRelatedPerson(
  resources: PatientMasterRecordResources,
  item: QuestionnaireResponseItem
): RelatedPerson | undefined {
  let order: number;
  if (item.linkId.endsWith('-2')) {
    order = 2;
  } else {
    order = 1;
  }

  const coverage = resources.coverages?.find((c) => c.order === order);
  if (!coverage?.policyHolder?.reference) return undefined;

  const relatedPersonId = coverage.policyHolder.reference.replace('RelatedPerson/', '');
  return resources.relatedPersons?.find((rp) => rp.id === relatedPersonId);
}

function extractValueFromItem(
  item: QuestionnaireResponseItem
  // insurancePlanResources?: InsurancePlan[],
  // organizationResources?: Organization[]
): string | boolean | Reference | undefined {
  // Handle date components collection
  if (item?.item) {
    const hasDateComponents = item.item.some(
      (i) => i.linkId.endsWith('-dob-year') || i.linkId.endsWith('-dob-month') || i.linkId.endsWith('-dob-day')
    );

    if (hasDateComponents) {
      const dateComponents: DateComponents = {
        year: item.item.find((i) => i.linkId.endsWith('-dob-year'))?.answer?.[0]?.valueString || '',
        month: item.item.find((i) => i.linkId.endsWith('-dob-month'))?.answer?.[0]?.valueString || '',
        day: item.item.find((i) => i.linkId.endsWith('-dob-day'))?.answer?.[0]?.valueString || '',
      };

      return isoStringFromDateComponents(dateComponents);
    }
  }

  const answer = item.answer?.[0];

  // Handle gender answers
  if (item.linkId.endsWith('-birth-sex') && answer?.valueString) {
    return BIRTH_SEX_MAP[answer.valueString];
  }

  // Handle regular answers
  if (!answer) return undefined;
  if ('valueString' in answer) return answer.valueString;
  if ('valueBoolean' in answer) return answer.valueBoolean;
  if ('valueDateTime' in answer) return answer.valueDateTime;
  if ('valueReference' in answer) return answer.valueReference;

  return undefined;
}

function getEffectiveValue(
  resource: PatientMasterRecordResource,
  path: string,
  patchOperations: Operation[]
): string | boolean | number | undefined {
  let effectiveValue = getCurrentValue(resource, path);
  patchOperations.forEach((operation) => {
    if (operation.path === path) {
      switch (operation.op) {
        case 'remove':
          effectiveValue = undefined;
          break;
        case 'replace':
        case 'add':
          effectiveValue = operation.value;
          break;
      }
    }
  });

  return effectiveValue;
}

export function createConflictResolutionTask(
  operations: MasterRecordPatchOperations,
  resources: PatientMasterRecordResources,
  qrId: QuestionnaireResponse['id']
): Task {
  // Collect all conflicts with resource context
  const allConflicts = [
    // Patient conflicts
    ...operations.patient.conflictingUpdates.map((conflict) => ({
      ...conflict,
      resourceType: 'Patient',
      resourceId: resources.patient.id!,
    })),

    // Coverage conflicts
    ...Object.entries(operations.coverage).flatMap(([coverageId, ops]) =>
      ops.conflictingUpdates.map((conflict) => ({
        ...conflict,
        resourceType: 'Coverage',
        resourceId: coverageId,
      }))
    ),

    // RelatedPerson conflicts
    ...Object.entries(operations.relatedPerson).flatMap(([relatedPersonId, ops]) =>
      ops.conflictingUpdates.map((conflict) => ({
        ...conflict,
        resourceType: 'RelatedPerson',
        resourceId: relatedPersonId,
      }))
    ),
  ];

  return {
    resourceType: 'Task',
    status: 'ready',
    intent: 'order',
    description: 'Patient master record information changes',
    requester: {
      type: 'Patient',
      reference: `Patient/${resources.patient.id}`,
    },
    input: allConflicts.map((conflict) => ({
      type: {
        text: getFieldNameWithResource(resources, conflict.resourceType, conflict.resourceId, conflict.operation.path),
      },
      valueString: JSON.stringify({
        operation: conflict.operation,
        resourceReference: conflict.resourceReference,
      }),
    })),
    focus: {
      type: 'QuestionnaireResponse',
      reference: `QuestionnaireResponse/${qrId}`,
    },
  };
}

function getFieldNameWithResource(
  resources: PatientMasterRecordResources,
  resourceType: PatientMasterRecordResourceType,
  resourceId: string,
  path: string
): string {
  let resource: PatientMasterRecordResource | undefined;

  switch (resourceType) {
    case 'Patient':
      resource = resources.patient;
      break;
    case 'Coverage':
      resource = resources.coverages?.find((c) => c.id === resourceId);
      break;
    case 'RelatedPerson':
      resource = resources.relatedPersons?.find((rp) => rp.id === resourceId);
      break;
  }

  if (!resource) {
    return `Unknown field in ${resourceType}`;
  }

  // Get human-readable field name
  const fullPath = `${resourceType}${path}`;
  const fieldName = getFieldName(resource, fullPath);

  // Add context about which resource it belongs to
  switch (resourceType) {
    case 'Patient':
      return `Patient: ${fieldName}`;
    case 'Coverage': {
      const coverage = resource as Coverage;
      const coverageContext = coverage.order === 1 ? 'Primary' : 'Secondary';
      return `${coverageContext} Coverage: ${fieldName}`;
    }
    case 'RelatedPerson':
      return `Related Person: ${fieldName}`;
    default:
      return fieldName;
  }
}

function getFieldName(resource: PatientMasterRecordResource, path: string): string {
  if (path.includes('/extension/')) {
    const extensionIndex = path.replace('/extension/', '');
    if (!isNaN(Number(extensionIndex))) {
      const extension = resource.extension?.[Number(extensionIndex)];
      if (extension?.url) {
        path = `${resource.resourceType}/extension/${extension.url}`;
      }
    }
  }

  return pathToLinkIdMap[path] || 'unknown-field';
}

interface InsuranceResources {
  coverage?: Partial<Coverage>[];
  relatedPerson?: Partial<RelatedPerson>[];
}

function hasInsuranceAnswers(paperwork: QuestionnaireResponseItem[], isSecondary: boolean): boolean {
  const relevantLinkIds = isSecondary ? SECONDARY_INSURANCE_LINK_IDS : PRIMARY_INSURANCE_LINK_IDS;

  // Check if there's at least one answered field from the relevant insurance fields
  return paperwork.some((item) => relevantLinkIds.includes(item.linkId) && item.answer?.[0] !== undefined);
}

function hasPolicyHolderAnswers(paperwork: QuestionnaireResponseItem[], isSecondary: boolean): boolean {
  const relevantLinkIds = isSecondary ? SECONDARY_POLICY_HOLDER_LINK_IDS : PRIMARY_POLICY_HOLDER_LINK_IDS;

  // Check if there's at least one answered field from the relevant policy holder fields
  return paperwork.some((item) => relevantLinkIds.includes(item.linkId) && item.answer?.[0] !== undefined);
}

interface CreateMasterRecordInput {
  questionnaireResponse: QuestionnaireResponse;
  resources: PatientMasterRecordResources;
  insurancePlanResources: InsurancePlan[];
  organizationResources: Organization[];
}

export function createInsuranceResources(input: CreateMasterRecordInput): InsuranceResources {
  const { questionnaireResponse, resources, insurancePlanResources, organizationResources } = input;

  const flattenedPaperwork = flattenIntakeQuestionnaireItems(
    questionnaireResponse.item as IntakeQuestionnaireItem[]
  ) as QuestionnaireResponseItem[];

  const result: InsuranceResources = {};

  // Check primary insurance
  const hasPrimaryInsurance = hasInsuranceAnswers(flattenedPaperwork, false);
  const primaryCoverageExists = resources.coverages?.some((c) => c.order === 1 && c.status === 'active');
  const hasPrimaryPolicyHolder = hasPolicyHolderAnswers(flattenedPaperwork, false);
  const primaryRelatedPersonExists = findRelatedPersonForCoverage(resources, 1);

  // Check secondary insurance
  const hasSecondaryInsurance = hasInsuranceAnswers(flattenedPaperwork, true);
  const secondaryCoverageExists = resources.coverages?.some((c) => c.order === 2 && c.status === 'active');
  const hasSecondaryPolicyHolder = hasPolicyHolderAnswers(flattenedPaperwork, true);
  const secondaryRelatedPersonExists = findRelatedPersonForCoverage(resources, 2);

  const primaryPolicyHolderId = uuid();
  const secondaryPolicyHolderId = uuid();

  // Create Coverage resources
  const newCoverages: Partial<Coverage>[] = [];

  if (hasPrimaryInsurance && !primaryCoverageExists) {
    const primaryCoverage = createCoverageResource(
      flattenedPaperwork,
      resources.patient.id!,
      1,
      primaryPolicyHolderId,
      insurancePlanResources,
      organizationResources
    );
    if (primaryCoverage) newCoverages.push(primaryCoverage);
  }

  if (hasSecondaryInsurance && !secondaryCoverageExists) {
    const secondaryCoverage = createCoverageResource(
      flattenedPaperwork,
      resources.patient.id!,
      2,
      secondaryPolicyHolderId,
      insurancePlanResources,
      organizationResources
    );
    if (secondaryCoverage) newCoverages.push(secondaryCoverage);
  }

  if (newCoverages.length > 0) {
    result.coverage = newCoverages;
  }

  // Create RelatedPerson resources
  const newRelatedPersons: Partial<RelatedPerson>[] = [];
  if (hasPrimaryPolicyHolder && !primaryRelatedPersonExists) {
    const primaryRelatedPerson = createRelatedPersonResource(
      flattenedPaperwork,
      resources.patient.id!,
      primaryPolicyHolderId,
      false
    );
    if (primaryRelatedPerson) newRelatedPersons.push(primaryRelatedPerson);
  }

  if (hasSecondaryPolicyHolder && !secondaryRelatedPersonExists) {
    const secondaryRelatedPerson = createRelatedPersonResource(
      flattenedPaperwork,
      resources.patient.id!,
      secondaryPolicyHolderId,
      true
    );
    if (secondaryRelatedPerson) newRelatedPersons.push(secondaryRelatedPerson);
  }

  if (newRelatedPersons.length > 0) {
    result.relatedPerson = newRelatedPersons;
  }

  return result;
}

function findRelatedPersonForCoverage(
  resources: PatientMasterRecordResources,
  order: number
): RelatedPerson | undefined {
  const coverage = resources.coverages?.find((c) => c.order === order && c.status === 'active');
  if (!coverage?.subscriber?.reference) return undefined;

  const relatedPersonId = coverage.subscriber.reference.replace('RelatedPerson/', '');
  return resources.relatedPersons?.find((rp) => rp.id === relatedPersonId);
}

export async function searchInsuranceInformation(
  oystehr: Oystehr,
  insurancePlans: string[]
): Promise<(InsurancePlan | Organization)[]> {
  const requests: string[] = [];
  insurancePlans.forEach((insurancePlan) => {
    const id = insurancePlan.split('/')[1];
    requests.push(`/InsurancePlan?_id=${id}&_include=InsurancePlan:owned-by`);
  });

  return (await getResourcesFromBatchInlineRequests(oystehr, requests)) as unknown as Promise<
    (InsurancePlan | Organization)[]
  >;
}

function createCoverageResource(
  paperwork: QuestionnaireResponseItem[],
  patientId: string,
  order: number,
  policyHolderId: string,
  insurancePlanResources: InsurancePlan[],
  organizationResources: Organization[]
): Partial<Coverage> | undefined {
  console.log('building a new coverage resource');
  const isSecondary = order === 2;

  const coverage: Partial<Coverage> = {
    resourceType: 'Coverage',
    status: 'active',
    subscriber: {
      reference: `RelatedPerson/${policyHolderId}`,
    },
    order,
    beneficiary: {
      type: 'Patient',
      reference: `Patient/${patientId}`,
    },
    type: {
      coding: [INSURANCE_COVERAGE_CODING],
    },
  };

  let hasValues = false;

  paperwork.forEach((item) => {
    const baseFieldId = item.linkId.replace(/-2$/, '');
    const matchesOrder = item.linkId.endsWith('-2') === isSecondary;
    if (!matchesOrder) return;

    const fullPath = paperworkToPatientFieldMap[baseFieldId];
    if (!fullPath) return;

    const { resourceType, path } = extractResourceTypeAndPath(fullPath);
    if (resourceType !== 'Coverage') return;

    const value = extractValueFromItem(item);
    if (value === undefined) return;

    // Special handling for relationship
    if (baseFieldId === 'patient-relationship-to-insured') {
      const relationshipCode = SUBSCRIBER_RELATIONSHIP_CODE_MAP[value as string] || 'other';
      // Remove '/display' from the path to set the entire coding object
      const relationshipPath = path.replace(/\/display$/, '');
      setValueByPath(coverage, relationshipPath, {
        system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
        code: relationshipCode,
        display: value,
      });
      hasValues = true;
      return;
    }

    // Special handling for insurance carrier
    if (baseFieldId === 'insurance-carrier') {
      // Find matching insurance plan by name
      const insurancePlan = insurancePlanResources.find(
        (plan) => plan.id === (value as Reference).reference?.replace('InsurancePlan/', '')
      );
      if (insurancePlan?.ownedBy?.reference) {
        // Add payor reference
        coverage.payor = [insurancePlan?.ownedBy];

        // Get organization ID from the reference
        const organizationId = insurancePlan.ownedBy.reference.replace('Organization/', '');

        // Find the organization
        const organization = organizationResources.find((org) => org.id === organizationId);

        // Find payer-id identifier
        const payerId = organization?.identifier
          ?.find((identifier) => identifier.type?.coding?.some((coding) => coding.system === 'payer-id'))
          ?.type?.coding?.find((coding) => coding.system === 'payer-id')?.code;

        if (payerId) {
          // Add coverage class
          coverage.class = [
            {
              type: {
                coding: [
                  {
                    system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
                    code: 'plan',
                  },
                ],
              },
              value: payerId,
              name: organization.name,
            },
          ];
        }
      }

      hasValues = true;
      return;
    }

    setValueByPath(coverage, path, value);
    hasValues = true;

    // Additional handling for identifier
    if (baseFieldId === 'insurance-member-id') {
      setValueByPath(coverage, '/subscriberId', value);
    }
  });

  return hasValues ? coverage : undefined;
}

function createRelatedPersonResource(
  paperwork: QuestionnaireResponseItem[],
  patientId: string,
  id: string,
  isSecondary: boolean
): Partial<RelatedPerson> | undefined {
  console.log('building a RelatedPerson resource for policy holder');
  const relatedPerson: Partial<RelatedPerson> = {
    resourceType: 'RelatedPerson',
    id,
    patient: {
      reference: `Patient/${patientId}`,
    },
  };

  let hasValues = false;

  paperwork.forEach((item) => {
    // Only process items that match the policy holder type (primary/secondary)
    const isItemSecondary = item.linkId.endsWith('-2');
    if (isItemSecondary !== isSecondary) return;

    const baseFieldId = item.linkId.replace(/-2$/, '');
    const fullPath = paperworkToPatientFieldMap[baseFieldId];
    if (!fullPath) return;

    const { resourceType, path } = extractResourceTypeAndPath(fullPath);
    if (resourceType !== 'RelatedPerson') return;

    const value = extractValueFromItem(item);
    if (value === undefined) return;

    // Special handling for relationship
    if (baseFieldId === 'patient-relationship-to-insured') {
      const relationshipCode = SUBSCRIBER_RELATIONSHIP_CODE_MAP[value as string] || 'other';
      // Remove '/display' from the path to set the entire coding object
      const relationshipPath = relatedPersonFieldPaths.relationship.replace(/\/display$/, '');
      setValueByPath(relatedPerson, relationshipPath, {
        system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
        code: relationshipCode,
        display: value,
      });
      hasValues = true;
      return;
    }

    // Special handling for extension
    if (baseFieldId === 'policy-holder-address-as-patient') {
      relatedPerson.extension = [
        {
          url: RELATED_PERSON_SAME_AS_PATIENT_ADDRESS_URL,
          valueBoolean: value as boolean,
        },
      ];
      hasValues = true;
      return;
    }

    setValueByPath(relatedPerson, path, value);
    hasValues = true;
  });

  return hasValues ? relatedPerson : undefined;
}

function setValueByPath(obj: any, path: string, value: any): void {
  const parts = path.split('/').filter((p) => p);
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isNextPartArrayIndex = !isNaN(Number(nextPart));

    if (!(part in current)) {
      // If the next part is a number, initialize as array, otherwise as object
      current[part] = isNextPartArrayIndex ? [] : {};
    }

    current = current[part];

    // If we're at an array index, ensure the element exists
    if (isNextPartArrayIndex) {
      const index = Number(nextPart);
      if (!Array.isArray(current)) {
        current = [];
      }
      // Initialize array elements up to the required index
      while (current.length <= index) {
        current.push({});
      }
    }
  }

  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

function addAuxiliaryPatchOperations(operations: Operation[]): Operation[] {
  const auxOperations: Operation[] = [];

  // Add required link to contained Practitioner resource
  if (operations.some((op) => op.path && op.path.includes('contained'))) {
    const addResourceTypeOperation: AddOperation<any> = {
      op: 'add',
      path: '/contained/0/resourceType',
      value: 'Practitioner',
    };
    auxOperations.push(addResourceTypeOperation);

    const addGeneralPractitionerOperation: AddOperation<any> = {
      op: 'add',
      path: '/generalPractitioner',
      value: {
        reference: '#primary-care-physician',
      },
    };
    auxOperations.push(addGeneralPractitionerOperation);

    const addPractitionerIdOperation: AddOperation<any> = {
      op: 'add',
      path: '/contained/0/id',
      value: 'primary-care-physician',
    };
    auxOperations.push(addPractitionerIdOperation);
    const addPractitionerActiveStatusOperation: AddOperation<any> = {
      op: 'add',
      path: '/contained/0/active',
      value: true,
    };
    auxOperations.push(addPractitionerActiveStatusOperation);
  }

  return [...operations, ...auxOperations];
}

export function createErxContactOperation(
  relatedPerson: RelatedPerson,
  patientResource: Patient
): Operation | undefined {
  const verifiedPhoneNumber = getPhoneNumberForIndividual(relatedPerson);
  console.log(`patient verified phone number ${verifiedPhoneNumber}`);

  console.log('reviewing patient erx contact telecom phone nubmber');
  // find existing erx contact info and it's index so that the contact array can be updated
  const erxContactIdx = patientResource?.contact?.findIndex((contact) =>
    Boolean(
      contact.telecom?.find((telecom) =>
        Boolean(telecom?.extension?.find((telExt) => telExt.url === FHIR_EXTENSION.ContactPoint.erxTelecom.url))
      )
    )
  );

  let updateErxContact = false;
  const erxContact = erxContactIdx && erxContactIdx >= 0 ? patientResource?.contact?.[erxContactIdx] : undefined;
  const erxTelecom =
    erxContact &&
    erxContact.telecom?.find((telecom) =>
      Boolean(telecom?.extension?.find((telExt) => telExt.url === FHIR_EXTENSION.ContactPoint.erxTelecom.url))
    );

  if (erxContactIdx && erxContactIdx >= 0) {
    if (!(erxTelecom && erxTelecom.system === 'phone' && erxTelecom.value === verifiedPhoneNumber)) {
      updateErxContact = true;
    }
  } else {
    updateErxContact = true;
  }

  if (updateErxContact) {
    const erxContactTelecom: ContactPoint = {
      value: verifiedPhoneNumber,
      system: 'phone',
      extension: [{ url: FHIR_EXTENSION.ContactPoint.erxTelecom.url, valueString: 'erx' }],
    };
    if (erxContactIdx && erxContactIdx >= 0) {
      console.log('building patient patch operations: update patient erx contact telecom');
      return {
        op: 'replace',
        path: `/contact/${erxContactIdx}`,
        value: {
          telecom: [erxContactTelecom],
        },
      };
    } else {
      console.log('building patient patch operations: add patient erx contact telecom');
      return {
        op: 'add',
        path: `/contact/-`,
        value: {
          telecom: [erxContactTelecom],
        },
      };
    }
  }

  return undefined;
}
