import Oystehr, { BatchInputPatchRequest, BatchInputPostRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { AddOperation, Operation } from 'fast-json-patch';
import {
  Account,
  AccountGuarantor,
  Address,
  Attachment,
  CodeableConcept,
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
  relatedPersonFieldPaths,
  SCHOOL_WORK_NOTE_SCHOOL_ID,
  SCHOOL_WORK_NOTE_TEMPLATE_CODE,
  SCHOOL_WORK_NOTE_WORK_ID,
  SUBSCRIBER_RELATIONSHIP_CODE_MAP,
  uploadPDF,
  LanguageOption,
  getPatchOperationToAddOrUpdatePreferredLanguage,
  createFhirHumanName,
  mapBirthSexToGender,
  createCoverageMemberIdentifier,
  getMemberIdFromCoverage,
  getFullName,
  deduplicateContactPoints,
  isValidUUID,
  deduplicateIdentifiers,
  deduplicateObjectsByStrictKeyValEquality,
  flattenItems,
  deduplicateUnbundledResources,
  takeContainedOrFind,
} from 'utils';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';
import { createOrUpdateFlags } from '../../../paperwork/sharedHelpers';
import { createPdfBytes } from '../../../shared/pdf';
import _ from 'lodash';

const IGNORE_CREATING_TASKS_FOR_REVIEW = true;

interface ResponsiblePartyContact {
  birthSex: 'Male' | 'Female' | 'Intersex';
  dob: string;
  firstName: string;
  lastName: string;
  relationship: 'Self' | 'Spouse' | 'Parent' | 'Legal Guardian' | 'Other';

  number?: string;
}

interface PolicyHolder {
  address: Address;
  birthSex: 'Male' | 'Female' | 'Intersex';
  dob: string;
  firstName: string;
  lastName: string;
  memberId: string;
  relationship: 'Self' | 'Child' | 'Parent' | 'Spouse' | 'Common Law Spouse' | 'Injured Party' | 'Other';

  number?: string;
  email?: string;
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
  'preferred-language': patientFieldPaths.preferredLanguage,
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

/*
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
*/

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
  //relatedPersons?: RelatedPerson[];
  //coverages?: Coverage[];
}

export function createMasterRecordPatchOperations(
  questionnaireResponse: QuestionnaireResponse,
  patient: Patient
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

    switch (resourceType) {
      case 'Patient': {
        // Handle telecom fields
        const contactTelecomConfig = contactTelecomConfigs[item.linkId];
        if (contactTelecomConfig) {
          const operation = createPatchOperationForTelecom(
            value as string | boolean,
            contactTelecomConfig,
            patient,
            path
          );
          if (operation) tempOperations.patient.push(operation);
          return;
        }

        // Handle extensions
        if (path.startsWith('/extension/')) {
          const url = path.replace('/extension/', '');
          const currentValue = getCurrentValue(patient, path);
          if (value !== currentValue) {
            let operation: Operation | undefined;
            if (value === '') {
              if (currentValue !== undefined && currentValue !== null) {
                operation = getPatchOperationToRemoveExtension(patient, { url });
              }
            } else {
              operation = getPatchOperationToAddOrUpdateExtension(patient, { url, value: String(value) }, currentValue);
            }
            if (operation) tempOperations.patient.push(operation);
          }
          return;
        }

        // Special handler for preferred-language
        if (item.linkId === 'preferred-language') {
          const currentValue = patient.communication?.find((lang) => lang.preferred)?.language.coding?.[0].display;
          if (value !== currentValue) {
            const operation = getPatchOperationToAddOrUpdatePreferredLanguage(
              value as LanguageOption,
              path,
              patient,
              currentValue as LanguageOption
            );

            if (operation) tempOperations.patient.push(operation);
          }
          return;
        }

        // Handle array fields
        const { isArray, parentPath } = getArrayInfo(path);
        if (isArray) {
          const effectiveArrayValue = getEffectiveValue(patient, parentPath, tempOperations.patient);
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
            const operation: Operation =
              cleanArray.length > 0
                ? {
                    op: effectiveArrayValue === undefined ? 'add' : 'replace',
                    path: arrayPath,
                    value: cleanArray,
                  }
                : {
                    op: 'remove',
                    path: arrayPath,
                  };
            tempOperations.patient.push(operation);
          }
          return;
        }

        // TODO: make handler for nested extensions
        // Special handler for responsible-party-date-of-birth
        if (item.linkId === 'responsible-party-date-of-birth') {
          const url = DATE_OF_BIRTH_URL;
          const currentValue = getCurrentValue(patient, path);
          if (value !== currentValue) {
            tempOperations.patient.push({
              op: 'add',
              path: '/contact/0/extension',
              value: [
                {
                  url: url,
                  valueString: value,
                },
              ],
            });
          }
          return;
        }
        // Special handler for practice-name
        if (item.linkId === 'pcp-practice') {
          const url = PRACTICE_NAME_URL;
          const currentValue = getCurrentValue(patient, path);
          if (value !== currentValue) {
            tempOperations.patient.push({
              op: 'add',
              path: '/contained/0/extension',
              value: [
                {
                  url: url,
                  valueString: value,
                },
              ],
            });
          }
          return;
        }

        // Handle regular fields
        const currentValue = getCurrentValue(patient, path);
        if (value !== currentValue) {
          const operation = createBasicPatchOperation(value, path, currentValue);
          if (operation) tempOperations.patient.push(operation);
        }
        break;
      }
    }
  });

  // Separate operations for each resource
  // Separate Patient operations
  result.patient = separateResourceUpdates(tempOperations.patient, patient, 'Patient');
  result.patient.patchOpsForDirectUpdate = addAuxiliaryPatchOperations(result.patient.patchOpsForDirectUpdate, patient);
  result.patient.patchOpsForDirectUpdate = result.patient.patchOpsForDirectUpdate.filter((op) => {
    const { path, op: oper } = op;
    return path != undefined && oper != undefined;
  });
  result.patient.patchOpsForDirectUpdate = consolidateOperations(result.patient.patchOpsForDirectUpdate, patient);

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

