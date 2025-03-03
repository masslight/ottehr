import {
  Patient,
  Practitioner,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  RelatedPerson,
} from 'fhir/r4b';
import { getFirstName, getLastName, getPronounsFromExtension, PRIVATE_EXTENSION_BASE_URL } from '../../fhir';
import { DateTime } from 'luxon';
import { formatPhoneNumberDisplay } from '../helpers';
import { DATE_OF_BIRTH_URL, PRACTICE_NAME_URL } from '../../types';

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

  const pronouns = getPronounsFromExtension(patient);
  const language = patient.communication?.find((lang) => lang.preferred)?.language.coding?.[0].display;

  let patientSex: string | undefined;
  if (patient?.gender === 'male') {
    patientSex = 'Male';
  } else if (patient?.gender === 'female') {
    patientSex = 'Female';
  } else if (patient?.gender !== undefined) {
    patientSex = 'Intersex';
  }

  const pcp = patient.contained?.find(
    (resource): resource is Practitioner => resource.resourceType === 'Practitioner' && resource.active === true
  );
  const pcpPractice = pcp?.extension?.find((e) => e.url === PRACTICE_NAME_URL)?.valueString;
  const pcpAddress = pcp?.address?.[0]?.line?.[0];
  const pcpPhoneNumber = pcp?.telecom?.[0]?.value;

  let formattedPcpPhoneNumber: string | undefined;
  if (pcpPhoneNumber) {
    try {
      formattedPcpPhoneNumber = formatPhoneNumberDisplay(pcpPhoneNumber.slice(-10));
    } catch (e) {
      console.log('unable to format phone number', pcpPhoneNumber);
    }
  }

  const responsibleParty = patient.contact?.find(
    (contact) =>
      contact.relationship?.some(
        (rel) =>
          rel.coding?.some(
            (code) => code.system === 'http://terminology.hl7.org/CodeSystem/v2-0131' && code.code === 'BP'
          )
      )
  );

  const responsiblePartyRelationship = responsibleParty?.relationship?.find(
    (rel) => rel.coding?.some((coding) => coding.system === 'http://hl7.org/fhir/relationship')
  )?.coding?.[0].display;

  const responsiblePartyFirstName = responsibleParty?.name?.given?.[0];
  const responsiblePartyLastName = responsibleParty?.name?.family;
  const responsiblePartyBirthDate = responsibleParty?.extension?.find((e) => e.url === DATE_OF_BIRTH_URL)?.valueString;

  let responsiblePartySex: string | undefined;
  if (patient?.gender === 'male') {
    responsiblePartySex = 'Male';
  } else if (patient?.gender === 'female') {
    responsiblePartySex = 'Female';
  } else if (patient?.gender !== undefined) {
    responsiblePartySex = 'Intersex';
  }
  const responsiblePartyPhoneNumber = responsibleParty?.telecom?.find((telecom) => telecom.system === 'phone')?.value;
  let formattedResponsiblePartyPhoneNumber: string | undefined;
  if (responsiblePartyPhoneNumber) {
    try {
      formattedResponsiblePartyPhoneNumber = formatPhoneNumberDisplay(responsiblePartyPhoneNumber.slice(-10));
    } catch (e) {
      console.log('unable to format phone number', responsiblePartyPhoneNumber);
    }
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
          if (linkId === 'patient-pronouns' && pronouns) {
            answer = makeAnswer(pronouns);
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
      } else if (item.linkId === 'primary-care-physician-page') {
        return itemItems.map((item) => {
          let answer: QuestionnaireResponseItemAnswer[] | undefined;
          const { linkId } = item;
          if (linkId === 'pcp-first' && pcp) {
            answer = makeAnswer(getFirstName(pcp) ?? '');
          }
          if (linkId === 'pcp-last' && pcp) {
            answer = makeAnswer(getLastName(pcp) ?? '');
          }
          if (linkId === 'pcp-practice' && pcpPractice) {
            answer = makeAnswer(pcpPractice);
          }
          if (linkId === 'pcp-address' && pcpAddress) {
            answer = makeAnswer(pcpAddress);
          }
          if (linkId === 'pcp-number' && formattedPcpPhoneNumber) {
            answer = makeAnswer(formattedPcpPhoneNumber);
          }

          return {
            linkId,
            answer,
          };
        });
      } else if (item.linkId === 'responsible-party-page') {
        return itemItems.map((item) => {
          let answer: QuestionnaireResponseItemAnswer[] | undefined;
          const { linkId } = item;
          if (linkId === 'responsible-party-relationship' && responsiblePartyRelationship) {
            answer = makeAnswer(responsiblePartyRelationship);
          }
          if (linkId === 'responsible-party-first-name' && responsiblePartyFirstName) {
            answer = makeAnswer(responsiblePartyFirstName);
          }
          if (linkId === 'responsible-party-last-name' && responsiblePartyLastName) {
            answer = makeAnswer(responsiblePartyLastName);
          }
          if (linkId === 'responsible-party-date-of-birth' && responsiblePartyBirthDate) {
            answer = makeAnswer(responsiblePartyBirthDate);
          }
          if (linkId === 'responsible-party-birth-sex' && responsiblePartySex) {
            answer = makeAnswer(responsiblePartySex);
          }
          if (linkId === 'responsible-party-number' && formattedResponsiblePartyPhoneNumber) {
            answer = makeAnswer(formattedResponsiblePartyPhoneNumber);
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

type AnswerType = 'String' | 'Boolean';
const makeAnswer = (val: any, type: AnswerType = 'String'): QuestionnaireResponseItemAnswer[] => {
  return [
    {
      [`value${type}`]: val,
    },
  ];
};
