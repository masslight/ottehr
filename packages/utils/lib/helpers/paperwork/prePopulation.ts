import {
  Address,
  DocumentReference,
  Organization,
  Patient,
  Practitioner,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  Reference,
  RelatedPerson,
} from 'fhir/r4b';
import { capitalize } from 'lodash-es';
import { DateTime } from 'luxon';
import {
  genderMap,
  getFirstName,
  getLastName,
  getMiddleName,
  getNameSuffix,
  getPronounsFromExtension,
  PRIVATE_EXTENSION_BASE_URL,
} from '../../fhir';
import {
  COVERAGE_ADDITIONAL_INFORMATION_URL,
  PATIENT_GENDER_IDENTITY_URL,
  PATIENT_INDIVIDUAL_PRONOUNS_URL,
  PATIENT_SEXUAL_ORIENTATION_URL,
  PatientAccountResponse,
  PRACTICE_NAME_URL,
} from '../../types';
import { formatPhoneNumberDisplay, getPayerId } from '../helpers';

// used when patient books an appointment and some of the inputs come from the create-appointment params
interface PrePopulationInput {
  patient: Patient;
  appointmentStartTime: string;
  isNewQrsPatient: boolean;
  verifiedPhoneNumber: string | undefined;
  questionnaire: Questionnaire;
  contactInfo: { phone: string; email: string } | undefined;
  newPatientDob?: string;
  unconfirmedDateOfBirth?: string;
  rp?: RelatedPerson;
  documents?: DocumentReference[];
  accountInfo?: PatientAccountResponse | undefined;
}