function extractValueFromItem(
  item: QuestionnaireResponseItem
  // insurancePlanResources?: InsurancePlan[],
  // organizationResources?: Organization[]
): string | boolean | Reference | undefined {
  // Handle date components collection
  if (item?.item) {
    const hasDateComponents = item.item.some(
      (i) => i.linkId.includes('-dob-year') || i.linkId.includes('-dob-month') || i.linkId.includes('-dob-day')
    );

    if (hasDateComponents) {
      const dateComponents: DateComponents = {
        year: item.item.find((i) => i.linkId.includes('-dob-year'))?.answer?.[0]?.valueString || '',
        month: item.item.find((i) => i.linkId.includes('-dob-month'))?.answer?.[0]?.valueString || '',
        day: item.item.find((i) => i.linkId.includes('-dob-day'))?.answer?.[0]?.valueString || '',
      };

      return isoStringFromDateComponents(dateComponents);
    }
  }

  const answer = item.answer?.[0];

  // Handle gender answers
  if (item.linkId.includes('-birth-sex') && answer?.valueString) {
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

interface OrderedCoverages {
  primary?: Coverage;
  secondary?: Coverage;
}

interface GetCoveragesInput {
  questionnaireResponse: QuestionnaireResponse;
  patientId: string;
  insurancePlanResources: InsurancePlan[];
  organizationResources: Organization[];
}

interface GetCoverageResourcesResult {
  orderedCoverages: OrderedCoverages;
  accountCoverage: Account['coverage'];
}

// this function is exported for testing purposes
export const getCoverageResources = (input: GetCoveragesInput): GetCoverageResourcesResult => {
  const newCoverages: OrderedCoverages = {};
  const { questionnaireResponse, insurancePlanResources, organizationResources, patientId } = input;
  const flattenedPaperwork = flattenIntakeQuestionnaireItems(
    questionnaireResponse.item as IntakeQuestionnaireItem[]
  ) as QuestionnaireResponseItem[];
  // Check primary insurance
  const primaryPolicyHolder = getPrimaryPolicyHolderFromAnswers(flattenedPaperwork);
  const primaryInsuranceDetails = getInsuranceDetailsFromAnswers(
    flattenedPaperwork,
    insurancePlanResources,
    organizationResources
  );

  // Check secondary insurance
  const secondaryPolicyHolder = getSecondaryPolicyHolderFromAnswers(flattenedPaperwork);
  const secondaryInsuranceDetails = getInsuranceDetailsFromAnswers(
    flattenedPaperwork,
    insurancePlanResources,
    organizationResources,
    '-2'
  );

  let primaryInsurance: CreateCoverageResourceInput['insurance'] | undefined;
  let secondaryInsurance: CreateCoverageResourceInput['insurance'] | undefined;

  if (primaryPolicyHolder && primaryInsuranceDetails) {
    primaryInsurance = {
      policyHolder: primaryPolicyHolder,
      ...primaryInsuranceDetails,
    };
  }
  if (secondaryPolicyHolder && secondaryInsuranceDetails) {
    secondaryInsurance = {
      policyHolder: secondaryPolicyHolder,
      ...secondaryInsuranceDetails,
    };
  }

  if (primaryInsurance) {
    const primaryCoverage = createCoverageResource({
      patientId,
      order: 1,
      insurance: {
        ...primaryInsurance,
      },
    });
    newCoverages.primary = primaryCoverage;
  }

  if (secondaryInsurance) {
    const secondaryCoverage = createCoverageResource({
      patientId,
      order: 2,
      insurance: {
        ...secondaryInsurance,
      },
    });
    newCoverages.secondary = secondaryCoverage;
  }
  let coverage: Account['coverage'] | undefined;
  if (newCoverages.primary || newCoverages.secondary) {
    coverage = [];
    if (newCoverages.primary) {
      coverage.push({
        coverage: { reference: newCoverages.primary.id },
        priority: 1,
      });
    }
    if (newCoverages.secondary) {
      coverage.push({
        coverage: { reference: newCoverages.secondary.id },
        priority: 2,
      });
    }
  }
  return { orderedCoverages: newCoverages, accountCoverage: coverage };
};

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

// the following 3 functions are exported for testing purposes; not expected to be called outside this file but for unit testing
// note: this function assumes items have been flattened before being passed in
export const getPrimaryPolicyHolderFromAnswers = (items: QuestionnaireResponseItem[]): PolicyHolder | undefined => {
  return extractPolicyHolder(items);
};

// note: this function assumes items have been flattened before being passed in
export const getSecondaryPolicyHolderFromAnswers = (items: QuestionnaireResponseItem[]): PolicyHolder | undefined => {
  return extractPolicyHolder(items, '-2');
};

// note: this function assumes items have been flattened before being passed in
const extractPolicyHolder = (items: QuestionnaireResponseItem[], keySuffix?: string): PolicyHolder | undefined => {
  const findAnswer = (linkId: string): string | undefined =>
    items.find((item) => item.linkId === linkId)?.answer?.[0]?.valueString;

  const suffix = keySuffix ? `${keySuffix}` : '';
  const contact: any = {
    birthSex: findAnswer(`policy-holder-birth-sex${suffix}`) as 'Male' | 'Female' | 'Intersex',
    dob: findAnswer(`policy-holder-date-of-birth${suffix}`) ?? '',
    firstName: findAnswer(`policy-holder-first-name${suffix}`) ?? '',
    lastName: findAnswer(`policy-holder-last-name${suffix}`) ?? '',
    number: findAnswer(`policy-holder-number${suffix}`),
    email: findAnswer(`policy-holder-email${suffix}`),
    memberId: findAnswer(`insurance-member-id${suffix}`) ?? '',
    relationship: findAnswer(`patient-relationship-to-insured${suffix}`) as
      | 'Self'
      | 'Spouse'
      | 'Parent'
      | 'Legal Guardian'
      | 'Other',
  };
  const address = {
    line: [
      findAnswer(`policy-holder-address${suffix}`) ?? '',
      findAnswer(`policy-holder-address-additional-line${suffix}`) ?? '',
    ].filter(Boolean),
    city: findAnswer(`policy-holder-city${suffix}`) ?? '',
    state: findAnswer(`policy-holder-state${suffix}`) ?? '',
    postalCode: findAnswer(`policy-holder-zip${suffix}`) ?? '',
  };

  if (address.line.length > 0 || address.city || address.state || address.postalCode) {
    contact.address = address as Address;
  }
  if (
    contact.firstName &&
    contact.lastName &&
    contact.dob &&
    contact.birthSex &&
    contact.relationship &&
    contact.memberId
  ) {
    return contact;
  }
  return undefined;
};

// note: this function assumes items have been flattened before being passed in
// this function is exported for testing purposes; not expected to be called outside this file but for unit testing
export function extractAccountGuarantor(items: QuestionnaireResponseItem[]): ResponsiblePartyContact | undefined {
  const findAnswer = (linkId: string): string | undefined =>
    items.find((item) => item.linkId === linkId)?.answer?.[0]?.valueString;

  const contact: ResponsiblePartyContact = {
    birthSex: findAnswer('responsible-party-birth-sex') as 'Male' | 'Female' | 'Intersex',
    dob: findAnswer('responsible-party-date-of-birth') ?? '',
    firstName: findAnswer('responsible-party-first-name') ?? '',
    lastName: findAnswer('responsible-party-last-name') ?? '',
    relationship: findAnswer('responsible-party-relationship') as
      | 'Self'
      | 'Spouse'
      | 'Parent'
      | 'Legal Guardian'
      | 'Other',
    number: findAnswer('responsible-party-number'),
  };

  if (contact.firstName && contact.lastName && contact.dob && contact.birthSex && contact.relationship) {
    return contact;
  }
  return contact;
}

// note: this function assumes items have been flattened before being passed in
function getInsuranceDetailsFromAnswers(
  answers: QuestionnaireResponseItem[],
  insurancePlans: InsurancePlan[],
  organizations: Organization[],
  keySuffix?: string
): { plan: InsurancePlan; org: Organization } | undefined {
  const suffix = keySuffix ? `${keySuffix}` : '';
  const insurancePlanReference = answers.find((item) => item.linkId === `insurance-carrier${suffix}`)?.answer?.[0]
    ?.valueReference;
  if (!insurancePlanReference) return undefined;

  const plan = insurancePlans.find((plan) => plan.id === insurancePlanReference.reference?.split('/')[1]);
  if (!plan) return undefined;

  const orgReference = plan.ownedBy?.reference;
  const org = organizations.find((org) => org.id === orgReference?.split('/')[1]);
  if (!org) return undefined;

  return { plan, org };
}

interface CreateCoverageResourceInput {
  patientId: string;
  order: number;
  insurance: {
    org: Organization;
    plan: InsurancePlan;
    policyHolder: PolicyHolder;
  };
}
const createCoverageResource = (input: CreateCoverageResourceInput): Coverage => {
  const { patientId, insurance } = input;
  const { org, plan, policyHolder } = insurance;
  const memberId = policyHolder.memberId;

  const policyHolderId = 'coverageSubscriber';
  const policyHolderName = createFhirHumanName(policyHolder.firstName, undefined, policyHolder.lastName);
  const relationshipCode = SUBSCRIBER_RELATIONSHIP_CODE_MAP[policyHolder.relationship] || 'other';
  const containedPolicyHolder: RelatedPerson = {
    resourceType: 'RelatedPerson',
    id: policyHolderId,
    name: policyHolderName ? policyHolderName : undefined,
    birthDate: policyHolder.dob,
    gender: mapBirthSexToGender(policyHolder.birthSex),
    patient: { reference: `Patient/${patientId}` },
    address: [policyHolder.address],
    relationship: [
      {
        coding: [
          {
            system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
            code: relationshipCode,
            display: policyHolder.relationship,
          },
        ],
      },
    ],
  };

  const coverage: Coverage = {
    contained: [containedPolicyHolder],
    id: `urn:uuid:${randomUUID()}`,
    identifier: [createCoverageMemberIdentifier(memberId, org)],
    resourceType: 'Coverage',
    status: 'active',
    subscriber: {
      reference: `#${policyHolderId}`,
    },
    beneficiary: {
      type: 'Patient',
      reference: `Patient/${patientId}`,
    },
    type: {
      coding: [INSURANCE_COVERAGE_CODING],
    },
    payor: [{ reference: `Organization/${org.id}` }],
    subscriberId: policyHolder.memberId,
    relationship: getPolicyHolderRelationshipCodeableConcept(policyHolder.relationship),
    class: [
      {
        type: {
          coding: [
            {
              system: 'http://terminology.hl7.org/CodeSystem/coverage-class',
              code: 'plan',
            },
          ],
        },
        value: `InsurancePlan/${plan.id}`, // not sure what to put here. will put ref to insurance plan for now
        name: `${org.name ?? ''}`,
      },
    ],
  };

  return coverage;
};

function addAuxiliaryPatchOperations(operations: Operation[], patient: Patient): Operation[] {
  const auxOperations: Operation[] = [];

  // Add required link to contained Practitioner resource
  if (operations.some((op) => op.path && op.path.includes('contained'))) {
    const addResourceTypeOperation: AddOperation<any> = {
      op: 'add',
      path: '/contained/0/resourceType',
      value: 'Practitioner',
    };
    auxOperations.push(addResourceTypeOperation);

    if (!patient.generalPractitioner) {
      const addGeneralPractitionerOperation: AddOperation<any> = {
        op: 'add',
        path: '/generalPractitioner',
        value: {
          reference: '#primary-care-physician',
        },
      };
      auxOperations.push(addGeneralPractitionerOperation);
    }

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

export interface GetAccountOperationsInput {
  patient: Patient;
  questionnaireResponseItem: QuestionnaireResponse['item'];
  insurancePlanResources: InsurancePlan[];
  organizationResources: Organization[];
  existingCoverages: OrderedCoveragesWithSubscribers;
  existingGuarantorResource?: RelatedPerson | Patient;
  existingAccount?: Account;
}

export interface GetAccountOperationsOutput {
  coveragePosts: BatchInputPostRequest<Coverage>[];
  patch: BatchInputPatchRequest<Coverage | RelatedPerson | Account>[];
  accountPost?: Account;
}

// this function is exported for testing purposes
export const getAccountOperations = (input: GetAccountOperationsInput): GetAccountOperationsOutput => {
  const {
    patient,
    existingCoverages,
    questionnaireResponseItem,
    existingGuarantorResource,
    insurancePlanResources,
    organizationResources,
    existingAccount,
  } = input;

  if (!patient.id) {
    throw new Error('Patient resource must have an id');
  }

  const flattenedItems = flattenItems(questionnaireResponseItem ?? []);

  const guarantorData = extractAccountGuarantor(flattenedItems);
  if (!guarantorData) {
    console.log('no guarantor data could be extracted from questionnaire response');
    return { patch: [], coveragePosts: [], accountPost: undefined };
  }
  const { orderedCoverages: questionnaireCoverages } = getCoverageResources({
    questionnaireResponse: {
      item: flattenedItems,
    } as QuestionnaireResponse,
    patientId: patient.id!,
    insurancePlanResources,
    organizationResources,
  });

  const patch: BatchInputPatchRequest<Coverage | RelatedPerson | Account>[] = [];
  const coveragePosts: BatchInputPostRequest<Coverage>[] = [];
  let accountPost: Account | undefined;
  console.log(
    'getting account operations for patient, guarantorData, coverages, account',
    JSON.stringify(patient, null, 2),
    JSON.stringify(guarantorData, null, 2),
    JSON.stringify(existingCoverages, null, 2),
    JSON.stringify(existingAccount, null, 2)
  );

  // note: We're not assuming existing Coverages, if there are any, come from the Account resource; they could be free-floating.
  // If the existingAccount does reference Coverages, those Coverage resources will be fetched up using the references on
  // the existingAccount and passed in here separately via the existingCoverages parameter.

  const { suggestedNewCoverageObject, deactivatedCoverages, coverageUpdates, relatedPersonUpdates } =
    resolveCoverageUpdates({
      existingCoverages,
      newCoverages: questionnaireCoverages,
    });
  //accountOfRecord.coverage = suggestedNewCoverageObject;
  deactivatedCoverages.forEach((cov) => {
    patch.push({
      method: 'PATCH',
      url: `Coverage/${cov.id}`,
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: 'cancelled',
        },
      ],
    });
  });
  Object.entries(coverageUpdates).forEach(([coverageId, operations]) => {
    if (operations.length) {
      patch.push({
        method: 'PATCH',
        url: `Coverage/${coverageId}`,
        operations,
      });
    }
  });
  Object.entries(relatedPersonUpdates).forEach(([relatedPersonId, operations]) => {
    if (operations.length) {
      patch.push({
        method: 'PATCH',
        url: `RelatedPerson/${relatedPersonId}`,
        operations,
      });
    }
  });

  // create Coverage BatchInputPostRequests for either of the Coverages found on Ordered coverage that are also referenced suggestedNewCaverageObject
  // and add them to the coveragePosts array

  Object.entries(questionnaireCoverages).forEach(([_key, coverage]) => {
    if (coverage && suggestedNewCoverageObject?.some((cov) => cov.coverage?.reference === coverage.id)) {
      coveragePosts.push({
        method: 'POST',
        fullUrl: coverage.id,
        url: 'Coverage',
        resource: { ...coverage, id: undefined },
      });
    }
  });

  if (existingAccount === undefined) {
    const { guarantors, contained } = resolveGuarantor({
      patientId: patient.id!,
      guarantorFromQuestionnaire: guarantorData,
      existingGuarantorResource: patient,
      existingGuarantorReferences: [],
    });
    const newAccount = createAccount({
      patientId: patient.id!,
      guarantor: guarantors,
      coverage: suggestedNewCoverageObject,
      contained,
    });
    accountPost = newAccount;
  } else {
    const { guarantors, contained } = resolveGuarantor({
      patientId: patient.id!,
      guarantorFromQuestionnaire: guarantorData,
      existingGuarantorResource: existingGuarantorResource ?? patient,
      existingGuarantorReferences: existingAccount.guarantor ?? [],
    });

    const operations: Operation[] = [];

    if (!_.isEqual(guarantors, existingAccount.guarantor)) {
      operations.push({
        op: existingAccount.guarantor ? 'replace' : 'add',
        path: '/guarantor',
        value: guarantors,
      });
    }
    if (!_.isEqual(contained, existingAccount.contained)) {
      operations.push({
        op: existingAccount.contained ? 'replace' : 'add',
        path: '/contained',
        value: contained,
      });
    }

    if (!_.isEqual(suggestedNewCoverageObject, existingAccount.coverage)) {
      operations.push({
        op: 'replace',
        path: '/coverage',
        value: suggestedNewCoverageObject,
      });
    }

    if (operations.length) {
      patch.push({
        method: 'PATCH',
        url: `Account/${existingAccount.id}`,
        operations,
      });
    }
  }

  return {
    coveragePosts,
    accountPost,
    patch,
  };
};

interface CreateAccountInput {
  patientId: string;
  coverage: Account['coverage'];
  guarantor: AccountGuarantor[];
  contained: Account['contained'];
  ///guarantor: ResponsiblePartyContact;
}
// this function is exported for testing purposes
export const createAccount = (input: CreateAccountInput): Account => {
  const { patientId, guarantor, coverage, contained } = input;

  const account: Account = {
    contained,
    resourceType: 'Account',
    type: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/account-type',
          code: 'PBILLACCT',
          display: 'patient billing account',
        },
      ],
    },
    status: 'active',
    subject: [{ reference: `Patient/${patientId}` }],
    coverage,
    guarantor,
    description: 'Patient account',
  };
  return account;
};

