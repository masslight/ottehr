import {
  Organization,
  Patient,
  Practitioner,
  PractitionerRole,
  Coverage,
  DocumentReference,
  InsurancePlan,
  Questionnaire,
  QuestionnaireItem,
  QuestionnaireResponseItem,
  QuestionnaireResponseItemAnswer,
  Reference,
  RelatedPerson,
} from 'fhir/r4b';
import { getFirstName, getLastName, getPronounsFromExtension, PRIVATE_EXTENSION_BASE_URL } from '../../fhir';
import { DateTime } from 'luxon';
import { formatPhoneNumberDisplay } from '../helpers';
import { PatientAccountResponse } from '../../types';
import { capitalize } from 'lodash-es';
import { DATE_OF_BIRTH_URL, PRACTICE_NAME_URL } from '../../types';

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
  documents?: DocumentReference[];
  insuranceInfo?: (Coverage | RelatedPerson | Organization | InsurancePlan)[];
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
    documents,
    insuranceInfo,
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

  const primaryCoverage = insuranceInfo?.find(
    (resource): resource is Coverage => resource.resourceType === 'Coverage' && resource.order === 1
  );
  const primaryPolicyHolder = insuranceInfo?.find(
    (resource): resource is RelatedPerson =>
      resource.resourceType === 'RelatedPerson' &&
      resource.id === primaryCoverage?.subscriber?.reference?.replace('RelatedPerson/', '')
  );
  const primaryInsurancePlan = insuranceInfo?.find(
    (resource): resource is InsurancePlan =>
      resource.resourceType === 'InsurancePlan' && resource.ownedBy?.reference === primaryCoverage?.payor?.[0].reference
  );

  const relationshipToInsured = primaryCoverage?.relationship?.coding?.[0].display;
  const policyHolderAddress = primaryPolicyHolder?.address?.[0];
  const policyHolderZip = policyHolderAddress?.postalCode;
  const policyHolderState = policyHolderAddress?.state;
  const policyHolderCity = policyHolderAddress?.city;
  const policyHolderAddressAdditionalLine = policyHolderAddress?.line?.[1];
  const policyHolderAddressLine = policyHolderAddress?.line?.[0];

  let policyHolderBirthSex: string | undefined;
  if (primaryPolicyHolder?.gender === 'male') {
    policyHolderBirthSex = 'Male';
  } else if (primaryPolicyHolder?.gender === 'female') {
    policyHolderBirthSex = 'Female';
  } else if (primaryPolicyHolder?.gender !== undefined) {
    policyHolderBirthSex = 'Intersex';
  }

  const policyHolderBirthDate = primaryPolicyHolder?.birthDate;
  const policyHolderLastName = primaryPolicyHolder?.name?.[0].family;
  const policyHolderMiddleName = primaryPolicyHolder?.name?.[0].given?.[1];
  const policyHolderFirstName = primaryPolicyHolder?.name?.[0].given?.[0];
  const insuranceMemberId = primaryCoverage?.subscriberId;
  const insuranceCarrier = {
    reference: `InsurancePlan/${primaryInsurancePlan?.id}`,
    display: primaryCoverage?.class?.[0].name,
  };

  const paymentOption = primaryCoverage ? 'I have insurance' : 'I will pay without insurance';

  const secondaryCoverage = insuranceInfo?.find(
    (resource): resource is Coverage => resource.resourceType === 'Coverage' && resource.order === 2
  );

  const displaySecondaryInsurance = secondaryCoverage ? true : false;

  const secondaryPolicyHolder = insuranceInfo?.find(
    (resource): resource is RelatedPerson =>
      resource.resourceType === 'RelatedPerson' &&
      resource.id === secondaryCoverage?.subscriber?.reference?.replace('RelatedPerson/', '')
  );
  const secondaryInsurancePlan = insuranceInfo?.find(
    (resource): resource is InsurancePlan =>
      resource.resourceType === 'InsurancePlan' &&
      resource.ownedBy?.reference === secondaryCoverage?.payor?.[0].reference
  );

  const secondaryCoverageRelationshipToInsured = secondaryCoverage?.relationship?.coding?.[0].display;
  const secondaryPolicyHolderAddress = secondaryPolicyHolder?.address?.[0];
  const secondaryPolicyHolderZip = secondaryPolicyHolderAddress?.postalCode;
  const secondaryPolicyHolderState = secondaryPolicyHolderAddress?.state;
  const secondaryPolicyHolderCity = secondaryPolicyHolderAddress?.city;
  const secondaryPolicyHolderAddressAdditionalLine = secondaryPolicyHolderAddress?.line?.[1];
  const secondaryPolicyHolderAddressLine = secondaryPolicyHolderAddress?.line?.[0];

  let secondaryPolicyHolderBirthSex: string | undefined;
  if (secondaryPolicyHolder?.gender === 'male') {
    secondaryPolicyHolderBirthSex = 'Male';
  } else if (secondaryPolicyHolder?.gender === 'female') {
    secondaryPolicyHolderBirthSex = 'Female';
  } else if (secondaryPolicyHolder?.gender !== undefined) {
    secondaryPolicyHolderBirthSex = 'Intersex';
  }

  const secondaryPolicyHolderBirthDate = secondaryPolicyHolder?.birthDate;
  const secondaryPolicyHolderLastName = secondaryPolicyHolder?.name?.[0].family;
  const secondaryPolicyHolderMiddleName = secondaryPolicyHolder?.name?.[0].given?.[1];
  const secondaryPolicyHolderFirstName = secondaryPolicyHolder?.name?.[0].given?.[0];
  const secondaryInsuranceMemberId = secondaryCoverage?.subscriberId;
  const secondaryInsuranceCarrier = {
    reference: `InsurancePlan/${secondaryInsurancePlan?.id}`,
    display: secondaryCoverage?.class?.[0].name,
  };

  console.log('patient info for prepop: ');
  console.log('patient: ', JSON.stringify(patient, null, 2));
  console.log('patientSex', patientSex);
  console.log('documents: ', JSON.stringify(documents, null, 2));
  console.log('insurance related resources: ', JSON.stringify(insuranceInfo, null, 2));

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
      } else if (item.linkId === 'payment-option-page') {
        return itemItems.map((item) => {
          let answer: QuestionnaireResponseItemAnswer[] | undefined;
          let nestedItem: QuestionnaireResponseItem[] | undefined;
          const { linkId } = item;
          if (linkId === 'insurance-card-front' && insuranceCardFrontDocumentReference) {
            answer = makeAnswer(insuranceCardFront, 'Attachment');
          }
          if (linkId === 'insurance-card-back' && insuranceCardBackDocumentReference) {
            answer = makeAnswer(insuranceCardBack, 'Attachment');
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
          if (linkId === 'policy-holder-birth-sex' && policyHolderBirthSex) {
            answer = makeAnswer(policyHolderBirthSex);
          }
          if (linkId === 'policy-holder-date-of-birth' && policyHolderBirthDate) {
            answer = makeAnswer(policyHolderBirthDate);
          }
          if (linkId === 'policy-holder-last-name' && policyHolderLastName) {
            answer = makeAnswer(policyHolderLastName);
          }
          if (linkId === 'policy-holder-middle-name' && policyHolderMiddleName) {
            answer = makeAnswer(policyHolderMiddleName);
          }
          if (linkId === 'policy-holder-first-name' && policyHolderFirstName) {
            answer = makeAnswer(policyHolderFirstName);
          }
          if (linkId === 'insurance-member-id' && insuranceMemberId) {
            answer = makeAnswer(insuranceMemberId);
          }
          if (linkId === 'insurance-carrier' && primaryInsurancePlan) {
            answer = makeAnswer(insuranceCarrier, 'Reference');
          }
          if (linkId === 'payment-option' && paymentOption) {
            answer = makeAnswer(paymentOption);
          }
          if (linkId === 'display-secondary-insurance') {
            answer = makeAnswer(displaySecondaryInsurance, 'Boolean');
          }
          if (linkId === 'secondary-insurance') {
            nestedItem = item.item?.map((item) => {
              let answer: QuestionnaireResponseItemAnswer[] | undefined;
              const { linkId } = item;
              if (linkId === 'insurance-card-front-2' && secondaryInsuranceCardFrontDocumentReference) {
                answer = makeAnswer(secondaryInsuranceCardFront, 'Attachment');
              }
              if (linkId === 'insurance-card-back-2' && secondaryInsuranceCardBackDocumentReference) {
                answer = makeAnswer(secondaryInsuranceCardBack, 'Attachment');
              }
              if (linkId === 'patient-relationship-to-insured-2' && secondaryCoverageRelationshipToInsured) {
                answer = makeAnswer(secondaryCoverageRelationshipToInsured);
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
              if (linkId === 'policy-holder-birth-sex-2' && secondaryPolicyHolderBirthSex) {
                answer = makeAnswer(secondaryPolicyHolderBirthSex);
              }
              if (linkId === 'policy-holder-date-of-birth-2' && secondaryPolicyHolderBirthDate) {
                answer = makeAnswer(secondaryPolicyHolderBirthDate);
              }
              if (linkId === 'policy-holder-last-name-2' && secondaryPolicyHolderLastName) {
                answer = makeAnswer(secondaryPolicyHolderLastName);
              }
              if (linkId === 'policy-holder-middle-name-2' && secondaryPolicyHolderMiddleName) {
                answer = makeAnswer(secondaryPolicyHolderMiddleName);
              }
              if (linkId === 'policy-holder-first-name-2' && secondaryPolicyHolderFirstName) {
                answer = makeAnswer(secondaryPolicyHolderFirstName);
              }
              if (linkId === 'insurance-member-id-2' && secondaryInsuranceMemberId) {
                answer = makeAnswer(secondaryInsuranceMemberId);
              }
              if (linkId === 'insurance-carrier-2' && secondaryInsurancePlan) {
                answer = makeAnswer(secondaryInsuranceCarrier, 'Reference');
              }
              return {
                linkId,
                answer,
              };
            });
          }

          return {
            linkId,
            answer,
            item: nestedItem,
          };
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

  console.log('mapping coverages to questionnaire response items', insuranceOrgs, insurancePlans);

  const { primary, secondary, primarySubscriber, secondarySubscriber } = coverages;

  let primaryInsurancePlanReference: Reference | undefined;
  let secondaryInsurancePlanReference: Reference | undefined;

  let primaryMemberId = '';
  let secondaryMemberId = '';

  if (primary && insuranceOrgs && insurancePlans) {
    const matchingOrg = insuranceOrgs.find((org) => `${org.resourceType}/${org.id}` === primary.payor?.[0].reference);
    const matchingPlan =
      matchingOrg &&
      insurancePlans.find((plan) => plan.ownedBy?.reference === `${matchingOrg.resourceType}/${matchingOrg.id}`);
    if (matchingPlan) {
      primaryInsurancePlanReference = {
        reference: `${matchingPlan.resourceType}/${matchingPlan.id}`,
        display: matchingPlan.name,
      };
    }
  }
  if (secondary && insuranceOrgs && insurancePlans) {
    const matchingOrg = insuranceOrgs.find((org) => `${org.resourceType}/${org.id}` === secondary.payor?.[0].reference);
    const matchingPlan =
      matchingOrg &&
      insurancePlans.find((plan) => plan.ownedBy?.reference === `${matchingOrg.resourceType}/${matchingOrg.id}`);
    if (matchingPlan) {
      secondaryInsurancePlanReference = {
        reference: `${matchingPlan.resourceType}/${matchingPlan.id}`,
        display: matchingPlan.name,
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
  const primarySubscriberBirthSex = capitalize(primarySubscriber?.gender ?? '');
  let primarySubscriberFirstName = '';
  let primarySubscriberLastName = '';
  let primarySubscriberMiddleName = '';
  const relationshipToInsured = primary?.relationship?.coding?.[0].display;
  const policyHolderAddress = primarySubscriber?.address?.[0];
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
      console.log('insurance carrier answer', answer);
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
      answer = makeAnswer(capitalize(secondarySubscriberBirthSex));
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

    if (linkId === 'insurance-priority') {
      // todo
      answer = makeAnswer('Primary');
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

      // would be an improvement not to have to rely on display like this
      if (coding && coding.display) {
        relationship = coding.display;
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
