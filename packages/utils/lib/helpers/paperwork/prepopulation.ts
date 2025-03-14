import {
  Organization,
  Patient,
  Practitioner,
  PractitionerRole,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  Reference,
  RelatedPerson,
} from 'fhir/r4b';
import { getFirstName, getLastName, PRIVATE_EXTENSION_BASE_URL } from '../../fhir';
import { DateTime } from 'luxon';
import { formatPhoneNumberDisplay } from '../helpers';
import { PatientAccountResponse } from '../../types';
import { capitalize } from 'lodash-es';

// used when patient books an appointment and some of the inputs come from the create-appointment params
interface PrepopulationInput {
  patient: Patient;
  appointmentStartTime: string;
  isNewQrsPatient: boolean;
  verifiedPhoneNumber: string | undefined;
  questionnaire: Questionnaire;
  contactInfo: { phone: string; email: string } | undefined;
  newPatientDob?: string;
  unconfirmedDateOfBirth?: string;
  rp?: RelatedPerson;
}

export const makePrepopulatedItemsForPatient = (input: PrepopulationInput): QuestionnaireResponseItem[] => {
  const {
    patient,
    newPatientDob,
    unconfirmedDateOfBirth,
    appointmentStartTime: startTime,
    isNewQrsPatient,
    verifiedPhoneNumber,
    contactInfo,
    questionnaire,
  } = input;

  let formattedVerifiedPhoneNumber: string | undefined;
  if (verifiedPhoneNumber) {
    try {
      formattedVerifiedPhoneNumber = formatPhoneNumberDisplay(verifiedPhoneNumber.slice(-10));
    } catch (e) {
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

  const patientEthnicity = patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/ethnicity`)
    ?.valueCodeableConcept?.coding?.[0]?.display;
  const patientRace = patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/race`)
    ?.valueCodeableConcept?.coding?.[0]?.display;

  let patientSex: string | undefined;
  if (patient?.gender === 'male') {
    patientSex = 'Male';
  } else if (patient?.gender === 'female') {
    patientSex = 'Female';
  } else if (patient?.gender !== undefined) {
    patientSex = 'Intersex';
  }

  console.log('patient info for prepop: ');
  console.log('patient: ', JSON.stringify(patient, null, 2));
  console.log('patientSex', patientSex);
  const item: QuestionnaireResponseItem[] = (questionnaire.item ?? []).map((item) => {
    const populatedItem: QuestionnaireResponseItem[] = (() => {
      const itemItems = item.item ?? [].filter((i: QuestionnaireItem) => i.type !== 'display');
      if (item.linkId === 'contact-information-page') {
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
          if (linkId === 'patient-first-name') {
            answer = makeAnswer(getFirstName(patient) ?? '');
          }
          if (linkId === 'patient-last-name') {
            answer = makeAnswer(getLastName(patient) ?? '');
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
          if (linkId === 'patient-number' && formattedVerifiedPhoneNumber) {
            answer = makeAnswer(formattedVerifiedPhoneNumber);
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
        return itemItems.map((item) => {
          let answer: QuestionnaireResponseItemAnswer[] | undefined;
          const { linkId } = item;
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
      }
      return [];
    })();
    return {
      linkId: item.linkId,
      item: populatedItem,
    };
  });

  console.log('prepopulation result', JSON.stringify(item));

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

export interface PrepopulationFromPatientRecordInput extends PatientAccountResponse {
  questionnaire: Questionnaire;
}

export const makePrepopulatedItemsFromPatientRecord = (
  input: PrepopulationFromPatientRecordInput
): QuestionnaireResponseItem[] => {
  console.log('making prepopulated items from patient record');
  const { patient, questionnaire, primaryCarePhysician, coverages, insuranceOrgs, insurancePlans, guarantorResource } =
    input;
  const item: QuestionnaireResponseItem[] = (questionnaire.item ?? []).map((item) => {
    const populatedItem: QuestionnaireResponseItem[] = (() => {
      const itemItems = (item.item ?? []).filter((i: QuestionnaireItem) => i.type !== 'display');
      if (PATIENT_ITEMS.includes(item.linkId)) {
        console.log('mapping patient items', itemItems);
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
          insuranceOrgs,
          insurancePlans,
        });
      }
      if (GUANTOR_ITEMS.includes(item.linkId)) {
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

  let patientSex: string | undefined;
  if (patient?.gender === 'male') {
    patientSex = 'Male';
  } else if (patient?.gender === 'female') {
    patientSex = 'Female';
  } else if (patient?.gender !== undefined) {
    patientSex = 'Intersex';
  }

  const patientDOB = patient.birthDate;

  /*
    things missing here: 
    - sexual orientation
    - preferred language
    - gender identity (this is conflated with birth sex currently i believe)
    - point of contact (how did you hear about us)

    missing but probably shouldn't be changeable by ehr user
    - marketing messages
    - CommonWell consent
  */

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
      answer = makeAnswer(patientPhone);
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
  role?: PractitionerRole;
  org?: Organization;
}
const mapPCPToQuestionnaireResponseItems = (input: MapPCPItemsInput): QuestionnaireResponseItem[] => {
  const { physician, items, org } = input;

  /*
   const pcp = patient?.contained?.find(
    (resource) => resource.resourceType === 'Practitioner' && resource.active === true
  ) as Practitioner;
  const practiceName = pcp?.extension?.find((e: { url: string }) => e.url === PRACTICE_NAME_URL)?.valueString;


  */

  const phone = physician?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value;

  return items.map((item) => {
    let answer: QuestionnaireResponseItemAnswer[] | undefined;
    const { linkId } = item;

    if (linkId === 'pcp-first') {
      if (physician) {
        answer = makeAnswer(getFirstName(physician) ?? '');
      } else {
        answer = makeAnswer('');
      }
    }
    if (linkId === 'pcp-last') {
      if (physician) {
        answer = makeAnswer(getLastName(physician) ?? '');
      } else {
        answer = makeAnswer('');
      }
    }

    if (linkId === 'pcp-practice') {
      // not really sure where this will come from yet...
      answer = makeAnswer(org?.name ?? '');
    }

    if (linkId === 'pcp-address') {
      // not really sure where this will come from yet...
      answer = makeAnswer(org?.address?.[0]?.line?.[0] ?? '');
    }

    if (linkId === 'pcp-number') {
      answer = makeAnswer(phone ?? '');
    }
    return {
      linkId,
      answer,
    };
  });
};

const COVERAGE_ITEMS = ['insurance-section', 'payment-option-page'];
interface MapCoverageItemsInput {
  items: QuestionnaireItem[];
  coverages: PatientAccountResponse['coverages'];
  insurancePlans: PatientAccountResponse['insurancePlans'];
  insuranceOrgs: PatientAccountResponse['insuranceOrgs'];
}
const mapCoveragesToQuestionnaireResponseItems = (input: MapCoverageItemsInput): QuestionnaireResponseItem[] => {
  const { items, coverages, insuranceOrgs, insurancePlans } = input;

  const { primary, secondary, primarySubscriber, secondarySubscriber } = coverages;

  let primaryInsurancePlanReference: Reference | undefined;
  let secondaryInsurancePlanReference: Reference | undefined;

  let primaryMemberId = '';
  let secondaryMemberId = '';

  if (primary && insuranceOrgs && insurancePlans) {
    const matchingOrg = insuranceOrgs.find((org) => org.id === primary.payor?.[0].reference);
    const matchingPlan =
      matchingOrg &&
      insurancePlans.find((plan) => plan.ownedBy?.reference === `${matchingOrg.resourceType}/${matchingOrg.id}`);
    if (matchingPlan) {
      primaryInsurancePlanReference = { reference: `${matchingPlan.resourceType}/${matchingPlan.id}` };
    }
  }
  if (secondary && insuranceOrgs && insurancePlans) {
    const matchingOrg = insuranceOrgs.find((org) => org.id === secondary.payor?.[0].reference);
    const matchingPlan =
      matchingOrg &&
      insurancePlans.find((plan) => plan.ownedBy?.reference === `${matchingOrg.resourceType}/${matchingOrg.id}`);
    if (matchingPlan) {
      secondaryInsurancePlanReference = { reference: `${matchingPlan.resourceType}/${matchingPlan.id}` };
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
  const primarySubscriberBirthSex = primarySubscriber?.gender ?? '';
  let primarySubscriberFirstName = '';
  let primarySubscriberLastName = '';
  let primarySubscriberMiddleName = '';

  if (primarySubscriber) {
    primarySubscriberFirstName = getFirstName(primarySubscriber) ?? '';
    primarySubscriberLastName = getLastName(primarySubscriber) ?? '';
    primarySubscriberMiddleName = primarySubscriber.name?.[0]?.given?.[1] ?? '';
  }
  const secondarySubscriberDoB = secondarySubscriber?.birthDate;
  const secondarySubscriberBirthSex = secondarySubscriber?.gender;
  let secondarySubscriberFirstName: string | undefined;
  let secondarySubscribeLastName: string | undefined;
  let secondarySubscriberMiddleName: string | undefined;
  if (secondarySubscriber) {
    secondarySubscriberFirstName = getFirstName(secondarySubscriber) ?? '';
    secondarySubscribeLastName = getLastName(secondarySubscriber) ?? '';
    secondarySubscriberMiddleName = secondarySubscriber.name?.[0]?.given?.[1] ?? '';
  }

  return items.map((item) => {
    let answer: QuestionnaireResponseItemAnswer[] | undefined;
    const { linkId } = item;

    if (linkId === 'secondary-insurance' && item.type === 'group') {
      return {
        linkId,
        item: mapCoveragesToQuestionnaireResponseItems({ ...input, items: item.item ?? [] }),
      };
    }
    if (linkId === 'insurance-carrier') {
      answer = makeAnswer(primaryInsurancePlanReference, 'Reference');
    }
    if (linkId === 'insurance-carrier-2') {
      answer = makeAnswer(secondaryInsurancePlanReference, 'Reference');
    }
    if (linkId === 'insurance-member-id') {
      answer = makeAnswer(primaryMemberId);
    }
    if (linkId === 'insurance-member-id-2') {
      answer = makeAnswer(secondaryMemberId);
    }
    if (linkId === 'policy-holder-first-name') {
      answer = makeAnswer(primarySubscriberFirstName);
    }
    if (linkId === 'policy-holder-first-name-2' && secondarySubscriberFirstName) {
      answer = makeAnswer(secondarySubscriberFirstName);
    }
    if (linkId === 'policy-holder-last-name') {
      answer = makeAnswer(primarySubscriberLastName);
    }
    if (linkId === 'policy-holder-last-name-2' && secondarySubscribeLastName) {
      answer = makeAnswer(secondarySubscribeLastName);
    }
    if (linkId === 'policy-holder-middle-name') {
      answer = makeAnswer(primarySubscriberMiddleName);
    }
    if (linkId === 'policy-holder-middle-name-2' && secondarySubscriberMiddleName) {
      answer = makeAnswer(secondarySubscriberMiddleName);
    }
    if (linkId === 'policy-holder-date-of-birth') {
      answer = makeAnswer(primarySubscriberDoB);
    }
    if (linkId === 'policy-holder-date-of-birth-2' && secondarySubscriberDoB) {
      answer = makeAnswer(secondarySubscriberDoB);
    }
    if (linkId === 'policy-holder-birth-sex') {
      answer = makeAnswer(primarySubscriberBirthSex);
    }
    if (linkId === 'policy-holder-birth-sex-2' && secondarySubscriberBirthSex) {
      answer = makeAnswer(secondarySubscriberBirthSex);
    }

    return {
      linkId,
      answer,
    };
  });
};

const GUANTOR_ITEMS = ['responsible-party-section', 'responsible-party-page'];
interface MapGuantorItemsInput {
  items: QuestionnaireItem[];
  guarantorResource?: RelatedPerson | Patient;
}

const mapGuarantorToQuestionnaireResponseItems = (input: MapGuantorItemsInput): QuestionnaireResponseItem[] => {
  const { guarantorResource, items } = input;

  const phone =
    guarantorResource?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value ?? '';
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

      if (coding && coding.code) {
        relationship = capitalize(coding.code);
      }
    }
  }
  return items.map((item) => {
    let answer: QuestionnaireResponseItemAnswer[] | undefined;
    const { linkId } = item;

    if (linkId === 'responsible-party-relationship' && relationship) {
      answer = makeAnswer(relationship);
    }
    if (linkId === 'responsible-party-first-name') {
      answer = makeAnswer(firstName);
    }
    if (linkId === 'responsible-party-last-name') {
      answer = makeAnswer(lastName);
    }
    if (linkId === 'responsible-party-date-of-birth') {
      answer = makeAnswer(dob);
    }
    if (linkId === 'responsible-party-birth-sex' && birthSex) {
      answer = makeAnswer(birthSex);
    }
    if (linkId === 'responsible-party-number') {
      answer = makeAnswer(phone);
    }
    return {
      linkId,
      answer,
    };
  });
};