interface OrderedCoveragesWithSubscribers extends OrderedCoverages {
  primarySubscriber?: RelatedPerson;
  secondarySubscriber?: RelatedPerson;
}

interface CompareCoverageInput {
  newCoverages: OrderedCoverages;
  existingCoverages: OrderedCoveragesWithSubscribers;
}
interface CompareCoverageResult {
  suggestedNewCoverageObject: Account['coverage'];
  deactivatedCoverages: Coverage[];
  coverageUpdates: Record<string, Operation[]>; // key is coverage id
  relatedPersonUpdates: Record<string, Operation[]>; // key is related person id
}

// this function is exported for testing purposes
export const resolveCoverageUpdates = (input: CompareCoverageInput): CompareCoverageResult => {
  const { existingCoverages, newCoverages } = input;
  const suggestedNewCoverageObject: Account['coverage'] = [];
  const deactivatedCoverages: Coverage[] = [];
  const coverageUpdates: Record<string, Operation[]> = {};
  const relatedPersonUpdates: Record<string, Operation[]> = {};

  const existingPrimaryCoverage = existingCoverages.primary;
  const existingSecondaryCoverage = existingCoverages.secondary;
  const existingPrimarySubscriber = existingCoverages.primarySubscriber;
  const existingSecondarySubscriber = existingCoverages.secondarySubscriber;

  // here we're assuming a resource is persisted if it has an id that is a valid uuid
  const existingPrimarySubscriberIsPersisted = isValidUUID(existingPrimarySubscriber?.id ?? '');
  const existingSecondarySubscriberIsPersisted = isValidUUID(existingSecondarySubscriber?.id ?? '');

  const addCoverageUpdates = (key: string, updates: Operation[]): void => {
    const existing = coverageUpdates[key] ?? [];
    coverageUpdates[key] = [...existing, ...updates];
  };

  const addRelatedPersonUpdates = (key: string, updates: Operation[]): void => {
    const existing = relatedPersonUpdates[key] ?? [];
    relatedPersonUpdates[key] = [...existing, ...updates];
  };

  const primaryCoverageFromPaperwork = newCoverages.primary;
  let secondaryCoverageFromPaperwork = newCoverages.secondary;

  const primarySubscriberFromPaperwork = primaryCoverageFromPaperwork?.contained?.[0] as RelatedPerson;
  const secondarySubscriberFromPaperwork = secondaryCoverageFromPaperwork?.contained?.[0] as RelatedPerson;

  if (primaryCoverageFromPaperwork && coveragesAreSame(primaryCoverageFromPaperwork, secondaryCoverageFromPaperwork)) {
    secondaryCoverageFromPaperwork = undefined;
  }

  if (primaryCoverageFromPaperwork && primarySubscriberFromPaperwork) {
    if (
      coveragesAreSame(primaryCoverageFromPaperwork, existingPrimaryCoverage) &&
      relatedPersonsAreSame(primarySubscriberFromPaperwork, existingPrimarySubscriber)
    ) {
      suggestedNewCoverageObject.push({
        coverage: { reference: `Coverage/${existingPrimaryCoverage?.id}` },
        priority: 1,
      });
      if (existingPrimarySubscriber?.id && existingPrimarySubscriberIsPersisted) {
        const ops = patchOpsForRelatedPerson({
          source: primarySubscriberFromPaperwork,
          target: existingPrimarySubscriber,
        });
        addRelatedPersonUpdates(existingPrimarySubscriber.id, ops);
      } else if (existingPrimaryCoverage?.id) {
        const ops = patchOpsForCoverage({
          source: primaryCoverageFromPaperwork,
          target: existingPrimaryCoverage,
        });
        addCoverageUpdates(existingPrimaryCoverage.id, ops);
      }
    } else if (
      coveragesAreSame(primaryCoverageFromPaperwork, existingSecondaryCoverage) &&
      relatedPersonsAreSame(primarySubscriberFromPaperwork, existingSecondarySubscriber)
    ) {
      suggestedNewCoverageObject.push({
        coverage: { reference: `Coverage/${existingSecondaryCoverage?.id}` },
        priority: 1,
      });
      if (existingSecondarySubscriber?.id && existingSecondarySubscriberIsPersisted) {
        const ops = patchOpsForRelatedPerson({
          source: primarySubscriberFromPaperwork,
          target: existingSecondarySubscriber,
        });
        addRelatedPersonUpdates(existingSecondarySubscriber.id, ops);
      } else if (existingSecondaryCoverage?.id) {
        const ops = patchOpsForCoverage({
          source: primaryCoverageFromPaperwork,
          target: existingSecondaryCoverage,
        });
        addCoverageUpdates(existingSecondaryCoverage.id, ops);
      }
    } else if (coveragesAreSame(primaryCoverageFromPaperwork, existingPrimaryCoverage) && existingPrimaryCoverage?.id) {
      const ops = patchOpsForCoverage({
        source: primaryCoverageFromPaperwork,
        target: existingPrimaryCoverage,
      });
      addCoverageUpdates(existingPrimaryCoverage.id, ops);
      suggestedNewCoverageObject.push({
        coverage: { reference: `Coverage/${existingPrimaryCoverage?.id}` },
        priority: 1,
      });
    } else if (
      coveragesAreSame(primaryCoverageFromPaperwork, existingSecondaryCoverage) &&
      existingSecondaryCoverage?.id
    ) {
      const ops = patchOpsForCoverage({
        source: primaryCoverageFromPaperwork,
        target: existingSecondaryCoverage,
      });
      addCoverageUpdates(existingSecondaryCoverage.id, ops);
      suggestedNewCoverageObject.push({
        coverage: { reference: `Coverage/${existingSecondaryCoverage?.id}` },
        priority: 1,
      });
    } else {
      suggestedNewCoverageObject.push({
        coverage: { reference: primaryCoverageFromPaperwork.id },
        priority: 1,
      });
    }
  }

  if (secondaryCoverageFromPaperwork && secondarySubscriberFromPaperwork) {
    if (
      coveragesAreSame(secondaryCoverageFromPaperwork, existingSecondaryCoverage) &&
      relatedPersonsAreSame(secondarySubscriberFromPaperwork, existingSecondarySubscriber)
    ) {
      suggestedNewCoverageObject.push({
        coverage: { reference: `Coverage/${existingSecondaryCoverage?.id}` },
        priority: 2,
      });
      if (existingSecondarySubscriber?.id && existingSecondarySubscriberIsPersisted) {
        const ops = patchOpsForRelatedPerson({
          source: secondarySubscriberFromPaperwork,
          target: existingSecondarySubscriber,
        });
        addRelatedPersonUpdates(existingSecondarySubscriber.id, ops);
      } else if (existingSecondaryCoverage?.id) {
        const ops = patchOpsForCoverage({
          source: secondaryCoverageFromPaperwork,
          target: existingSecondaryCoverage,
        });
        addCoverageUpdates(existingSecondaryCoverage.id, ops);
      }
    } else if (
      coveragesAreSame(secondaryCoverageFromPaperwork, existingPrimaryCoverage) &&
      relatedPersonsAreSame(secondarySubscriberFromPaperwork, existingPrimarySubscriber)
    ) {
      suggestedNewCoverageObject.push({
        coverage: { reference: `Coverage/${existingPrimaryCoverage?.id}` },
        priority: 2,
      });
      if (existingPrimarySubscriber?.id) {
        const ops = patchOpsForRelatedPerson({
          source: secondarySubscriberFromPaperwork,
          target: existingPrimarySubscriber,
        });
        addRelatedPersonUpdates(existingPrimarySubscriber.id, ops);
      } else if (existingPrimaryCoverage?.id) {
        const ops = patchOpsForCoverage({
          source: secondaryCoverageFromPaperwork,
          target: existingPrimaryCoverage,
        });
        addCoverageUpdates(existingPrimaryCoverage.id, ops);
      }
    } else if (
      coveragesAreSame(secondaryCoverageFromPaperwork, existingSecondaryCoverage) &&
      existingSecondaryCoverage?.id
    ) {
      const ops = patchOpsForCoverage({
        source: secondaryCoverageFromPaperwork,
        target: existingSecondaryCoverage,
      });
      addCoverageUpdates(existingSecondaryCoverage.id, ops);
      suggestedNewCoverageObject.push({
        coverage: { reference: `Coverage/${existingSecondaryCoverage?.id}` },
        priority: 2,
      });
    } else if (
      coveragesAreSame(secondaryCoverageFromPaperwork, existingPrimaryCoverage) &&
      existingPrimaryCoverage?.id
    ) {
      const ops = patchOpsForCoverage({
        source: secondaryCoverageFromPaperwork,
        target: existingPrimaryCoverage,
      });
      addCoverageUpdates(existingPrimaryCoverage.id, ops);
      suggestedNewCoverageObject.push({
        coverage: { reference: `Coverage/${existingPrimaryCoverage?.id}` },
        priority: 2,
      });
    } else {
      suggestedNewCoverageObject.push({
        coverage: { reference: secondaryCoverageFromPaperwork.id },
        priority: 2,
      });
    }
  }

  const newPrimaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 1)?.coverage;
  const newSecondaryCoverage = suggestedNewCoverageObject.find((c) => c.priority === 2)?.coverage;

  if (
    existingCoverages.primary &&
    existingCoverages.primary.id !== newPrimaryCoverage?.reference?.split('/')[1] &&
    existingCoverages.primary.id !== newSecondaryCoverage?.reference?.split('/')[1]
  ) {
    deactivatedCoverages.push(existingCoverages.primary);
  }

  if (
    existingCoverages.secondary &&
    existingCoverages.secondary.id !== newSecondaryCoverage?.reference?.split('/')[1] &&
    existingCoverages.secondary.id !== newPrimaryCoverage?.reference?.split('/')[1]
  ) {
    deactivatedCoverages.push(existingCoverages.secondary);
  }

  console.log('existing primary coverage', JSON.stringify(existingCoverages.primary, null, 2));
  console.log('new primary coverage', JSON.stringify(newPrimaryCoverage, null, 2));
  console.log('existing secondary coverage', JSON.stringify(existingCoverages.secondary, null, 2));
  console.log('new secondary coverage', JSON.stringify(newSecondaryCoverage, null, 2));
  console.log('deactivated coverages', JSON.stringify(deactivatedCoverages, null, 2));
  console.log('coverage updates', JSON.stringify(coverageUpdates, null, 2));

  return {
    suggestedNewCoverageObject,
    deactivatedCoverages,
    coverageUpdates,
    relatedPersonUpdates,
  };
};

