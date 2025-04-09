import Oystehr, {
  BatchInputPatchRequest,
  BatchInputPostRequest,
  BatchInputPutRequest,
  BatchInputRequest,
} from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Operation } from 'fast-json-patch';
import {
  Account,
  AccountGuarantor,
  Address,
  Attachment,
  Bundle,
  CodeableConcept,
  Consent,
  ContactPoint,
  Coverage,
  DocumentReference,
  FhirResource,
  Flag,
  InsurancePlan,
  List,
  Location,
  Organization,
  Patient,
  Practitioner,
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
  deduplicateUnbundledResources,
  takeContainedOrFind,
  PATIENT_NOT_FOUND_ERROR,
  OrderedCoverages,
  OrderedCoveragesWithSubscribers,
  PatientAccountAndCoverageResources,
  flattenItems,
  PATIENT_BILLING_ACCOUNT_TYPE,
  formatPhoneNumber,
  getSecret,
  Secrets,
  SecretsKeys,
  getStripeCustomerIdFromAccount,
  getEmailForIndividual,
  STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR,
  getPatchOperationToAddOrUpdatePreferredName,
} from 'utils';
import _ from 'lodash';
import { createOrUpdateFlags } from '../../../patient/paperwork/sharedHelpers';
import { createPdfBytes } from '../../../shared';
import Stripe from 'stripe';

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
    locationState === 'IL'
      ? './assets/CTT.and.Guarantee.of.Payment.Illinois-S.pdf'
      : './assets/CTT.and.Guarantee.of.Payment-S.pdf';
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
      copyFromPath: './assets/HIPAA.Acknowledgement-S.pdf',
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
    const { docRefs: documentReferences } = await createFilesDocumentReferences({
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
        subject: { reference: `Patient/${patientID}` },
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
        subject: { reference: `Patient/${patientID}` },
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
  let newListResources = listResources;
  for (const d of docsToSave) {
    const result = await createFilesDocumentReferences({
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
      listResources: newListResources,
      meta: {
        // for backward compatibility. TODO: remove this
        tag: [{ code: OTTEHR_MODULE.IP }, { code: OTTEHR_MODULE.TM }],
      },
    });
    newListResources = result.listResources ?? listResources;
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
  'patient-birthdate': patientFieldPaths.birthDate,
  'patient-pronouns': patientFieldPaths.preferredPronouns,
  'patient-pronouns-custom': patientFieldPaths.preferredPronounsCustom,
  'patient-name-suffix': patientFieldPaths.suffix,
  'patient-preferred-name': patientFieldPaths.preferredName,
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
  'patient-gender-identity': patientFieldPaths.genderIdentity,
  'patient-sexual-orientation': patientFieldPaths.sexualOrientation,
  'patient-point-of-discovery': patientFieldPaths.pointOfDiscovery,
  'mobile-opt-in': patientFieldPaths.sendMarketing,
  'common-well-consent': patientFieldPaths.commonWellConsent,
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

const PCP_FIELDS = ['pcp-first', 'pcp-last', 'pcp-practice', 'pcp-address', 'pcp-number', 'pcp-active'];

export interface PatientMasterRecordResources {
  patient: Patient;
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

  const pcpItems: QuestionnaireResponseItem[] = [];

  flattenedPaperwork.forEach((item) => {
    const value = extractValueFromItem(item);
    if (value === undefined) return;
    if (PCP_FIELDS.includes(item.linkId)) {
      pcpItems.push(item);
      return;
    }

    // Remove '-2' suffix for secondary fields
    const baseFieldId = item.linkId === 'patient-street-address-2' ? item.linkId : item.linkId.replace(/-2$/, '');

    let fullPath = paperworkToPatientFieldMap[baseFieldId];
    if (!fullPath) return;

    // Change index if path is changeable
    if (['patient-first-name', 'patient-last-name'].includes(baseFieldId)) {
      const nameIndex = patient.name?.findIndex((name) => name.use === 'official');

      fullPath = fullPath.replace(/name\/\d+/, `name/${nameIndex}`);
    }

    const { resourceType, path } = extractResourceTypeAndPath(fullPath);

    const shouldThrow = path.includes('contact') || fullPath.includes('contact');
    if (shouldThrow) {
      throw new Error(`SHORT CIRCUIT: trigger occurs`);
    }

    switch (resourceType) {
      case 'Patient': {
        // Handle telecom fields
        const contactTelecomConfig = contactTelecomConfigs[item.linkId];
        if (contactTelecomConfig) {
          const operation = createPatchOperationForTelecom(value as string, contactTelecomConfig, patient, path);
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

        if (item.linkId === 'patient-preferred-name') {
          const preferredNameIndex = patient.name?.findIndex((name) => name.use === 'nickname');
          const currentPath = path.replace(/name\/\d+/, `name/${preferredNameIndex}`);
          const currentValue = getCurrentValue(patient, currentPath);

          if (value !== currentValue) {
            const operation = getPatchOperationToAddOrUpdatePreferredName(
              currentPath,
              currentValue as string,
              value as string
            );

            if (operation) tempOperations.patient.push(operation);
          }
          return;
        }

        // Handle array fields
        const { isArray, parentPath } = getArrayInfo(path);
        if (isArray) {
          const effectiveArrayValue = getEffectiveValue(patient, parentPath, tempOperations.patient) as
            | string[]
            | undefined;

          if (effectiveArrayValue === undefined) {
            const currentParentValue = getCurrentValue(patient, parentPath);
            const operation = createBasicPatchOperation([value], parentPath, currentParentValue);
            if (operation) tempOperations.patient.push(operation);
            return;
          }

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
            if (effectiveArrayValue === undefined || areArraysDifferent(effectiveArrayValue, cleanArray)) {
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
  result.patient.patchOpsForDirectUpdate = result.patient.patchOpsForDirectUpdate.filter((op) => {
    const { path, op: oper } = op;
    return path != undefined && oper != undefined;
  });
  result.patient.patchOpsForDirectUpdate = consolidateOperations(result.patient.patchOpsForDirectUpdate, patient);
  // this needs to go here for now because consolitdateOperations breaks it
  result.patient.patchOpsForDirectUpdate.push(...getPCPPatchOps(pcpItems, patient));
  console.log('result.patient.patchops', JSON.stringify(result.patient.patchOpsForDirectUpdate, null, 2));
  return result;
}

const getPCPPatchOps = (flattenedItems: QuestionnaireResponseItem[], patient: Patient): Operation[] => {
  const isActive = flattenedItems.find((field) => field.linkId === 'pcp-active')?.answer?.[0]?.valueBoolean;
  const firstName = flattenedItems.find((field) => field.linkId === 'pcp-first')?.answer?.[0]?.valueString;
  const lastName = flattenedItems.find((field) => field.linkId === 'pcp-last')?.answer?.[0]?.valueString;
  const practiceName = flattenedItems.find((field) => field.linkId === 'pcp-practice')?.answer?.[0]?.valueString;
  const pcpAddress = flattenedItems.find((field) => field.linkId === 'pcp-address')?.answer?.[0]?.valueString;
  const phone = flattenedItems.find((field) => field.linkId === 'pcp-number')?.answer?.[0]?.valueString;

  console.log('pcp patch inputs', isActive, firstName, lastName, practiceName, pcpAddress, phone);

  const hasSomeValue = (firstName && lastName) || practiceName || pcpAddress || phone;

  if (isActive === undefined && !hasSomeValue) {
    return [];
  }

  const operations: Operation[] = [];

  const currentPCPRef = patient.generalPractitioner?.[0];
  const currentContainedPCP = currentPCPRef?.reference
    ? patient.contained?.find(
        (resource) => `#${resource.id}` === currentPCPRef?.reference && resource.resourceType === 'Practitioner'
      )
    : undefined;

  if (isActive === false) {
    if (currentPCPRef) {
      operations.push({
        op: 'remove',
        path: '/generalPractitioner',
      });
    }
    if (currentContainedPCP) {
      const contained = (patient.contained ?? []).filter((resource) => resource.id !== currentContainedPCP.id);
      if (contained.length == 0) {
        operations.push({
          op: 'remove',
          path: '/contained',
        });
      } else {
        operations.push({
          op: 'replace',
          path: '/contained',
          value: contained,
        });
      }
    }
  } else {
    let name: Practitioner['name'];
    let telecom: Practitioner['telecom'];
    let address: Practitioner['address'];
    let extension: Practitioner['extension'];

    if (lastName) {
      name = [{ family: lastName }];
      if (firstName) {
        name[0].given = [firstName];
      }
    }

    if (phone) {
      telecom = [{ system: 'phone', value: phone }];
    }
    if (pcpAddress) {
      address = [{ text: pcpAddress }];
    }

    if (practiceName) {
      extension = [
        {
          url: `${PRIVATE_EXTENSION_BASE_URL}/practice-name`,
          valueString: practiceName,
        },
      ];
    }

    const newPCP: Practitioner = {
      resourceType: 'Practitioner',
      id: 'primary-care-physician',
      name,
      telecom,
      address,
      extension,
      active: true,
    };

    if (_.isEqual(newPCP, currentContainedPCP)) {
      return operations;
    }

    let newContained: Patient['contained'] = [newPCP];

    if (currentContainedPCP) {
      newContained = (patient.contained ?? []).map((resource) => {
        if (resource.id === currentContainedPCP?.id) {
          return newPCP;
        }
        return resource;
      });
    }

    operations.push({
      op: patient.contained != undefined ? 'replace' : 'add',
      path: '/contained',
      value: newContained,
    });

    if (currentPCPRef?.reference !== `#${newPCP.id}`) {
      operations.push({
        op: currentPCPRef ? 'replace' : 'add',
        path: '/generalPractitioner',
        value: [{ reference: `#${newPCP.id}`, resourceType: 'Practitioner' }],
      });
    }
  }
  return operations;
};

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

type PatchValueBase = string | number | boolean | Reference;
function createBasicPatchOperation(
  value: PatchValueBase | PatchValueBase[],
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
): string | boolean | number | string[] | undefined {
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
  _resourceId: string,
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

function areArraysDifferent(source: string[], target: string[]): boolean {
  // Quick length check
  if (source.length !== target.length) {
    return true;
  }

  // Content comparison (order matters)
  for (let i = 0; i < source.length; i++) {
    if (source[i] !== target[i]) {
      return true;
    }
  }

  return false;
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
  const isSecondaryOnly = checkIsSecondaryOnly(flattenedPaperwork);
  // Check primary insurance
  let primaryPolicyHolder: PolicyHolder | undefined;
  let primaryInsuranceDetails: InsuranceDetails | undefined;
  let secondaryPolicyHolder = getSecondaryPolicyHolderFromAnswers(questionnaireResponse.item ?? []);
  let secondaryInsuranceDetails = getInsuranceDetailsFromAnswers(
    flattenedPaperwork,
    insurancePlanResources,
    organizationResources,
    '-2'
  );
  if (!isSecondaryOnly) {
    primaryPolicyHolder = getPrimaryPolicyHolderFromAnswers(questionnaireResponse.item ?? []);
    primaryInsuranceDetails = getInsuranceDetailsFromAnswers(
      flattenedPaperwork,
      insurancePlanResources,
      organizationResources
    );
  } else if (secondaryPolicyHolder === undefined || secondaryInsuranceDetails === undefined) {
    secondaryPolicyHolder = secondaryPolicyHolder ?? getPrimaryPolicyHolderFromAnswers(flattenedPaperwork);
    secondaryInsuranceDetails =
      secondaryInsuranceDetails ??
      getInsuranceDetailsFromAnswers(flattenedPaperwork, insurancePlanResources, organizationResources);
  }

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

const getCoverageGroups = (items: QuestionnaireResponseItem[]): QuestionnaireResponseItem[][] => {
  const VARIABLE_PRIORITY_COVERAGE_SECTION_ID = 'insurance-section';
  const groups: QuestionnaireResponseItem[][] = [];

  items.forEach((item) => {
    const linkId = item.linkId;
    if (linkId.startsWith(VARIABLE_PRIORITY_COVERAGE_SECTION_ID) && item.item) {
      groups.push(item.item);
    }
  });
  return groups;
};

interface PrioritizedCoverageGroup {
  priority: 'Primary' | 'Secondary'; // | 'Tertiary' some day
  suffix: string;
  items: QuestionnaireResponseItem[];
}

const tagCoverageGroupWithPriortity = (items: QuestionnaireResponseItem[]): PrioritizedCoverageGroup | undefined => {
  const primaryItem = items.find(
    (item) => item.linkId.startsWith('insurance-priority') && item.answer?.[0]?.valueString === 'Primary'
  );
  const secondaryItem = items.find(
    (item) => item.linkId.startsWith('insurance-priority') && item.answer?.[0]?.valueString === 'Secondary'
  );

  const isPrimary = primaryItem !== undefined;
  const isSecondary = secondaryItem !== undefined;

  const primarySuffix = parseInt(primaryItem?.linkId.split('-').pop() ?? '');
  const secondarySuffix = parseInt(secondaryItem?.linkId.split('-').pop() ?? '');

  if (isPrimary) {
    return {
      priority: 'Primary',
      items,
      suffix: Number.isNaN(primarySuffix) ? '' : `-${primarySuffix}`,
    };
  }
  if (isSecondary) {
    return {
      priority: 'Secondary',
      items,
      suffix: Number.isNaN(secondarySuffix) ? '' : `-${secondarySuffix}`,
    };
  }
  return undefined;
};

// the following 3 functions are exported for testing purposes; not expected to be called outside this file but for unit testing
export const getPrimaryPolicyHolderFromAnswers = (items: QuestionnaireResponseItem[]): PolicyHolder | undefined => {
  // group the coverage-related items into their respective group(s)
  // if there is some indication in the answers within each group that the group should be treated as primary,
  // use that group here, regardless of the suffix used within that group

  const coverageGroups = getCoverageGroups(items);

  const prioritizedCoverageGroups = coverageGroups
    .map(tagCoverageGroupWithPriortity)
    .filter(Boolean) as PrioritizedCoverageGroup[];
  const foundPrimaryGroup = prioritizedCoverageGroups.find((group) => group.priority === 'Primary');

  if (foundPrimaryGroup) {
    return extractPolicyHolder(foundPrimaryGroup.items, foundPrimaryGroup.suffix);
  }

  const flattenedItems = flattenIntakeQuestionnaireItems(items as IntakeQuestionnaireItem[]);
  return extractPolicyHolder(flattenedItems);
};

export const getSecondaryPolicyHolderFromAnswers = (items: QuestionnaireResponseItem[]): PolicyHolder | undefined => {
  // group the coverage-related items into their respective group(s)
  // if there is some indication in the answers within each group that the group should be treated as secondary,
  // use that group here, regardless of the suffix used within that group

  const coverageGroups = getCoverageGroups(items);

  const prioritizedCoverageGroups = coverageGroups
    .map(tagCoverageGroupWithPriortity)
    .filter(Boolean) as PrioritizedCoverageGroup[];
  const foundSecondaryGroup = prioritizedCoverageGroups.find((group) => group.priority === 'Secondary');
  if (foundSecondaryGroup) {
    return extractPolicyHolder(foundSecondaryGroup.items, foundSecondaryGroup.suffix);
  }
  const flattenedItems = flattenIntakeQuestionnaireItems(items as IntakeQuestionnaireItem[]);
  return extractPolicyHolder(flattenedItems, '-2');
};

// EHR design calls for teritary insurance to be handled in addition to secondary - will need some changes to support this
const checkIsSecondaryOnly = (items: QuestionnaireResponseItem[]): boolean => {
  const priorityAnswer = items.find((item) => item.linkId === 'insurance-priority')?.answer?.[0]?.valueString;
  if (priorityAnswer && priorityAnswer !== 'Primary') {
    return true;
  }
  return false;
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
  return undefined;
}

// note: this function assumes items have been flattened before being passed in
interface InsuranceDetails {
  plan: InsurancePlan;
  org: Organization;
}
function getInsuranceDetailsFromAnswers(
  answers: QuestionnaireResponseItem[],
  insurancePlans: InsurancePlan[],
  organizations: Organization[],
  keySuffix?: string
): InsuranceDetails | undefined {
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

  let contained: Coverage['contained'];
  let subscriberReference = `#${policyHolderId}`;
  if (relationshipCode === 'self') {
    subscriberReference = `Patient/${patientId}`;
  } else {
    contained = [containedPolicyHolder];
  }

  const coverage: Coverage = {
    contained,
    id: `urn:uuid:${randomUUID()}`,
    identifier: [createCoverageMemberIdentifier(memberId, org)],
    resourceType: 'Coverage',
    status: 'active',
    subscriber: {
      reference: subscriberReference,
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
      if (patientResource.contact === undefined) {
        return {
          op: 'add',
          path: `/contact`,
          value: [
            {
              telecom: [erxContactTelecom],
            },
          ],
        };
      } else {
        return {
          op: 'add',
          path: `/contact/-`,
          value: {
            telecom: [erxContactTelecom],
          },
        };
      }
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
  preserveOmittedCoverages?: boolean;
}

export interface GetAccountOperationsOutput {
  coveragePosts: BatchInputPostRequest<Coverage>[];
  patch: BatchInputPatchRequest<Coverage | RelatedPerson>[];
  put: BatchInputPutRequest<Account>[];
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
    preserveOmittedCoverages,
  } = input;

  if (!patient.id) {
    throw new Error('Patient resource must have an id');
  }

  const flattenedItems = flattenItems(questionnaireResponseItem ?? []);

  const guarantorData = extractAccountGuarantor(flattenedItems);
  /*console.log(
    'insurance plan resources',
    JSON.stringify(insurancePlanResources, null, 2),
    JSON.stringify(organizationResources, null, 2),
    JSON.stringify(flattenedItems, null, 2)
  );*/

  const { orderedCoverages: questionnaireCoverages } = getCoverageResources({
    questionnaireResponse: {
      item: flattenedItems,
    } as QuestionnaireResponse,
    patientId: patient.id!,
    insurancePlanResources,
    organizationResources,
  });

  console.log('insurance plan ordered coverages', JSON.stringify(questionnaireCoverages, null, 2));

  const patch: BatchInputPatchRequest<Coverage | RelatedPerson | Account>[] = [];
  const coveragePosts: BatchInputPostRequest<Coverage>[] = [];
  const put: BatchInputPutRequest<Account>[] = [];
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
      patient,
      existingCoverages,
      newCoverages: questionnaireCoverages,
      preserveOmittedCoverages,
    });
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

  // create Coverage BatchInputPostRequests for either of the Coverages found on Ordered coverage that are also referenced suggestedNewCoverageObject
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
      existingContained: existingAccount.contained ?? [],
    });

    const updatedAccount: Account = {
      ...existingAccount,
      guarantor: guarantors,
      contained,
      coverage: suggestedNewCoverageObject,
    };

    put.push({
      method: 'PUT',
      url: `Account/${existingAccount.id}`,
      resource: updatedAccount,
    });
  }

  return {
    coveragePosts,
    accountPost,
    patch,
    put,
  };
};

interface CreateAccountInput {
  patientId: string;
  coverage: Account['coverage'];
  guarantor: AccountGuarantor[];
  contained: Account['contained'];
}
// this function is exported for testing purposes
export const createAccount = (input: CreateAccountInput): Account => {
  const { patientId, guarantor, coverage, contained } = input;

  const account: Account = {
    contained,
    resourceType: 'Account',
    type: { ...PATIENT_BILLING_ACCOUNT_TYPE },
    status: 'active',
    subject: [{ reference: `Patient/${patientId}` }],
    coverage,
    guarantor,
    description: 'Patient account',
  };
  return account;
};

interface CompareCoverageInput {
  patient: Patient;
  newCoverages: OrderedCoverages;
  existingCoverages: OrderedCoveragesWithSubscribers;
  preserveOmittedCoverages?: boolean;
}
interface CompareCoverageResult {
  suggestedNewCoverageObject: Account['coverage'];
  deactivatedCoverages: Coverage[];
  coverageUpdates: Record<string, Operation[]>; // key is coverage id
  relatedPersonUpdates: Record<string, Operation[]>; // key is related person id
}

// this function is exported for testing purposes
export const resolveCoverageUpdates = (input: CompareCoverageInput): CompareCoverageResult => {
  const { patient, existingCoverages, newCoverages, preserveOmittedCoverages } = input;
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

  let primarySubscriberFromPaperwork: RelatedPerson | Patient | undefined = undefined;
  let secondarySubscriberFromPaperwork: RelatedPerson | Patient | undefined = undefined;

  if (primaryCoverageFromPaperwork) {
    if (primaryCoverageFromPaperwork.subscriber?.reference?.startsWith('#')) {
      primarySubscriberFromPaperwork = primaryCoverageFromPaperwork.contained?.[0] as RelatedPerson;
    } else {
      const [resourceType, resourceId] = primaryCoverageFromPaperwork.subscriber?.reference?.split('/') ?? [];
      if (`${resourceType}/${resourceId}` === `Patient/${patient.id}`) {
        primarySubscriberFromPaperwork = patient;
      }
    }
  }
  if (secondaryCoverageFromPaperwork) {
    if (secondaryCoverageFromPaperwork.subscriber?.reference?.startsWith('#')) {
      secondarySubscriberFromPaperwork = secondaryCoverageFromPaperwork.contained?.[0] as RelatedPerson;
    } else {
      const [resourceType, resourceId] = secondaryCoverageFromPaperwork.subscriber?.reference?.split('/') ?? [];
      if (`${resourceType}/${resourceId}` === `Patient/${patient.id}`) {
        secondarySubscriberFromPaperwork = patient;
      }
    }
  }

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
      if (
        existingPrimarySubscriber?.id &&
        existingPrimarySubscriberIsPersisted &&
        existingPrimarySubscriber.resourceType === 'RelatedPerson'
      ) {
        const ops = patchOpsForRelatedPerson({
          source: primarySubscriberFromPaperwork as RelatedPerson,
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
      if (
        existingSecondarySubscriber?.id &&
        existingSecondarySubscriberIsPersisted &&
        existingSecondarySubscriber.resourceType === 'RelatedPerson'
      ) {
        const ops = patchOpsForRelatedPerson({
          source: primarySubscriberFromPaperwork as RelatedPerson,
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
      if (
        existingSecondarySubscriber?.id &&
        existingSecondarySubscriberIsPersisted &&
        existingSecondarySubscriber.resourceType === 'RelatedPerson'
      ) {
        const ops = patchOpsForRelatedPerson({
          source: secondarySubscriberFromPaperwork as RelatedPerson,
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
      if (
        existingPrimarySubscriber?.id &&
        existingPrimarySubscriberIsPersisted &&
        existingPrimarySubscriber.resourceType === 'RelatedPerson'
      ) {
        const ops = patchOpsForRelatedPerson({
          source: secondarySubscriberFromPaperwork as RelatedPerson,
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
    if (!preserveOmittedCoverages || newPrimaryCoverage?.reference?.split('/')[1] !== undefined) {
      deactivatedCoverages.push(existingCoverages.primary);
    }
  }

  if (
    existingCoverages.secondary &&
    existingCoverages.secondary.id !== newSecondaryCoverage?.reference?.split('/')[1] &&
    existingCoverages.secondary.id !== newPrimaryCoverage?.reference?.split('/')[1]
  ) {
    if (!preserveOmittedCoverages || newSecondaryCoverage?.reference?.split('/')[1] !== undefined) {
      deactivatedCoverages.push(existingCoverages.secondary);
    }
  }

  if (preserveOmittedCoverages && existingCoverages.primary && !newPrimaryCoverage) {
    suggestedNewCoverageObject.push({
      coverage: { reference: `Coverage/${existingCoverages.primary.id}` },
      priority: 1,
    });
  }
  if (preserveOmittedCoverages && existingCoverages.secondary && !newSecondaryCoverage) {
    suggestedNewCoverageObject.push({
      coverage: { reference: `Coverage/${existingCoverages.secondary.id}` },
      priority: 2,
    });
  }
  suggestedNewCoverageObject.sort((a, b) => (a?.priority ?? Number.MAX_VALUE) - (b?.priority ?? Number.MAX_VALUE));

  /*
  console.log('existing primary coverage', JSON.stringify(existingCoverages.primary, null, 2));
  console.log('new primary coverage', JSON.stringify(newPrimaryCoverage, null, 2));
  console.log('existing secondary coverage', JSON.stringify(existingCoverages.secondary, null, 2));
  console.log('new secondary coverage', JSON.stringify(newSecondaryCoverage, null, 2));
  console.log('deactivated coverages', JSON.stringify(deactivatedCoverages, null, 2));
  console.log('coverage updates', JSON.stringify(coverageUpdates, null, 2));
  */

  return {
    suggestedNewCoverageObject,
    deactivatedCoverages,
    coverageUpdates,
    relatedPersonUpdates,
  };
};

interface ResolveGuarantorInput {
  patientId: string;
  guarantorFromQuestionnaire: ResponsiblePartyContact | undefined;
  existingGuarantorResource?: RelatedPerson | Patient;
  existingGuarantorReferences?: AccountGuarantor[];
  existingContained?: FhirResource[];
  timestamp?: string;
}
interface ResolveGuarantorOutput {
  guarantors: AccountGuarantor[];
  contained: FhirResource[] | undefined;
}
// exporting for testing purposes
export const resolveGuarantor = (input: ResolveGuarantorInput): ResolveGuarantorOutput => {
  const {
    patientId,
    guarantorFromQuestionnaire,
    existingGuarantorResource,
    existingGuarantorReferences = [],
    existingContained,
    timestamp,
  } = input;
  console.log('guarantorFromQuestionnaire', JSON.stringify(guarantorFromQuestionnaire, null, 2));
  if (guarantorFromQuestionnaire === undefined || guarantorFromQuestionnaire.relationship === 'Self') {
    if (existingGuarantorResource?.resourceType === 'Patient' && existingGuarantorResource.id === patientId) {
      return { guarantors: existingGuarantorReferences, contained: existingContained };
    } else {
      const newGuarantor = {
        party: {
          reference: `Patient/${patientId}`,
          type: 'Patient',
        },
      };
      return {
        guarantors: replaceCurrentGuarantor(newGuarantor, existingGuarantorReferences, timestamp),
        contained: existingContained,
      };
    }
  }
  // the new gurantor is not the patient...
  const existingResourceIsPersisted = existingGuarantorReferences.some((r) => {
    const ref = r.party.reference;
    if (r.period?.end !== undefined) return false;
    return `${existingGuarantorResource?.resourceType}/${existingGuarantorResource?.id}` === ref;
  });
  const existingResourceType = existingGuarantorResource?.resourceType;
  const rpFromGuarantorData = createContainedGuarantor(guarantorFromQuestionnaire, patientId);
  if (existingResourceType === 'RelatedPerson') {
    if (existingResourceIsPersisted && relatedPersonsAreSame(existingGuarantorResource!, rpFromGuarantorData)) {
      // we won't bother with trying to update the existing RelatedPerson resource
      return {
        guarantors: existingGuarantorReferences,
        contained: existingContained,
      };
    } else if (relatedPersonsAreSame(existingGuarantorResource!, rpFromGuarantorData)) {
      const contained = existingContained?.map((c) => {
        if (c.id === existingGuarantorResource!.id) {
          // just take the latest full content and leave the id as is
          return { ...rpFromGuarantorData, id: c.id };
        }
        return c;
      });
      return {
        guarantors: existingGuarantorReferences,
        contained,
      };
    } else {
      const newGuarantor = {
        party: {
          reference: `#${rpFromGuarantorData.id}`,
          type: 'RelatedPerson',
        },
      };
      return {
        guarantors: replaceCurrentGuarantor(newGuarantor, existingGuarantorReferences, timestamp),
        contained: [rpFromGuarantorData, ...(existingContained ?? [])],
      };
    }
  } else {
    if (existingContained?.length) {
      rpFromGuarantorData.id += `-${existingContained.length}`;
    }
    const newGuarantor = {
      party: {
        reference: `#${rpFromGuarantorData.id}`,
        type: 'RelatedPerson',
      },
    };
    return {
      guarantors: replaceCurrentGuarantor(newGuarantor, existingGuarantorReferences, timestamp),
      contained: [rpFromGuarantorData, ...(existingContained ?? [])],
    };
  }
};

export const coveragesAreSame = (coverage1: Coverage, coverage2: Coverage | undefined): boolean => {
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

export const relatedPersonsAreSame = (
  relatedPersons1: RelatedPerson | Patient,
  relatedPerson2: RelatedPerson | Patient | undefined
): boolean => {
  if (!relatedPerson2) return false;
  if (relatedPersons1.resourceType !== relatedPerson2.resourceType) return false;
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
      if (key === 'contained' && sourceValue === undefined && targetValue !== undefined) {
        ops.push({
          op: 'remove',
          path: `/${key}`,
        });
      }
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
    if (key === 'contained' && sourceValue === undefined && targetValue !== undefined) {
      ops.push({
        op: 'remove',
        path: `/${key}`,
      });
    }
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
  const number = guarantor.number;
  let telecom: RelatedPerson['telecom'];
  if (number) {
    telecom = [
      {
        value: formatPhoneNumber(number),
        system: 'phone',
      },
    ];
  }
  return {
    resourceType: 'RelatedPerson',
    id: guarantorId,
    name: policyHolderName ? policyHolderName : undefined,
    birthDate: guarantor.dob,
    gender: mapBirthSexToGender(guarantor.birthSex),
    telecom,
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

type UnbundledAccountResources = (Account | Coverage | RelatedPerson | Patient | InsurancePlan | Organization)[];
interface UnbundledAccountResourceWithInsuranceResources {
  patient: Patient;
  resources: UnbundledAccountResources;
}
// this function is exported for testing purposes
// todo: rename this function to something more descriptive
export const getCoverageUpdateResourcesFromUnbundled = (
  input: UnbundledAccountResourceWithInsuranceResources
): PatientAccountAndCoverageResources => {
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
    const guarantorReference = existingAccount.guarantor?.find((gref) => {
      return gref.period?.end === undefined;
    })?.party?.reference;
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

    if (primaryCoverages.length) {
      existingCoverages.primary = primaryCoverages[0];
    }
    if (secondaryCoverages.length) {
      existingCoverages.secondary = secondaryCoverages[0];
    }
  }

  const primarySubscriberReference = existingCoverages.primary?.subscriber?.reference;
  if (primarySubscriberReference && existingCoverages.primary) {
    const subscriberResult = takeContainedOrFind<RelatedPerson>(
      primarySubscriberReference,
      resources,
      existingCoverages.primary
    );
    // console.log('checked primary subscriber reference:', subscriberResult);
    existingCoverages.primarySubscriber = subscriberResult;
  }

  const secondarySubscriberReference = existingCoverages.secondary?.subscriber?.reference;
  if (secondarySubscriberReference && existingCoverages.secondary) {
    const subscriberResult = takeContainedOrFind<RelatedPerson>(
      secondarySubscriberReference,
      resources,
      existingCoverages.secondary
    );
    // console.log('checked secondary subscriber reference:', subscriberResult);
    existingCoverages.secondarySubscriber = subscriberResult;
  }

  const insurancePlans: InsurancePlan[] = resources.filter(
    (res): res is InsurancePlan => res.resourceType === 'InsurancePlan'
  );
  const insuranceOrgs: Organization[] = resources.filter(
    (res): res is Organization => res.resourceType === 'Organization'
  );

  return {
    patient,
    account: existingAccount,
    coverages: existingCoverages,
    insuranceOrgs,
    insurancePlans,
    guarantorResource: existingGuarantorResource,
  };
};

enum InsuanceCarrierKeys {
  primary = 'insurance-carrier',
  secondary = 'insurance-carrier-2',
}

export const getAccountAndCoverageResourcesForPatient = async (
  patientId: string,
  oystehr: Oystehr
): Promise<PatientAccountAndCoverageResources> => {
  console.time('querying for Patient account resources');
  const accountAndCoverageResources = (
    await oystehr.fhir.search<Account | Coverage | RelatedPerson | Patient | InsurancePlan | Organization>({
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
        {
          name: '_revinclude',
          value: 'RelatedPerson:patient',
        },
        {
          name: '_revinclude',
          value: 'Coverage:patient',
        },
        {
          name: '_include:iterate',
          value: 'Coverage:subscriber',
        },
        {
          name: '_include:iterate',
          value: 'Coverage:payor',
        },
        {
          name: '_revinclude:iterate',
          value: 'InsurancePlan:owned-by',
        },
      ],
    })
  ).unbundle();
  console.timeEnd('querying for Patient account resources');

  const patientResource = accountAndCoverageResources.find(
    (r) => r.resourceType === 'Patient' && r.id === patientId
  ) as Patient;

  const resources = accountAndCoverageResources.filter((resource) => {
    if (resource.resourceType === 'Account') {
      return resource.status === 'active';
    }
    return true;
  });

  if (!patientResource) {
    throw PATIENT_NOT_FOUND_ERROR;
  }

  return getCoverageUpdateResourcesFromUnbundled({
    patient: patientResource,
    resources: [...resources],
  });
};

export interface UpdatePatientAccountInput {
  patientId: string;
  questionnaireResponseItem: QuestionnaireResponse['item'];
  preserveOmittedCoverages?: boolean;
}

export const updatePatientAccountFromQuestionnaire = async (
  input: UpdatePatientAccountInput,
  oystehr: Oystehr
): Promise<Bundle> => {
  const { patientId, questionnaireResponseItem, preserveOmittedCoverages } = input;

  const flattenedPaperwork = flattenIntakeQuestionnaireItems(
    questionnaireResponseItem as IntakeQuestionnaireItem[]
  ) as QuestionnaireResponseItem[];

  // get insurance additional information
  const insurancePlans = [];
  const primaryInsurancePlan = flattenedPaperwork.find((item) => item.linkId === InsuanceCarrierKeys.primary)
    ?.answer?.[0]?.valueReference?.reference;
  if (primaryInsurancePlan) insurancePlans.push(primaryInsurancePlan);
  const secondaryInsurancePlan = flattenedPaperwork.find((item) => item.linkId === InsuanceCarrierKeys.secondary)
    ?.answer?.[0]?.valueReference?.reference;
  if (secondaryInsurancePlan) insurancePlans.push(secondaryInsurancePlan);
  const insuranceInformationResources = await searchInsuranceInformation(oystehr, insurancePlans);
  console.log('insurance information resources', JSON.stringify(insuranceInformationResources, null, 2));
  const insurancePlanResources = insuranceInformationResources.filter(
    (res): res is InsurancePlan => res.resourceType === 'InsurancePlan'
  );
  const organizationResources = insuranceInformationResources.filter(
    (res): res is Organization => res.resourceType === 'Organization'
  );

  const {
    patient,
    coverages: existingCoverages,
    account: existingAccount,
    guarantorResource: existingGuarantorResource,
  } = await getAccountAndCoverageResourcesForPatient(patientId, oystehr);

  const patientPatchOps = createMasterRecordPatchOperations(
    { item: questionnaireResponseItem } as QuestionnaireResponse,
    patient
  );
  console.time('patching patient resource');
  if (patientPatchOps.patient.patchOpsForDirectUpdate.length > 0) {
    try {
      await oystehr.fhir.patch({
        resourceType: 'Patient',
        id: patient.id!,
        operations: patientPatchOps.patient.patchOpsForDirectUpdate,
      });
    } catch (error: unknown) {
      console.log(`Failed to update Patient: ${JSON.stringify(error)}`);
    }
  }
  console.timeEnd('patching patient resource');

  /*
  console.log('existing coverages', JSON.stringify(existingCoverages, null, 2));
  console.log('existing account', JSON.stringify(existingAccount, null, 2));
  console.log('existing guarantor resource', JSON.stringify(existingGuarantorResource, null, 2));
*/
  const accountOperations = getAccountOperations({
    patient,
    questionnaireResponseItem: flattenedPaperwork,
    insurancePlanResources,
    organizationResources,
    existingCoverages,
    existingAccount,
    existingGuarantorResource,
    preserveOmittedCoverages,
  });

  console.log('account and coverage operations created', JSON.stringify(accountOperations, null, 2));

  const { patch, accountPost, put, coveragePosts } = accountOperations;

  const transactionRequests: BatchInputRequest<Account | RelatedPerson | Coverage | Patient>[] = [
    ...coveragePosts,
    ...patch,
    ...put,
  ];
  if (accountPost) {
    transactionRequests.push({
      url: '/Account',
      method: 'POST',
      resource: accountPost,
    });
  }

  try {
    console.time('updating account resources');
    const bundle = await oystehr.fhir.transaction({ requests: transactionRequests });
    console.timeEnd('updating account resources');
    // return the bundle to allow writing AuditEvents, etc.
    return bundle;
  } catch (error: unknown) {
    console.log(`Failed to update Account: ${JSON.stringify(error)}`);
    throw error;
  }
};

interface UpdateStripeCustomerInput {
  account: Account;
  guarantorResource: RelatedPerson | Patient;
  stripeClient: Stripe;
}
export const updateStripeCustomer = async (input: UpdateStripeCustomerInput): Promise<void> => {
  const { guarantorResource, account } = input;
  const stripeCustomerId = getStripeCustomerIdFromAccount(account);
  const email = getEmailForIndividual(guarantorResource);
  const name = getFullName(guarantorResource);
  if (stripeCustomerId) {
    await input.stripeClient.customers.update(stripeCustomerId, {
      email,
      name,
    });
  } else {
    throw STRIPE_CUSTOMER_ID_NOT_FOUND_ERROR;
  }
};