export const makePrepopulatedItemsForPatient = (input: PrePopulationInput): QuestionnaireResponseItem[] => {
  const {
    patient,
    newPatientDob,
    unconfirmedDateOfBirth,
    appointmentStartTime: startTime,
    isNewQrsPatient,
    verifiedPhoneNumber,
    contactInfo,
    questionnaire,
    documents,
    accountInfo,
  } = input;

  let formattedVerifiedPhoneNumber: string | undefined;
  if (verifiedPhoneNumber) {
    try {
      formattedVerifiedPhoneNumber = formatPhoneNumberDisplay(verifiedPhoneNumber);
    } catch {
      console.log('unable to format phone number', verifiedPhoneNumber);
    }
  }

  const patientAddress = patient.address?.[0];
  const patientAddressLine1 = patientAddress?.line?.[0];
  const patientAddressLine2 = patientAddress?.line?.[1];
  const patientCity = patientAddress?.city;
  const patientState = patientAddress?.state;
  const patientPostalCode = patientAddress?.postalCode;

  const patientEmail = contactInfo?.email;
  const patientSendMarketing = patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/send-marketing`)
    ?.valueBoolean;
  const patientCommonWellConsent = patient.extension?.find(
    (e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/common-well-consent`
  )?.valueBoolean;
  const patientEthnicity = patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/ethnicity`)
    ?.valueCodeableConcept?.coding?.[0]?.display;
  const patientRace = patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/race`)
    ?.valueCodeableConcept?.coding?.[0]?.display;

  const pronouns = getPronounsFromExtension(patient);
  const customPronouns = patient.extension?.find(
    (e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/individual-pronouns-custom`
  )?.valueString;
  const language = patient.communication?.find((lang) => lang.preferred)?.language.coding?.[0].display;

  let patientSex: string | undefined;
  if (patient?.gender === 'male') {
    patientSex = 'Male';
  } else if (patient?.gender === 'female') {
    patientSex = 'Female';
  } else if (patient?.gender !== undefined) {
    patientSex = 'Intersex';
  }

  const photoIdFrontDocumentReference = documents?.find((doc) =>
    doc.content.some((item) => item.attachment.title === 'photo-id-front')
  );

  const photoIdFront = {
    url: photoIdFrontDocumentReference?.content[0].attachment.url,
    title: photoIdFrontDocumentReference?.content[0].attachment.title,
    creation: photoIdFrontDocumentReference?.date,
    contentType: photoIdFrontDocumentReference?.content[0].attachment.contentType,
  };

  const photoIdBackDocumentReference = documents?.find((doc) =>
    doc.content.some((item) => item.attachment.title === 'photo-id-back')
  );

  const photoIdBack = {
    url: photoIdBackDocumentReference?.content[0].attachment.url,
    title: photoIdBackDocumentReference?.content[0].attachment.title,
    creation: photoIdBackDocumentReference?.date,
    contentType: photoIdBackDocumentReference?.content[0].attachment.contentType,
  };

  console.log('patient info for pre-population: ');
  console.log('patient: ', JSON.stringify(patient, null, 2));
  console.log('patientSex', patientSex);
  console.log('documents: ', JSON.stringify(documents, null, 2));
  console.log('insurance related resources: ', JSON.stringify(accountInfo, null, 2));

  const patientFirstName = getFirstName(patient) ?? '';
  const patientLastName = getLastName(patient) ?? '';

  const item: QuestionnaireResponseItem[] = (questionnaire.item ?? []).map((item) => {
    const populatedItem: QuestionnaireResponseItem[] = (() => {
      const itemItems = (item.item ?? []).filter((i: QuestionnaireItem) => i.type !== 'display');
      if (item.linkId === 'contact-information-page') {
        // todo: consolidate this with mapPatientItemsToQuestionnaireResponseItems
        return itemItems.map((item) => {
          let answer: QuestionnaireResponseItemAnswer[] | undefined;
          const { linkId } = item;
          if (linkId === 'patient-will-be-18') {
            answer = makeAnswer(
              checkPatientWillBe18(startTime ?? '', patient, newPatientDob, unconfirmedDateOfBirth),
              'Boolean'
            );
          }
          if (linkId === 'patient-birthdate') {
            const patientDOB = getPatientDOB(patient, newPatientDob, unconfirmedDateOfBirth);
            if (patientDOB) {
              answer = makeAnswer(patientDOB);
            }
          }
          if (linkId === 'is-new-qrs-patient') {
            answer = makeAnswer(isNewQrsPatient, 'Boolean');
          }
          if (linkId === 'patient-first-name' && patientFirstName) {
            answer = makeAnswer(patientFirstName);
          }
          if (linkId === 'patient-last-name' && patientLastName) {
            answer = makeAnswer(patientLastName);
          }
          if (linkId === 'patient-street-address' && patientAddressLine1) {
            answer = makeAnswer(patientAddressLine1);
          }
          if (linkId === 'patient-street-address-2' && patientAddressLine2) {
            answer = makeAnswer(patientAddressLine2);
          }
          if (linkId === 'patient-city' && patientCity) {
            answer = makeAnswer(patientCity);
          }
          if (linkId === 'patient-state' && patientState) {
            answer = makeAnswer(patientState);
          }
          if (linkId === 'patient-zip' && patientPostalCode) {
            answer = makeAnswer(patientPostalCode);
          }
          if (linkId === 'patient-email' && patientEmail) {
            answer = makeAnswer(patientEmail);
          }
          if (linkId === 'mobile-opt-in' && patientSendMarketing !== undefined) {
            answer = makeAnswer(patientSendMarketing, 'Boolean');
          }
          if (linkId === 'common-well-consent' && patientCommonWellConsent !== undefined) {
            answer = makeAnswer(patientCommonWellConsent, 'Boolean');
          }
          if (linkId === 'patient-number' && formattedVerifiedPhoneNumber) {
            answer = makeAnswer(formatPhoneNumberDisplay(formattedVerifiedPhoneNumber));
          }
          if (linkId === 'patient-birth-sex' && patientSex) {
            answer = makeAnswer(patientSex);
          }
          if (linkId === 'patient-birth-sex-missing' && patientSex == undefined) {
            answer = makeAnswer(true, 'Boolean');
          }

          return {
            linkId,
            answer,
          };
        });
      } else if (item.linkId === 'patient-details-page') {
        // todo: consolidate this with mapPatientItemsToQuestionnaireResponseItems
        return itemItems.map((item) => {
          let answer: QuestionnaireResponseItemAnswer[] | undefined;
          const { linkId } = item;
          if (linkId === 'patient-pronouns' && pronouns) {
            answer = makeAnswer(pronouns);
          }
          if (linkId === 'patient-pronouns-custom' && customPronouns) {
            answer = makeAnswer(customPronouns);
          }
          if (linkId === 'preferred-language' && language) {
            answer = makeAnswer(language);
          }
          if (linkId === 'patient-ethnicity' && patientEthnicity) {
            answer = makeAnswer(patientEthnicity);
          }
          if (linkId === 'patient-race' && patientRace) {
            answer = makeAnswer(patientRace);
          }

          return {
            linkId,
            answer,
          };
        });
      } else if (PCP_ITEMS.includes(item.linkId)) {
        return mapPCPToQuestionnaireResponseItems({
          items: itemItems,
          physician: accountInfo?.primaryCarePhysician,
        });
      } else if (GUARANTOR_ITEMS.includes(item.linkId)) {
        return mapGuarantorToQuestionnaireResponseItems({
          items: itemItems,
          guarantorResource: accountInfo?.guarantorResource,
        });
      } else if (COVERAGE_ITEMS.includes(item.linkId)) {
        return mapCoveragesToQuestionnaireResponseItems({
          items: itemItems,
          coverages: accountInfo?.coverages ?? {},
          patient,
          documents,
          insuranceOrgs: accountInfo?.insuranceOrgs ?? [],
        });
      } else if (item.linkId === 'photo-id-page') {
        return itemItems.map((item) => {
          let answer: QuestionnaireResponseItemAnswer[] | undefined;
          const { linkId } = item;
          if (linkId === 'photo-id-front' && photoIdFrontDocumentReference) {
            answer = makeAnswer(photoIdFront, 'Attachment');
          }
          if (linkId === 'photo-id-back' && photoIdBackDocumentReference) {
            answer = makeAnswer(photoIdBack, 'Attachment');
          }

          return {
            linkId,
            answer,
          };
        });
      }

      return [];
    })();
    return {
      linkId: item.linkId,
      item: populatedItem,
    };
  });

  console.log('pre-population result', JSON.stringify(item));

  return item;
};

const getPatientDOB = (
  patient?: Patient,
  newPatientDob?: string,
  unconfirmedDateOfBirth?: string
): string | undefined => {
  const dobStringToUse = unconfirmedDateOfBirth ?? patient?.birthDate ?? newPatientDob;
  if (dobStringToUse === undefined) {
    return undefined;
  }
  const patientDOB = DateTime.fromISO(dobStringToUse);
  return patientDOB.isValid ? dobStringToUse : undefined;
};

const checkPatientWillBe18 = (
  appointmentStart: string,
  patient?: Patient,
  newPatientDob?: string,
  unconfirmedDateOfBirth?: string
): boolean => {
  // intentionally not worrying about time zone here. the extra accuracy is not worth the query.
  const appointmentStartTime = DateTime.fromISO(appointmentStart);
  const patientDOB = DateTime.fromISO(
    getPatientDOB(patient, newPatientDob, unconfirmedDateOfBirth) ?? DateTime.now().toISO()
  );

  if (!appointmentStartTime.isValid && patientDOB.isValid) {
    return false;
  }

  return patientDOB.plus({ years: 18 }) <= appointmentStartTime;
};

type AnswerType = 'String' | 'Boolean' | 'Reference' | 'Attachment';
export const makeAnswer = (val: any, type: AnswerType = 'String'): QuestionnaireResponseItemAnswer[] => {
  return [
    {
      [`value${type}`]: val,
    },
  ];
};
export const extractFirstValueFromAnswer = (
  answer: QuestionnaireResponseItemAnswer[],
  valueType: AnswerType = 'String'
): any => {
  return (answer[0] as any)?.[`value${valueType}`];
};

export interface PrePopulationFromPatientRecordInput extends PatientAccountResponse {
  questionnaire: Questionnaire;
}

export const makePrepopulatedItemsFromPatientRecord = (
  input: PrePopulationFromPatientRecordInput
): QuestionnaireResponseItem[] => {
  const { patient, questionnaire, primaryCarePhysician, coverages, guarantorResource, insuranceOrgs } = input;
  console.log('making prepopulated items from patient record', coverages);
  const item: QuestionnaireResponseItem[] = (questionnaire.item ?? []).map((item) => {
    const populatedItem: QuestionnaireResponseItem[] = (() => {
      const itemItems = (item.item ?? []).filter((i: QuestionnaireItem) => i.type !== 'display');
      if (PATIENT_ITEMS.includes(item.linkId)) {
        // console.log('mapping patient items', itemItems);
        return mapPatientItemsToQuestionnaireResponseItems({
          patient,
          items: itemItems,
        });
      }
      if (PCP_ITEMS.includes(item.linkId)) {
        return mapPCPToQuestionnaireResponseItems({
          items: itemItems,
          physician: primaryCarePhysician,
        });
      }
      if (COVERAGE_ITEMS.includes(item.linkId)) {
        return mapCoveragesToQuestionnaireResponseItems({
          items: itemItems,
          coverages,
          patient,
          insuranceOrgs,
        });
      }
      if (GUARANTOR_ITEMS.includes(item.linkId)) {
        return mapGuarantorToQuestionnaireResponseItems({ items: itemItems, guarantorResource });
      }
      return [];
    })();
    return {
      linkId: item.linkId,
      item: populatedItem,
    };
  });

  return item;
};

// helper functions
const PATIENT_ITEMS = [
  'contact-information-page',
  'patient-info-section',
  'patient-additional-details-section',
  'patient-demographics-section',
  'patient-contact-info-section',
];
interface MapPatientItemsInput {
  patient: Patient;
  items: QuestionnaireItem[];
}
const mapPatientItemsToQuestionnaireResponseItems = (input: MapPatientItemsInput): QuestionnaireResponseItem[] => {
  const { patient, items } = input;
  const patientAddress = patient.address?.[0];
  const patientAddressLine1 = patientAddress?.line?.[0];
  const patientAddressLine2 = patientAddress?.line?.[1];
  const patientCity = patientAddress?.city;
  const patientState = patientAddress?.state;
  const patientPostalCode = patientAddress?.postalCode;

  const patientEmail = patient?.telecom?.find((c) => c.system === 'email' && c.period?.end === undefined)?.value;
  const patientPhone = patient?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value;

  const patientEthnicity = patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/ethnicity`)
    ?.valueCodeableConcept?.coding?.[0]?.display;
  const patientRace = patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/race`)
    ?.valueCodeableConcept?.coding?.[0]?.display;
  const patientPreferredPronouns = patient.extension?.find((e) => e.url === PATIENT_INDIVIDUAL_PRONOUNS_URL)
    ?.valueCodeableConcept?.coding?.[0]?.display;

  const patientPreferredName = patient.name?.find((name) => name.use === 'nickname')?.given?.[0];

  let patientSex: string | undefined;
  if (patient?.gender === 'male') {
    patientSex = 'Male';
  } else if (patient?.gender === 'female') {
    patientSex = 'Female';
  } else if (patient?.gender !== undefined) {
    patientSex = 'Intersex';
  }

  const patientDOB = patient.birthDate;

  const patientSexualOrientation = patient.extension?.find((e) => e.url === PATIENT_SEXUAL_ORIENTATION_URL)
    ?.valueCodeableConcept?.coding?.[0]?.display;
  const patientGenderIdentity = patient.extension?.find((e) => e.url === PATIENT_GENDER_IDENTITY_URL)
    ?.valueCodeableConcept?.coding?.[0]?.display;
  const patientGenderIdentityDetails = patient.extension?.find(
    (e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/individual-genderIdentity`
  )?.valueString;
  const patientPointOfDiscovery = patient.extension?.find(
    (e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/point-of-discovery`
  )?.valueString;
  const patientSendMarketing = patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/send-marketing`)
    ?.valueBoolean;
  const patientPreferredLanguage = patient.communication?.find((lang) => lang.preferred)?.language.coding?.[0].display;
  const patientCommonWellConsent = patient.extension?.find(
    (e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/common-well-consent`
  )?.valueBoolean;

  return items.map((item) => {
    let answer: QuestionnaireResponseItemAnswer[] | undefined;
    const { linkId } = item;

    if (linkId === 'patient-birthdate' && patientDOB) {
      answer = makeAnswer(patientDOB);
    }

    if (linkId === 'patient-first-name') {
      answer = makeAnswer(getFirstName(patient) ?? '');
    }
    if (linkId === 'patient-last-name') {
      answer = makeAnswer(getLastName(patient) ?? '');
    }

    if (linkId === 'patient-middle-name') {
      answer = makeAnswer(getMiddleName(patient) ?? '');
    }

    if (linkId === 'patient-name-suffix') {
      answer = makeAnswer(getNameSuffix(patient) ?? '');
    }

    if (linkId === 'patient-preferred-name' && patientPreferredName) {
      answer = makeAnswer(patientPreferredName);
    }

    if (linkId === 'patient-pronouns' && patientPreferredPronouns) {
      answer = makeAnswer(patientPreferredPronouns);
    }

    if (linkId === 'patient-street-address' && patientAddressLine1) {
      answer = makeAnswer(patientAddressLine1);
    }
    if (linkId === 'patient-street-address-2' && patientAddressLine2) {
      answer = makeAnswer(patientAddressLine2);
    }
    if (linkId === 'patient-city' && patientCity) {
      answer = makeAnswer(patientCity);
    }
    if (linkId === 'patient-state' && patientState) {
      answer = makeAnswer(patientState);
    }
    if (linkId === 'patient-zip' && patientPostalCode) {
      answer = makeAnswer(patientPostalCode);
    }
    if (linkId === 'patient-email' && patientEmail) {
      answer = makeAnswer(patientEmail);
    }
    if (linkId === 'patient-number' && patientPhone) {
      const formatted = formatPhoneNumberDisplay(patientPhone);
      if (formatted) {
        answer = makeAnswer(formatted);
      }
    }
    if (linkId === 'patient-birth-sex' && patientSex) {
      answer = makeAnswer(patientSex);
    }
    if (linkId === 'patient-ethnicity' && patientEthnicity) {
      answer = makeAnswer(patientEthnicity);
    }
    if (linkId === 'patient-race' && patientRace) {
      answer = makeAnswer(patientRace);
    }
    if (linkId === 'patient-sexual-orientation' && patientSexualOrientation) {
      answer = makeAnswer(patientSexualOrientation);
    }
    if (linkId === 'patient-gender-identity' && patientGenderIdentity) {
      answer = makeAnswer(patientGenderIdentity);
    }
    if (linkId === 'patient-gender-identity-details' && patientGenderIdentityDetails) {
      answer = makeAnswer(patientGenderIdentityDetails);
    }
    if (linkId === 'patient-point-of-discovery' && patientPointOfDiscovery) {
      answer = makeAnswer(patientPointOfDiscovery);
    }
    if (linkId === 'mobile-opt-in' && patientSendMarketing !== undefined) {
      answer = makeAnswer(patientSendMarketing, 'Boolean');
    }
    if (linkId === 'preferred-language' && patientPreferredLanguage) {
      answer = makeAnswer(patientPreferredLanguage);
    }
    if (linkId === 'common-well-consent' && patientCommonWellConsent !== undefined) {
      answer = makeAnswer(patientCommonWellConsent, 'Boolean');
    }
    return {
      linkId,
      answer,
    };
  });
};

const PCP_ITEMS = ['primary-care-physician-section', 'primary-care-physician-page'];
interface MapPCPItemsInput {
  items: QuestionnaireItem[];
  physician?: Practitioner;
}
const mapPCPToQuestionnaireResponseItems = (input: MapPCPItemsInput): QuestionnaireResponseItem[] => {
  const { physician, items } = input;

  const practiceName =
    physician?.extension?.find((e: { url: string }) => e.url === PRACTICE_NAME_URL)?.valueString ?? '';
  const phone = physician?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value ?? '';
  const address = physician?.address?.[0]?.text ?? '';
  let firstName: string | undefined;
  let lastName: string | undefined;

  if (physician) {
    firstName = getFirstName(physician);
    lastName = getLastName(physician);
  }

  return items.map((item) => {
    let answer: QuestionnaireResponseItemAnswer[] | undefined;
    const { linkId } = item;

    if (linkId === 'pcp-first' && firstName) {
      answer = makeAnswer(firstName);
    }
    if (linkId === 'pcp-last' && lastName) {
      answer = makeAnswer(lastName);
    }

    if (linkId === 'pcp-practice' && practiceName) {
      // not really sure where this will come from yet...
      answer = makeAnswer(practiceName);
    }

    if (linkId === 'pcp-address' && address) {
      // not really sure where this will come from yet...
      answer = makeAnswer(address);
    }

    if (linkId === 'pcp-number' && phone) {
      const formatted = formatPhoneNumberDisplay(phone);
      if (formatted) {
        answer = makeAnswer(formatted);
      }
    }
    if (linkId === 'pcp-active') {
      answer = makeAnswer(!!physician && !physician.active === false, 'Boolean');
    }
    return {
      linkId,
      answer,
    };
  });
};

const COVERAGE_ITEMS = ['insurance-section', 'insurance-section-2', 'payment-option-page'];
interface MapCoverageItemsInput {
  items: QuestionnaireItem[];
  coverages: PatientAccountResponse['coverages'];
  patient: Patient;
  insuranceOrgs: Organization[];
  documents?: DocumentReference[];
}
const mapCoveragesToQuestionnaireResponseItems = (input: MapCoverageItemsInput): QuestionnaireResponseItem[] => {
  const { items, coverages, patient, documents, insuranceOrgs } = input;

  const patientAddress = patient.address?.[0];

  const insuranceCardFrontDocumentReference = documents?.find((doc) =>
    doc.content.some((item) => item.attachment.title === 'insurance-card-front')
  );

  const insuranceCardFront = {
    url: insuranceCardFrontDocumentReference?.content[0].attachment.url,
    title: insuranceCardFrontDocumentReference?.content[0].attachment.title,
    creation: insuranceCardFrontDocumentReference?.date,
    contentType: insuranceCardFrontDocumentReference?.content[0].attachment.contentType,
  };

  const insuranceCardBackDocumentReference = documents?.find((doc) =>
    doc.content.some((item) => item.attachment.title === 'insurance-card-back')
  );

  const insuranceCardBack = {
    url: insuranceCardBackDocumentReference?.content[0].attachment.url,
    title: insuranceCardBackDocumentReference?.content[0].attachment.title,
    creation: insuranceCardBackDocumentReference?.date,
    contentType: insuranceCardBackDocumentReference?.content[0].attachment.contentType,
  };

  const secondaryInsuranceCardFrontDocumentReference = documents?.find((doc) =>
    doc.content.some((item) => item.attachment.title === 'insurance-card-front-2')
  );

  const secondaryInsuranceCardFront = {
    url: secondaryInsuranceCardFrontDocumentReference?.content[0].attachment.url,
    title: secondaryInsuranceCardFrontDocumentReference?.content[0].attachment.title,
    creation: secondaryInsuranceCardFrontDocumentReference?.date,
    contentType: secondaryInsuranceCardFrontDocumentReference?.content[0].attachment.contentType,
  };

  const secondaryInsuranceCardBackDocumentReference = documents?.find((doc) =>
    doc.content.some((item) => item.attachment.title === 'insurance-card-back-2')
  );

  const secondaryInsuranceCardBack = {
    url: secondaryInsuranceCardBackDocumentReference?.content[0].attachment.url,
    title: secondaryInsuranceCardBackDocumentReference?.content[0].attachment.title,
    creation: secondaryInsuranceCardBackDocumentReference?.date,
    contentType: secondaryInsuranceCardBackDocumentReference?.content[0].attachment.contentType,
  };

  // console.log('mapping coverages to questionnaire response items', items, coverages);

  const { primary, secondary, primarySubscriber, secondarySubscriber } = coverages;

  let primaryInsurancePlanReference: Reference | undefined;
  let secondaryInsurancePlanReference: Reference | undefined;

  let primaryMemberId = '';
  let secondaryMemberId = '';

  if (primary) {
    const payerId = primary.class?.[0].value;
    const org = insuranceOrgs.find((tempOrg) => getPayerId(tempOrg) === payerId);
    if (payerId && org) {
      primaryInsurancePlanReference = {
        reference: `Organization/${org.id}`,
        display: org.name,
      };
    }
  }

  if (secondary) {
    const payerId = secondary.class?.[0].value;
    const org = insuranceOrgs.find((tempOrg) => getPayerId(tempOrg) === payerId);
    if (payerId && org) {
      secondaryInsurancePlanReference = {
        reference: `Organization/${org.id}`,
        display: org.name,
      };
    }
  }

  if (primary) {
    primaryMemberId =
      primary.identifier?.find(
        (i) => i.type?.coding?.[0]?.code === 'MB' && i.assigner?.reference === primary.payor[0]?.reference
      )?.value ?? '';
  }
  if (secondary) {
    secondaryMemberId =
      secondary.identifier?.find(
        (i) => i.type?.coding?.[0]?.code === 'MB' && i.assigner?.reference === secondary.payor[0]?.reference
      )?.value ?? '';
  }

  const primarySubscriberDoB = primarySubscriber?.birthDate ?? '';
  const primarySubscriberBirthSex = primarySubscriber?.gender
    ? genderMap[primarySubscriber.gender as keyof typeof genderMap] || ''
    : '';
  let primarySubscriberFirstName = '';
  let primarySubscriberLastName = '';
  let primarySubscriberMiddleName = '';
  const relationshipToInsured = primary?.relationship?.coding?.[0].display;
  const policyHolderAddress = primarySubscriber?.address?.[0];
  const policyHolderAddressAsPatient = patientAddress && areAddressesEqual(policyHolderAddress, patientAddress);
  const policyHolderZip = policyHolderAddress?.postalCode;
  const policyHolderState = policyHolderAddress?.state;
  const policyHolderCity = policyHolderAddress?.city;
  const policyHolderAddressAdditionalLine = policyHolderAddress?.line?.[1];
  const policyHolderAddressLine = policyHolderAddress?.line?.[0];

  if (primarySubscriber) {
    primarySubscriberFirstName = getFirstName(primarySubscriber) ?? '';
    primarySubscriberLastName = getLastName(primarySubscriber) ?? '';
    primarySubscriberMiddleName = primarySubscriber.name?.[0]?.given?.[1] ?? '';
  }

  const primaryAdditionalInformation =
    primary?.extension?.find((e: { url: string }) => e.url === COVERAGE_ADDITIONAL_INFORMATION_URL)?.valueString ?? '';

  const secondarySubscriberDoB = secondarySubscriber?.birthDate;
  const secondarySubscriberBirthSex = secondarySubscriber?.gender
    ? genderMap[secondarySubscriber.gender as keyof typeof genderMap] || ''
    : '';
  let secondarySubscriberFirstName: string | undefined;
  let secondarySubscriberLastName: string | undefined;
  let secondarySubscriberMiddleName: string | undefined;
  const secondaryRelationshipToInsured = secondary?.relationship?.coding?.[0].display;
  const secondaryPolicyHolderAddress = secondarySubscriber?.address?.[0];
  const secondaryPolicyHolderAddressAsPatient =
    patientAddress && areAddressesEqual(secondaryPolicyHolderAddress, patientAddress);
  const secondaryPolicyHolderZip = secondaryPolicyHolderAddress?.postalCode;
  const secondaryPolicyHolderState = secondaryPolicyHolderAddress?.state;
  const secondaryPolicyHolderCity = secondaryPolicyHolderAddress?.city;
  const secondaryPolicyHolderAddressAdditionalLine = secondaryPolicyHolderAddress?.line?.[1];
  const secondaryPolicyHolderAddressLine = secondaryPolicyHolderAddress?.line?.[0];
  if (secondarySubscriber) {
    secondarySubscriberFirstName = getFirstName(secondarySubscriber) ?? '';
    secondarySubscriberLastName = getLastName(secondarySubscriber) ?? '';
    secondarySubscriberMiddleName = secondarySubscriber.name?.[0]?.given?.[1] ?? '';
  }

  const secondaryAdditionalInformation =
    secondary?.extension?.find((e: { url: string }) => e.url === COVERAGE_ADDITIONAL_INFORMATION_URL)?.valueString ??
    '';

  let paymentOptionValue: string | undefined;

  if (primaryInsurancePlanReference || secondaryInsurancePlanReference) {
    paymentOptionValue = 'I have insurance';
  }

  return items
    .filter((i: QuestionnaireItem) => i.type !== 'display')
    .map((item) => {
      let answer: QuestionnaireResponseItemAnswer[] | undefined;
      const { linkId } = item;

      if (linkId === 'payment-option' && paymentOptionValue) {
        answer = makeAnswer(paymentOptionValue);
      }

      if (linkId === 'secondary-insurance' && item.type === 'group') {
        return {
          linkId,
          item: mapCoveragesToQuestionnaireResponseItems({ ...input, items: item.item ?? [] }),
        };
      }
      if (linkId === 'insurance-carrier' && primaryInsurancePlanReference) {
        answer = makeAnswer(primaryInsurancePlanReference, 'Reference');
      }
      if (linkId === 'insurance-carrier-2' && secondaryInsurancePlanReference) {
        answer = makeAnswer(secondaryInsurancePlanReference, 'Reference');
      }
      if (linkId === 'insurance-member-id' && primaryMemberId) {
        answer = makeAnswer(primaryMemberId);
      }
      if (linkId === 'insurance-member-id-2' && secondaryMemberId) {
        answer = makeAnswer(secondaryMemberId);
      }
      if (linkId === 'policy-holder-first-name' && primarySubscriberFirstName) {
        answer = makeAnswer(primarySubscriberFirstName);
      }
      if (linkId === 'policy-holder-first-name-2' && secondarySubscriberFirstName) {
        answer = makeAnswer(secondarySubscriberFirstName);
      }
      if (linkId === 'policy-holder-last-name' && primarySubscriberLastName) {
        answer = makeAnswer(primarySubscriberLastName);
      }
      if (linkId === 'policy-holder-last-name-2' && secondarySubscriberLastName) {
        answer = makeAnswer(secondarySubscriberLastName);
      }
      if (linkId === 'policy-holder-middle-name' && primarySubscriberMiddleName) {
        answer = makeAnswer(primarySubscriberMiddleName);
      }
      if (linkId === 'policy-holder-middle-name-2' && secondarySubscriberMiddleName) {
        answer = makeAnswer(secondarySubscriberMiddleName);
      }
      if (linkId === 'policy-holder-date-of-birth' && primarySubscriberDoB) {
        answer = makeAnswer(primarySubscriberDoB);
      }
      if (linkId === 'policy-holder-date-of-birth-2' && secondarySubscriberDoB) {
        answer = makeAnswer(secondarySubscriberDoB);
      }
      if (linkId === 'policy-holder-birth-sex' && primarySubscriberBirthSex) {
        answer = makeAnswer(primarySubscriberBirthSex);
      }
      if (linkId === 'policy-holder-birth-sex-2' && secondarySubscriberBirthSex) {
        answer = makeAnswer(capitalize(secondarySubscriberBirthSex));
      }
      if (linkId === 'policy-holder-address-as-patient' && policyHolderAddressAsPatient) {
        answer = makeAnswer(policyHolderAddressAsPatient, 'Boolean');
      }
      if (linkId === 'policy-holder-address-as-patient-2' && secondaryPolicyHolderAddressAsPatient) {
        answer = makeAnswer(secondaryPolicyHolderAddressAsPatient, 'Boolean');
      }
      if (linkId === 'patient-relationship-to-insured' && relationshipToInsured) {
        answer = makeAnswer(relationshipToInsured);
      }
      if (linkId === 'policy-holder-zip' && policyHolderZip) {
        answer = makeAnswer(policyHolderZip);
      }
      if (linkId === 'policy-holder-state' && policyHolderState) {
        answer = makeAnswer(policyHolderState);
      }
      if (linkId === 'policy-holder-city' && policyHolderCity) {
        answer = makeAnswer(policyHolderCity);
      }
      if (linkId === 'policy-holder-address-additional-line' && policyHolderAddressAdditionalLine) {
        answer = makeAnswer(policyHolderAddressAdditionalLine);
      }
      if (linkId === 'policy-holder-address' && policyHolderAddressLine) {
        answer = makeAnswer(policyHolderAddressLine);
      }
      if (linkId === 'insurance-additional-information' && primaryAdditionalInformation) {
        answer = makeAnswer(primaryAdditionalInformation);
      }
      if (linkId === 'insurance-priority') {
        answer = primary ? makeAnswer('Primary') : undefined;
      }
      if (linkId === 'patient-relationship-to-insured-2' && secondaryRelationshipToInsured) {
        answer = makeAnswer(secondaryRelationshipToInsured);
      }
      if (linkId === 'policy-holder-zip-2' && secondaryPolicyHolderZip) {
        answer = makeAnswer(secondaryPolicyHolderZip);
      }
      if (linkId === 'policy-holder-state-2' && secondaryPolicyHolderState) {
        answer = makeAnswer(secondaryPolicyHolderState);
      }
      if (linkId === 'policy-holder-city-2' && secondaryPolicyHolderCity) {
        answer = makeAnswer(secondaryPolicyHolderCity);
      }
      if (linkId === 'policy-holder-address-additional-line-2' && secondaryPolicyHolderAddressAdditionalLine) {
        answer = makeAnswer(secondaryPolicyHolderAddressAdditionalLine);
      }
      if (linkId === 'policy-holder-address-2' && secondaryPolicyHolderAddressLine) {
        answer = makeAnswer(secondaryPolicyHolderAddressLine);
      }
      if (linkId === 'insurance-additional-information-2' && secondaryAdditionalInformation) {
        answer = makeAnswer(secondaryAdditionalInformation);
      }
      if (linkId === 'insurance-priority-2') {
        answer = secondary ? makeAnswer('Secondary') : undefined;
      }
      if (linkId === 'insurance-card-front' && insuranceCardFrontDocumentReference) {
        answer = makeAnswer(insuranceCardFront, 'Attachment');
      }
      if (linkId === 'insurance-card-back' && insuranceCardBackDocumentReference) {
        answer = makeAnswer(insuranceCardBack, 'Attachment');
      }
      if (linkId === 'insurance-card-front-2' && secondaryInsuranceCardFrontDocumentReference) {
        answer = makeAnswer(secondaryInsuranceCardFront, 'Attachment');
      }
      if (linkId === 'insurance-card-back-2' && secondaryInsuranceCardBackDocumentReference) {
        answer = makeAnswer(secondaryInsuranceCardBack, 'Attachment');
      }

      return {
        linkId,
        answer,
      };
    });
};

const GUARANTOR_ITEMS = ['responsible-party-section', 'responsible-party-page'];
interface MapGuarantorItemsInput {
  items: QuestionnaireItem[];
  guarantorResource?: RelatedPerson | Patient;
}

const mapGuarantorToQuestionnaireResponseItems = (input: MapGuarantorItemsInput): QuestionnaireResponseItem[] => {
  const { guarantorResource, items } = input;

  const phone = formatPhoneNumberDisplay(
    guarantorResource?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value ?? ''
  );
  const email =
    guarantorResource?.telecom?.find((c) => c.system === 'email' && c.period?.end === undefined)?.value ?? '';
  let birthSex: string | undefined;
  if (guarantorResource?.gender) {
    const genderString = guarantorResource?.gender === 'other' ? 'Intersex' : guarantorResource?.gender;
    birthSex = capitalize(genderString);
  }
  const dob = guarantorResource?.birthDate;
  let firstName = '';
  let lastName = '';
  if (guarantorResource) {
    firstName = getFirstName(guarantorResource) ?? '';
    lastName = getLastName(guarantorResource) ?? '';
  }
  let relationship: string | undefined;
  if (guarantorResource && guarantorResource.resourceType === 'Patient') {
    relationship = 'Self';
  } else if (guarantorResource) {
    const relationCode = (guarantorResource as RelatedPerson)?.relationship;
    if (relationCode?.[0]) {
      const cc = relationCode[0];
      const coding = cc?.coding?.[0];

      // would be an improvement not to have to rely on display like this
      if (coding && coding.display) {
        relationship = coding.display;
      }
    }
  }

  const guarantorAddress = guarantorResource?.address?.[0];
  const line = guarantorAddress?.line?.[0];
  const line2 = guarantorAddress?.line?.[1];
  const city = guarantorAddress?.city;
  const state = guarantorAddress?.state;
  const zip = guarantorAddress?.postalCode;

  return items.map((item) => {
    let answer: QuestionnaireResponseItemAnswer[] | undefined;
    const { linkId } = item;

    if (linkId === 'responsible-party-relationship' && relationship) {
      answer = makeAnswer(relationship);
    }
    if (linkId === 'responsible-party-first-name' && firstName) {
      answer = makeAnswer(firstName);
    }
    if (linkId === 'responsible-party-last-name' && lastName) {
      answer = makeAnswer(lastName);
    }
    if (linkId === 'responsible-party-date-of-birth' && dob) {
      answer = makeAnswer(dob);
    }
    if (linkId === 'responsible-party-birth-sex' && birthSex) {
      answer = makeAnswer(birthSex);
    }
    if (linkId === 'responsible-party-number' && phone) {
      answer = makeAnswer(phone);
    }
    if (linkId === 'responsible-party-email' && email) {
      answer = makeAnswer(email);
    }
    if (linkId === 'responsible-party-address' && line) {
      answer = makeAnswer(line);
    }
    if (linkId === 'responsible-party-address-2' && line2) {
      answer = makeAnswer(line2);
    }
    if (linkId === 'responsible-party-city' && city) {
      answer = makeAnswer(city);
    }
    if (linkId === 'responsible-party-state' && state) {
      answer = makeAnswer(state);
    }
    if (linkId === 'responsible-party-zip' && zip) {
      answer = makeAnswer(zip);
    }
    return {
      linkId,
      answer,
    };
  });
};

function areAddressesEqual(address1?: Address, address2?: Address): boolean {
  if (!address1 && !address2) return true;
  if (!address1 || !address2) return false;

  if (!areArraysEqual(address1.line, address2.line)) {
    return false;
  }

  const stringProps: (keyof Address)[] = [
    'city',
    'state',
    'postalCode',
    // 'country',
  ];

  for (const prop of stringProps) {
    if (address1[prop] !== address2[prop]) {
      return false;
    }
  }

  return true;
}

function areArraysEqual(arr1?: string[], arr2?: string[]): boolean {
  if (!arr1 && !arr2) return true;
  if (!arr1 || !arr2) return false;

  if (arr1.length !== arr2.length) {
    return false;
  }

  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }

  return true;
}