interface ResolveGuarantorInput {
  patientId: string;
  guarantorFromQuestionnaire: ResponsiblePartyContact;
  existingGuarantorResource: RelatedPerson | Patient;
  existingGuarantorReferences: AccountGuarantor[];
  timestamp?: string;
}
interface ResolveGuarantorOutput {
  guarantors: AccountGuarantor[];
  contained: RelatedPerson[] | undefined;
}
// exporting for testing purposes
export const resolveGuarantor = (input: ResolveGuarantorInput): ResolveGuarantorOutput => {
  const { patientId, guarantorFromQuestionnaire, existingGuarantorResource, existingGuarantorReferences, timestamp } =
    input;
  if (guarantorFromQuestionnaire.relationship === 'Self') {
    if (existingGuarantorResource.resourceType === 'Patient' && existingGuarantorResource.id === patientId) {
      return { guarantors: existingGuarantorReferences, contained: undefined };
    } else {
      const newGuarantor = {
        party: {
          reference: `Patient/${patientId}`,
          type: 'Patient',
        },
      };
      return {
        guarantors: replaceCurrentGuarantor(newGuarantor, existingGuarantorReferences, timestamp),
        contained: undefined,
      };
    }
  }
  // the new gurantor is not the patient...
  const existingResourceIsPersisted = existingGuarantorReferences.some((r) => {
    const ref = r.party.reference;
    return `${existingGuarantorResource.resourceType}/${existingGuarantorResource.id}` === ref;
  });
  const existingResourceType = existingGuarantorResource.resourceType;
  const rpFromGruarantorData = createContainedGuarantor(guarantorFromQuestionnaire, patientId);
  if (existingResourceType === 'RelatedPerson') {
    if (existingResourceIsPersisted && relatedPersonsAreSame(existingGuarantorResource, rpFromGruarantorData)) {
      // we won't bother with trying to update the existing RelatedPerson resource
      return {
        guarantors: existingGuarantorReferences,
        contained: undefined,
      };
    } else {
      const newGuarantor = {
        party: {
          reference: `#${rpFromGruarantorData.id}`,
          type: 'RelatedPerson',
        },
      };
      return {
        guarantors: replaceCurrentGuarantor(newGuarantor, existingGuarantorReferences, timestamp),
        contained: [rpFromGruarantorData],
      };
    }
  } else {
    const newGuarantor = {
      party: {
        reference: `#${rpFromGruarantorData.id}`,
        type: 'RelatedPerson',
      },
    };
    return {
      guarantors: replaceCurrentGuarantor(newGuarantor, existingGuarantorReferences, timestamp),
      contained: [rpFromGruarantorData],
    };
  }
};

const coveragesAreSame = (coverage1: Coverage, coverage2: Coverage | undefined): boolean => {
  if (!coverage2) return false;
  let coverage1MemberId = getMemberIdFromCoverage(coverage1);
  let coverage2MemberId = getMemberIdFromCoverage(coverage2);

  if (coverage1MemberId === undefined) {
    const { subscriberId } = coverage1;
    if (!subscriberId) return false;
    coverage1MemberId = subscriberId;
  }
  if (coverage2MemberId === undefined) {
    const { subscriberId } = coverage2;
    if (!subscriberId) return false;
    coverage2MemberId = subscriberId;
  }

  if (coverage1MemberId !== coverage2MemberId) return false;

  const coverage1Payor = coverage1.payor?.[0].reference;
  const coverage2Payor = coverage2.payor?.[0].reference;

  return coverage1Payor !== undefined && coverage2Payor !== undefined && coverage1Payor === coverage2Payor;
};

const relatedPersonsAreSame = (relatedPersons1: RelatedPerson, relatedPerson2: RelatedPerson | undefined): boolean => {
  if (!relatedPerson2) return false;
  const fullName1 = getFullName(relatedPersons1);
  const fullName2 = getFullName(relatedPerson2);
  const dob1 = relatedPersons1.birthDate;
  const dob2 = relatedPerson2.birthDate;

  if (!fullName1 || !fullName2 || !dob1 || !dob2) return false;

  return fullName1 === fullName2 && dob1 === dob2;
};

interface GetRelatedPersonPatchOperationsInput {
  source: RelatedPerson;
  target: RelatedPerson;
}
const patchOpsForRelatedPerson = (input: GetRelatedPersonPatchOperationsInput): Operation[] => {
  const keysToUpdate = ['address', 'gender', 'relationship', 'telecom'];
  const ops: Operation[] = [];

  for (const key of Object.keys(input.source)) {
    if (keysToUpdate.includes(key)) {
      const sourceValue = (input.source as any)[key];
      const targetValue = (input.target as any)[key];
      if (sourceValue && !_.isEqual(sourceValue, targetValue) && targetValue === undefined) {
        ops.push({
          op: 'add',
          path: `/${key}`,
          value: sourceValue,
        });
      } else if (sourceValue && !_.isEqual(sourceValue, targetValue)) {
        if (key === 'telecom') {
          ops.push({
            op: 'replace',
            path: `/${key}`,
            value: deduplicateContactPoints([...sourceValue, ...targetValue]),
          });
        } else if (key === 'address') {
          ops.push({
            op: 'replace',
            path: `/${key}`,
            value: deduplicateObjectsByStrictKeyValEquality([...sourceValue, ...targetValue]),
          });
        } else {
          ops.push({
            op: 'replace',
            path: `/${key}`,
            value: sourceValue,
          });
        }
      }
    }
  }
  return ops;
};

interface GetCoveragePatchOpsInput {
  source: Coverage;
  target: Coverage;
}

const patchOpsForCoverage = (input: GetCoveragePatchOpsInput): Operation[] => {
  const { source, target } = input;
  const ops: Operation[] = [];

  const keysToExclude = ['id', 'resourceType'];
  const keysToCheck = Object.keys(source).filter((k) => !keysToExclude.includes(k));
  for (const key of keysToCheck) {
    const sourceValue = (source as any)[key];
    const targetValue = (target as any)[key];

    if (sourceValue && !_.isEqual(sourceValue, targetValue) && targetValue === undefined) {
      ops.push({
        op: 'add',
        path: `/${key}`,
        value: sourceValue,
      });
    } else if (sourceValue && !_.isEqual(sourceValue, targetValue)) {
      if (key === 'identifier') {
        const newIdentifiers = deduplicateIdentifiers([...sourceValue, ...targetValue]);
        ops.push({
          op: 'replace',
          path: `/${key}`,
          value: newIdentifiers,
        });
      }
      ops.push({
        op: 'replace',
        path: `/${key}`,
        value: sourceValue,
      });
    }
  }

  return ops;
};

const getPolicyHolderRelationshipCodeableConcept = (relationship: PolicyHolder['relationship']): CodeableConcept => {
  const relationshipCode = SUBSCRIBER_RELATIONSHIP_CODE_MAP[relationship] || 'other';
  return {
    coding: [
      {
        system: 'http://terminology.hl7.org/CodeSystem/subscriber-relationship',
        code: relationshipCode,
        display: relationship,
      },
    ],
  };
};

export const createContainedGuarantor = (guarantor: ResponsiblePartyContact, patientId: string): RelatedPerson => {
  const guarantorId = 'accountGuarantorId';
  const policyHolderName = createFhirHumanName(guarantor.firstName, undefined, guarantor.lastName);
  const relationshipCode = SUBSCRIBER_RELATIONSHIP_CODE_MAP[guarantor.relationship] || 'other';
  return {
    resourceType: 'RelatedPerson',
    id: guarantorId,
    name: policyHolderName ? policyHolderName : undefined,
    birthDate: guarantor.dob,
    gender: mapBirthSexToGender(guarantor.birthSex),
    patient: { reference: `Patient/${patientId}` },
    relationship: [
      {
        coding: [
          {
            system: 'http://hl7.org/fhir/ValueSet/relatedperson-relationshiptype',
            code: relationshipCode,
            display: guarantor.relationship,
          },
        ],
      },
    ],
  };
};

const replaceCurrentGuarantor = (
  newGuarantor: AccountGuarantor,
  currentGurantors: AccountGuarantor[],
  timestamp?: string
): AccountGuarantor[] => {
  const combined = deduplicateObjectsByStrictKeyValEquality([newGuarantor, ...currentGurantors]);
  const periodEnd = timestamp ?? DateTime.now().toISO();
  return combined.map((guarantor, idx) => {
    if (idx !== 0) {
      return {
        ...guarantor,
        period: {
          ...(guarantor.period ?? {}),
          end: guarantor.period?.end ? guarantor.period?.end : periodEnd,
        },
      };
    }
    return guarantor;
  });
};

/*
export interface GetAccountOperationsInput {
  patient: Patient;
  questionnaireResponseItem: QuestionnaireResponse['item'];
  insurancePlanResources: InsurancePlan[];
  organizationResources: Organization[];
  existingCoverages: OrderedCoveragesWithSubscribers;
  existingGuarantorResource?: RelatedPerson | Patient;
  existingAccount?: Account;
}


*/

type UnbundledAccountResources = (Account | Coverage | RelatedPerson | Patient)[];
interface UnbundledAccountResourceWithInsuranceResources {
  patient: Patient;
  resources: UnbundledAccountResources;
}
// this function is exported for testing purposes
export const getCoverageUpdateResourcesFromUnbundled = (
  input: UnbundledAccountResourceWithInsuranceResources
): Omit<
  GetAccountOperationsInput,
  'questionnaireResponseItem' | 'insurancePlanResources' | 'organizationResources'
> => {
  const { patient, resources: unfilteredResources } = input;
  const resources = deduplicateUnbundledResources(unfilteredResources);
  const accountResources = resources.filter((res): res is Account => res.resourceType === 'Account');
  const coverageResources = resources.filter((res): res is Coverage => res.resourceType === 'Coverage');

  let existingAccount: Account | undefined;
  let existingGuarantorResource: RelatedPerson | Patient | undefined;

  if (accountResources.length >= 0) {
    existingAccount = accountResources[0];
  }

  const existingCoverages: OrderedCoveragesWithSubscribers = {};
  if (existingAccount) {
    const guarantorReference = existingAccount.guarantor?.[0]?.party?.reference;
    if (guarantorReference) {
      existingGuarantorResource = takeContainedOrFind(guarantorReference, resources, existingAccount);
    }
    existingAccount.coverage?.forEach((cov) => {
      const coverage = coverageResources.find((c) => c.id === cov.coverage?.reference?.split('/')[1]);
      if (coverage) {
        if (cov.priority === 1) {
          existingCoverages.primary = coverage;
        } else if (cov.priority === 2) {
          existingCoverages.secondary = coverage;
        }
      }
    });
  } else {
    // find the free-floating existing coverages
    const primaryCoverages = coverageResources
      .filter((cov) => cov.order === 1 && cov.status === 'active')
      .sort((cova, covb) => {
        const covALastUpdate = cova.meta?.lastUpdated;
        const covBLastUpdate = covb.meta?.lastUpdated;
        if (covALastUpdate && covBLastUpdate) {
          const covALastUpdateDate = DateTime.fromISO(covALastUpdate);
          const covBLastUpdateDate = DateTime.fromISO(covBLastUpdate);
          if (covALastUpdateDate.isValid && covBLastUpdateDate.isValid) {
            return covALastUpdateDate.diff(covBLastUpdateDate).milliseconds;
          }
        }
        return 0;
      });
    const secondaryCoverages = coverageResources
      .filter((cov) => cov.order === 2 && cov.status === 'active')
      .sort((cova, covb) => {
        const covALastUpdate = cova.meta?.lastUpdated;
        const covBLastUpdate = covb.meta?.lastUpdated;
        if (covALastUpdate && covBLastUpdate) {
          const covALastUpdateDate = DateTime.fromISO(covALastUpdate);
          const covBLastUpdateDate = DateTime.fromISO(covBLastUpdate);
          if (covALastUpdateDate.isValid && covBLastUpdateDate.isValid) {
            return covALastUpdateDate.diff(covBLastUpdateDate).milliseconds;
          }
        }
        return 0;
      });
    const unknownOrderCoverages = coverageResources
      .filter((cov) => !cov.order && cov.status === 'active')
      .sort((cova, covb) => {
        const covALastUpdate = cova.meta?.lastUpdated;
        const covBLastUpdate = covb.meta?.lastUpdated;
        if (covALastUpdate && covBLastUpdate) {
          const covALastUpdateDate = DateTime.fromISO(covALastUpdate);
          const covBLastUpdateDate = DateTime.fromISO(covBLastUpdate);
          if (covALastUpdateDate.isValid && covBLastUpdateDate.isValid) {
            return covALastUpdateDate.diff(covBLastUpdateDate).milliseconds;
          }
        }
        return 0;
      });

    if (primaryCoverages.length) {
      existingCoverages.primary = primaryCoverages[0];
    }
    if (secondaryCoverages.length) {
      existingCoverages.secondary = secondaryCoverages[0];
    }
    // we'll use the first unknown order coverage as the primary only if no coverages with order populated exist
    if (
      existingCoverages.primary === undefined &&
      existingCoverages.secondary === undefined &&
      unknownOrderCoverages.length
    ) {
      existingCoverages.primary = unknownOrderCoverages[0];
    }
  }

  const primarySubscriberReference = existingCoverages.primary?.subscriber?.reference;
  if (primarySubscriberReference && existingCoverages.primary) {
    const subscriberResult = takeContainedOrFind<RelatedPerson>(
      primarySubscriberReference,
      resources,
      existingCoverages.primary
    );
    console.log('checked primary subscriber reference:', subscriberResult);
    existingCoverages.primarySubscriber = subscriberResult;
  }

  const secondarySubscriberReference = existingCoverages.secondary?.subscriber?.reference;
  if (secondarySubscriberReference && existingCoverages.secondary) {
    const subscriberResult = takeContainedOrFind<RelatedPerson>(
      secondarySubscriberReference,
      resources,
      existingCoverages.secondary
    );
    console.log('checked secondary subscriber reference:', subscriberResult);
    existingCoverages.secondarySubscriber = subscriberResult;
  }

  return {
    patient,
    existingAccount,
    existingCoverages,
    existingGuarantorResource,
  };
};
