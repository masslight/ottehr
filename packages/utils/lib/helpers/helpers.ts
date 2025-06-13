import Oystehr, { OystehrConfig } from '@oystehr/sdk';
import { Appointment, Extension, PaymentNotice, QuestionnaireResponseItemAnswer, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { phone } from 'phone';
import { OTTEHR_MODULE, PAYMENT_METHOD_EXTENSION_URL } from '../fhir';
import { CashPaymentDTO, PatchPaperworkParameters } from '../types';
import { phoneRegex, zipRegex } from '../validation';

export function createOystehrClient(token: string, fhirAPI: string, projectAPI: string): Oystehr {
  const FHIR_API = fhirAPI.replace(/\/r4/g, '');
  const CLIENT_CONFIG: OystehrConfig = {
    accessToken: token,
    fhirApiUrl: FHIR_API,
    projectApiUrl: projectAPI,
  };
  console.log('creating fhir client');
  return new Oystehr(CLIENT_CONFIG);
}

export function getParticipantIdFromAppointment(
  appointment: Appointment,
  participant: 'Patient' | 'Practitioner'
): string | undefined {
  return appointment.participant
    .find((currentParticipant: any) => currentParticipant.actor?.reference?.startsWith(participant))
    ?.actor?.reference?.replace(`${participant}/`, '');
}

/*
export function getAppointmentConfirmationMessage(
  appointmentID: string,
  locationName: string,
  startTime: string,
  websiteURL: string,
  firstName: string
): string {
  return `You're confirmed! Your check-in time for ${firstName} at ${locationName} is ${startTime}. Please save time at check-in by completing your pre-visit paperwork, or modify/cancel your visit: ${websiteURL}/appointment/${appointmentID}`;
}
  */

export function checkValidBookingTime(slotTime: string): boolean {
  const slotDate = DateTime.fromISO(slotTime);

  const currentDate = DateTime.now().setZone('UTC');

  return slotDate > currentDate;
}

export function getBucketAndObjectFromZ3URL(z3URL: string, projectAPI: string): { bucket: string; object: string } {
  const updatedPhotoIdFrontUrl = z3URL.replace(`${projectAPI}/z3/object/`, '');
  const photoIdFrontItems = updatedPhotoIdFrontUrl.split('/');
  const bucket = photoIdFrontItems[0];
  const object = photoIdFrontItems.slice(1).join('/');
  return { bucket, object };
}

export const isPostalCodeValid = (postalCode: string | undefined): boolean => {
  if (!postalCode) {
    return false;
  }
  return zipRegex.test(postalCode);
};

export const isPhoneNumberValid = (phoneNumber: string | undefined): boolean => {
  if (!phoneNumber) {
    return false;
  }
  const plusOneRegex = /^\+1\d{10}$/;
  const tenDigitRegex = /^\d{10}$/;
  return (
    plusOneRegex.test(phoneNumber) ||
    tenDigitRegex.test(phoneNumber) ||
    phoneRegex.test(phoneNumber) ||
    phone(phoneNumber).isValid
  );
};

export function formatPhoneNumber(phoneNumber: string | undefined): string | undefined {
  phoneNumber = phoneNumber?.replace(/([^0-9+])/g, '');
  if (!phoneNumber) {
    return phoneNumber;
  }
  if (!isPhoneNumberValid(phoneNumber)) {
    throw new Error('Invalid phone number format');
  }
  const tenDigitRegex = /^\d{10}$/;
  return tenDigitRegex.test(phoneNumber) ? `+1${phoneNumber}` : phoneNumber;
}

export const isNPIValid = (npi: string): boolean => {
  const npiRegex = /^\d{10}$/;
  return npiRegex.test(npi);
};

export function formatPhoneNumberDisplay(phoneNumber: string): string {
  const cleaned = ('' + phoneNumber.slice(-10)).replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);

  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }

  return phoneNumber;
}

const getExtensionStartTimeValue = (extension: Extension): string | undefined =>
  extension?.extension?.find((element: any) => element.url === 'startTime')?.valueTime;
const getExtensionCapacityValue = (extension: Extension): number | undefined =>
  extension?.extension?.find((element: any) => element.url === 'capacity')?.valueUnsignedInt;

export function findFirstAndLastTimeSlot(arr: Extension[]): {
  firstFulfillmentIndex: number;
  lastFulfillmentIndex: number;
} {
  let firstFulfillmentIndex = -1;
  let lastFulfillmentIndex = -1;

  for (let i = 0; i < arr.length; i++) {
    const hourStart = getExtensionStartTimeValue(arr[i]);
    const capacity = getExtensionCapacityValue(arr[i]);

    if (!hourStart || !capacity) {
      continue;
    }

    if (firstFulfillmentIndex === -1) {
      firstFulfillmentIndex = i;
    }

    lastFulfillmentIndex = i;
  }

  return { firstFulfillmentIndex, lastFulfillmentIndex };
}

// https://stackoverflow.com/a/13653180/2150542
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isValidUUID = (maybeUUID: string): boolean => {
  return uuidRegex.test(maybeUUID);
};

export const deepCopy = <T extends object>(source: T): T => {
  return JSON.parse(JSON.stringify(source));
};

function timeout(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
export async function sleep(period: number): Promise<void> {
  await timeout(period);
}

export const removePrefix = (prefix: string, text: string): string | undefined => {
  return text.includes(prefix) ? text.replace(prefix, '') : undefined;
};

export const diffInMinutes = (laterDate: DateTime, earlierDate: DateTime): number =>
  Math.round(laterDate.diff(earlierDate, 'minutes').minutes);

export function stripMarkdownLink(text: string): string {
  try {
    const str = String(text).replace(/(?:__|[*#])|\[(.*?)\]\(.*?\)/gm, '$1');
    return str;
  } catch (_) {
    return text;
  }
}

export function validateDefined<T>(value: T, name: string): NonNullable<T> {
  if (value == null) {
    throw new Error(`"${name}" is undefined`);
  }
  return value;
}

export function standardizePhoneNumber(phoneNumber: string | undefined): string | undefined {
  // input format:  some arbitrary format which may or may not include (, ), -, +1
  // output format: (XXX) XXX-XXXX
  if (!phoneNumber) {
    return phoneNumber;
  }

  const digits = phoneNumber.replace(/\D/g, '');
  let phoneNumberDigits = undefined;

  if (digits.length === 10) {
    phoneNumberDigits = digits;
  } else if (digits.length === 11 && digits.startsWith('1')) {
    phoneNumberDigits = digits.slice(1);
  }

  return formatPhoneNumber(phoneNumberDigits);
}

export function resourceHasMetaTag(resource: Resource, metaTag: OTTEHR_MODULE): boolean {
  return Boolean(resource.meta?.tag?.find((coding) => coding.code === metaTag));
}

export const formatPhoneNumberForQuestionnaire = (phone: string): string => {
  if (phone.length !== 10) {
    throw new Error('Invalid phone number');
  }
  return `(${phone.slice(0, 3)}) ${phone.slice(3, 6)}-${phone.slice(6)}`;
};

export const objectToDateString = (dateObj: { year: string; month: string; day: string }): string => {
  const { year, month, day } = dateObj;
  return `${year}-${month}-${day}`;
};

export const isoToDateObject = (isoString: string): { year: string; month: string; day: string } | '' => {
  if (!isoString) return '';

  const date = new Date(isoString);

  return {
    day: date.getDate().toString().padStart(2, '0'),
    month: (date.getMonth() + 1).toString().padStart(2, '0'),
    year: date.getFullYear().toString(),
  };
};

export const DEMO_VISIT_STREET_ADDRESS = `20250519 Test Line`;
export const DEMO_VISIT_STREET_ADDRESS_OPTIONAL = 'Apt 4B';
export const DEMO_VISIT_CITY = 'New York';
export const DEMO_VISIT_STATE = 'NY';
export const DEMO_VISIT_ZIP = '06001';
export const DEMO_VISIT_RESPONSIBLE_RELATIONSHIP = 'Legal Guardian';
export const DEMO_VISIT_RESPONSIBLE_FIRST_NAME = 'fwe';
export const DEMO_VISIT_RESPONSIBLE_LAST_NAME = 'sf';
export const DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_DAY = '13';
export const DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_MONTH = '05';
export const DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_YEAR = '1900';
export const DEMO_VISIT_RESPONSIBLE_BIRTH_SEX = 'Intersex';
export const DEMO_VISIT_RESPONSIBLE_PHONE = '(244) 333-3333';
export const DEMO_VISIT_RESPONSIBLE_ADDRESS1 = '333 test street';
export const DEMO_VISIT_RESPONSIBLE_CITY = 'Cleveland';
export const DEMO_VISIT_RESPONSIBLE_STATE = 'OH';
export const DEMO_VISIT_RESPONSIBLE_ZIP = '44101';
export const DEMO_VISIT_PATIENT_ETHNICITY = 'Decline to Specify';
export const DEMO_VISIT_PATIENT_RACE = 'Native Hawaiian or Other Pacific Islander';
export const DEMO_VISIT_POINT_OF_DISCOVERY = 'Friend/Family';
export const DEMO_VISIT_MARKETING_MESSAGING = true;
export const DEMO_VISIT_PREFERRED_LANGUAGE = 'English';
export const DEMO_VISIT_PROVIDER_FIRST_NAME = 'Provider first name';
export const DEMO_VISIT_PROVIDER_LAST_NAME = 'Provider last name';
export const DEMO_VISIT_PRACTICE_NAME = 'Practice name';
export const DEMO_VISIT_PHYSICIAN_ADDRESS = '441 4th Street, NW';
export const DEMO_VISIT_PHYSICIAN_MOBILE = '(123) 456-7890';

export function getContactInformationAnswers({
  willBe18 = false,
  isNewPatient = false,
  firstName = 'TEST-FIRST-NAME',
  lastName = 'TEST-LAST-NAME',
  birthDate = {
    day: '02',
    month: '02',
    year: '1990',
  },
  birthSex = 'Female',
  address = {
    street: DEMO_VISIT_STREET_ADDRESS,
    street2: DEMO_VISIT_STREET_ADDRESS_OPTIONAL,
    city: DEMO_VISIT_CITY,
    state: DEMO_VISIT_STATE,
    zip: DEMO_VISIT_ZIP,
  },
  email = 'test-email@test-domain-1237843298123.co',
  phoneNumber = '(202) 733-9622',

  mobileOptIn = DEMO_VISIT_MARKETING_MESSAGING,
}: {
  willBe18?: boolean;
  isNewPatient?: boolean;
  firstName?: string;
  lastName?: string;
  birthDate?: { day: string; month: string; year: string };
  birthSex?: string;
  address?: { street: string; street2: string; city: string; state: string; zip: string };
  email?: string;
  phoneNumber?: string;
  mobileOptIn?: boolean;
}): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'contact-information-page',
    item: [
      {
        linkId: 'patient-will-be-18',
        answer: [{ valueBoolean: willBe18 }],
      },
      {
        linkId: 'is-new-qrs-patient',
        answer: [{ valueBoolean: isNewPatient }],
      },
      {
        linkId: 'patient-first-name',
        answer: [{ valueString: firstName }],
      },
      {
        linkId: 'patient-last-name',
        answer: [{ valueString: lastName }],
      },
      {
        linkId: 'patient-birthdate',
        item: [
          {
            linkId: 'patient-dob-day',
            answer: [{ valueString: birthDate.day }],
          },
          {
            linkId: 'patient-dob-month',
            answer: [{ valueString: birthDate.month }],
          },
          {
            linkId: 'patient-dob-year',
            answer: [{ valueString: birthDate.year }],
          },
        ],
      },
      {
        linkId: 'patient-birth-sex',
        answer: [{ valueString: birthSex }],
      },
      {
        linkId: 'patient-street-address',
        answer: [{ valueString: address.street }],
      },
      {
        linkId: 'patient-street-address-2',
        answer: [{ valueString: address.street2 }],
      },
      {
        linkId: 'patient-city',
        answer: [{ valueString: address.city }],
      },
      {
        linkId: 'patient-state',
        answer: [{ valueString: address.state }],
      },
      {
        linkId: 'patient-zip',
        answer: [{ valueString: address.zip }],
      },
      {
        linkId: 'mobile-opt-in',
        answer: [{ valueBoolean: mobileOptIn }],
      },
      {
        linkId: 'patient-email',
        answer: [
          {
            valueString: email,
          },
        ],
      },
      {
        linkId: 'patient-number',
        answer: [
          {
            valueString: formatPhoneNumberForQuestionnaire(phoneNumber),
          },
        ],
      },
    ],
  };
}

export function getPatientDetailsStepAnswers({
  ethnicity = DEMO_VISIT_PATIENT_ETHNICITY,
  race = DEMO_VISIT_PATIENT_RACE,
  pointOfDiscovery = DEMO_VISIT_POINT_OF_DISCOVERY,
  preferredLanguage = DEMO_VISIT_PREFERRED_LANGUAGE,
  pronouns = 'She/her',
  ovrpInterest = 'Need more info',
}: {
  ethnicity?: string;
  race?: string;
  pronouns?: string;
  ovrpInterest?: string;
  pointOfDiscovery?: string;
  preferredLanguage?: string;
}): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'patient-details-page',
    item: [
      {
        linkId: 'patient-ethnicity',
        answer: [{ valueString: ethnicity }],
      },
      {
        linkId: 'patient-race',
        answer: [{ valueString: race }],
      },
      {
        linkId: 'patient-point-of-discovery',
        answer: [{ valueString: pointOfDiscovery }],
      },
      {
        linkId: 'patient-pronouns',
        answer: [{ valueString: pronouns }],
      },
      {
        linkId: 'ovrp-interest',
        answer: [{ valueString: ovrpInterest }],
      },
      {
        linkId: 'preferred-language',
        answer: [
          {
            valueString: preferredLanguage,
          },
        ],
      },
      {
        linkId: 'relay-phone',
        answer: [
          {
            valueString: 'No',
          },
        ],
      },
    ],
  };
}

export function getResponsiblePartyStepAnswers({
  relationship = DEMO_VISIT_RESPONSIBLE_RELATIONSHIP,
  firstName = DEMO_VISIT_RESPONSIBLE_FIRST_NAME,
  lastName = DEMO_VISIT_RESPONSIBLE_LAST_NAME,
  birthDate = {
    day: DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_DAY,
    month: DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_MONTH,
    year: DEMO_VISIT_RESPONSIBLE_DATE_OF_BIRTH_YEAR,
  },
  birthSex = DEMO_VISIT_RESPONSIBLE_BIRTH_SEX,
  phone = DEMO_VISIT_RESPONSIBLE_PHONE,
  address1 = DEMO_VISIT_RESPONSIBLE_ADDRESS1,
  city = DEMO_VISIT_RESPONSIBLE_CITY,
  state = DEMO_VISIT_RESPONSIBLE_STATE,
  zip = DEMO_VISIT_RESPONSIBLE_ZIP,
}: {
  firstName?: string;
  relationship?: string;
  birthDate?: { day: string; month: string; year: string };
  birthSex?: string;
  lastName?: string;
  address1?: string;
  city?: string;
  state?: string;
  zip?: string;
  phone?: string;
}): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'responsible-party-page',
    item: [
      {
        linkId: 'responsible-party-relationship',
        answer: [{ valueString: relationship }],
      },
      {
        linkId: 'responsible-party-first-name',
        answer: [{ valueString: firstName }],
      },
      {
        linkId: 'responsible-party-last-name',
        answer: [{ valueString: lastName }],
      },
      {
        linkId: 'responsible-party-date-of-birth',
        answer: [
          {
            valueString: `${birthDate?.year}-${birthDate?.month}-${birthDate?.day}`,
          },
        ],
      },
      {
        linkId: 'responsible-party-birth-sex',
        answer: [{ valueString: birthSex }],
      },
      {
        linkId: 'responsible-party-address',
        answer: [{ valueString: address1 }],
      },
      {
        linkId: 'responsible-party-city',
        answer: [{ valueString: city }],
      },
      {
        linkId: 'responsible-party-state',
        answer: [{ valueString: state }],
      },
      {
        linkId: 'responsible-party-zip',
        answer: [{ valueString: zip }],
      },
      {
        linkId: 'responsible-party-number',
        answer: [
          {
            valueString: phone,
          },
        ],
      },
    ],
  };
}

export function getPaymentOptionSelfPayAnswers(): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'payment-option-page',
    item: [
      {
        linkId: 'payment-option',
        answer: [{ valueString: 'I will pay without insurance' }],
      },
    ],
  };
}

export function getPaymentOptionInsuranceAnswers({
  insuranceCarrier,
  insuranceMemberId,
  insurancePolicyHolderFirstName,
  insurancePolicyHolderLastName,
  insurancePolicyHolderMiddleName,
  insurancePolicyHolderDateOfBirth,
  insurancePolicyHolderBirthSex,
  insurancePolicyHolderAddressAsPatient,
  insurancePolicyHolderAddress,
  insurancePolicyHolderAddressAdditionalLine,
  insurancePolicyHolderCity,
  insurancePolicyHolderState,
  insurancePolicyHolderZip,
  insurancePolicyHolderRelationshipToInsured,
  insuranceCarrier2,
  insuranceMemberId2,
  insurancePolicyHolderFirstName2,
  insurancePolicyHolderLastName2,
  insurancePolicyHolderMiddleName2,
  insurancePolicyHolderDateOfBirth2,
  insurancePolicyHolderBirthSex2,
  insurancePolicyHolderAddressAsPatient2,
  insurancePolicyHolderAddress2,
  insurancePolicyHolderAddressAdditionalLine2,
  insurancePolicyHolderCity2,
  insurancePolicyHolderState2,
  insurancePolicyHolderZip2,
  insurancePolicyHolderRelationshipToInsured2,
}: {
  insuranceCarrier: QuestionnaireResponseItemAnswer;
  insuranceMemberId: string;
  insurancePolicyHolderFirstName: string;
  insurancePolicyHolderLastName: string;
  insurancePolicyHolderMiddleName: string;
  insurancePolicyHolderDateOfBirth: string;
  insurancePolicyHolderBirthSex: string;
  insurancePolicyHolderAddressAsPatient: boolean;
  insurancePolicyHolderAddress: string;
  insurancePolicyHolderAddressAdditionalLine: string;
  insurancePolicyHolderCity: string;
  insurancePolicyHolderState: string;
  insurancePolicyHolderZip: string;
  insurancePolicyHolderRelationshipToInsured: string;
  insurancePolicyHolderFirstName2: string;
  insurancePolicyHolderLastName2: string;
  insurancePolicyHolderMiddleName2: string;
  insurancePolicyHolderDateOfBirth2: string;
  insurancePolicyHolderBirthSex2: string;
  insurancePolicyHolderAddressAsPatient2: boolean;
  insurancePolicyHolderAddress2: string;
  insurancePolicyHolderAddressAdditionalLine2: string;
  insurancePolicyHolderCity2: string;
  insurancePolicyHolderState2: string;
  insurancePolicyHolderZip2: string;
  insurancePolicyHolderRelationshipToInsured2: string;
  insuranceCarrier2: QuestionnaireResponseItemAnswer;
  insuranceMemberId2: string;
}): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'payment-option-page',
    item: [
      {
        item: [
          {
            linkId: 'insurance-carrier-2',
            answer: [insuranceCarrier2],
          },
          {
            linkId: 'insurance-member-id-2',
            answer: [
              {
                valueString: insuranceMemberId2,
              },
            ],
          },
          {
            linkId: 'policy-holder-first-name-2',
            answer: [
              {
                valueString: insurancePolicyHolderFirstName2,
              },
            ],
          },
          {
            linkId: 'policy-holder-middle-name-2',
            answer: [
              {
                valueString: insurancePolicyHolderMiddleName2,
              },
            ],
          },
          {
            linkId: 'policy-holder-last-name-2',
            answer: [
              {
                valueString: insurancePolicyHolderLastName2,
              },
            ],
          },
          {
            linkId: 'policy-holder-date-of-birth-2',
            answer: [
              {
                valueString: insurancePolicyHolderDateOfBirth2,
              },
            ],
          },
          {
            linkId: 'policy-holder-birth-sex-2',
            answer: [
              {
                valueString: insurancePolicyHolderBirthSex2,
              },
            ],
          },
          {
            linkId: 'policy-holder-address-as-patient-2',
            answer: [
              {
                valueBoolean: insurancePolicyHolderAddressAsPatient2,
              },
            ],
          },
          {
            linkId: 'policy-holder-address-2',
            answer: [
              {
                valueString: insurancePolicyHolderAddress2,
              },
            ],
          },
          {
            linkId: 'policy-holder-address-additional-line-2',
            answer: [
              {
                valueString: insurancePolicyHolderAddressAdditionalLine2,
              },
            ],
          },
          {
            linkId: 'policy-holder-city-2',
            answer: [
              {
                valueString: insurancePolicyHolderCity2,
              },
            ],
          },
          {
            linkId: 'policy-holder-state-2',
            answer: [
              {
                valueString: insurancePolicyHolderState2,
              },
            ],
          },
          {
            linkId: 'policy-holder-zip-2',
            answer: [
              {
                valueString: insurancePolicyHolderZip2,
              },
            ],
          },
          {
            linkId: 'patient-relationship-to-insured-2',
            answer: [
              {
                valueString: insurancePolicyHolderRelationshipToInsured2,
              },
            ],
          },
          {
            linkId: 'insurance-card-front-2',
          },
          {
            linkId: 'insurance-card-back-2',
          },
        ],
        linkId: 'secondary-insurance',
      },
      {
        linkId: 'display-secondary-insurance',
        answer: [
          {
            valueBoolean: true,
          },
        ],
      },
      {
        linkId: 'patient-relationship-to-insured',
        answer: [
          {
            valueString: insurancePolicyHolderRelationshipToInsured,
          },
        ],
      },
      {
        linkId: 'policy-holder-zip',
        answer: [
          {
            valueString: insurancePolicyHolderZip,
          },
        ],
      },
      {
        linkId: 'policy-holder-state',
        answer: [
          {
            valueString: insurancePolicyHolderState,
          },
        ],
      },
      {
        linkId: 'policy-holder-city',
        answer: [
          {
            valueString: insurancePolicyHolderCity,
          },
        ],
      },
      {
        linkId: 'policy-holder-address',
        answer: [
          {
            valueString: insurancePolicyHolderAddress,
          },
        ],
      },
      {
        linkId: 'policy-holder-address-additional-line',
        answer: [
          {
            valueString: insurancePolicyHolderAddressAdditionalLine,
          },
        ],
      },
      {
        linkId: 'policy-holder-birth-sex',
        answer: [
          {
            valueString: insurancePolicyHolderBirthSex,
          },
        ],
      },
      {
        linkId: 'policy-holder-address-as-patient',
        answer: [
          {
            valueBoolean: insurancePolicyHolderAddressAsPatient,
          },
        ],
      },
      {
        linkId: 'policy-holder-date-of-birth',
        answer: [
          {
            valueString: insurancePolicyHolderDateOfBirth,
          },
        ],
      },
      {
        linkId: 'policy-holder-last-name',
        answer: [
          {
            valueString: insurancePolicyHolderLastName,
          },
        ],
      },
      {
        linkId: 'policy-holder-middle-name',
        answer: [
          {
            valueString: insurancePolicyHolderMiddleName,
          },
        ],
      },
      {
        linkId: 'policy-holder-first-name',
        answer: [
          {
            valueString: insurancePolicyHolderFirstName,
          },
        ],
      },
      {
        linkId: 'insurance-member-id',
        answer: [
          {
            valueString: insuranceMemberId,
          },
        ],
      },
      {
        linkId: 'insurance-carrier',
        answer: [insuranceCarrier],
      },
      {
        linkId: 'payment-option',
        answer: [
          {
            valueString: 'I have insurance',
          },
        ],
      },
      {
        linkId: 'insurance-eligibility-verification-status',
        answer: [
          {
            valueString: 'eligibility-check-not-supported',
          },
          {
            valueString: 'eligibility-check-not-supported',
          },
        ],
      },
    ],
  };
}

export function getConsentStepAnswers({
  firstName = 'TEST-FIRST-NAME',
  lastName = 'TEST-LAST-NAME',
}: {
  firstName?: string;
  lastName?: string;
}): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'consent-forms-page',
    item: [
      {
        linkId: 'hipaa-acknowledgement',
        answer: [
          {
            valueBoolean: true,
          },
        ],
      },
      {
        linkId: 'consent-to-treat',
        answer: [
          {
            valueBoolean: true,
          },
        ],
      },
      {
        linkId: 'signature',
        answer: [
          {
            valueString: 'Signature text',
          },
        ],
      },
      {
        linkId: 'full-name',
        answer: [
          {
            valueString: `${firstName} ${lastName}`,
          },
        ],
      },
      {
        linkId: 'consent-form-signer-relationship',
        answer: [
          {
            valueString: 'Self',
          },
        ],
      },
    ],
  };
}

export function getAdditionalQuestionsAnswers(): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'additional-page',
    item: [
      {
        linkId: 'covid-symptoms',
        answer: [
          {
            valueString: 'No',
          },
        ],
      },
      {
        linkId: 'tested-positive-covid',
        answer: [
          {
            valueString: 'Yes',
          },
        ],
      },
      {
        linkId: 'travel-usa',
        answer: [
          {
            valueString: 'No',
          },
        ],
      },
    ],
  };
}

export function getAllergiesStepAnswers(): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'allergies-page',
    item: [
      {
        item: [
          { linkId: 'allergies-form-type', answer: [{ valueString: 'Other' }] },
          { linkId: 'allergies-form-agent-substance-medications', answer: [{ valueString: 'Azithromycin' }] },
          { linkId: 'allergies-form-agent-substance-other', answer: [{ valueString: 'Fish/ Fish Oil' }] },
        ],
        linkId: 'allergies',
      },
      { linkId: 'allergies-yes-no', answer: [{ valueString: 'Patient has known current allergies' }] },
    ],
  };
}

export function getMedicationsStepAnswers(
  medications: string[] = ['Amoxicillin', 'Cetirizine/ Zyrtec']
): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'current-medications-page',
    item: [
      {
        item: [
          {
            linkId: 'current-medications-form-medication',
            answer: [...medications.map((med) => ({ valueString: med }))],
          },
        ],
        linkId: 'current-medications',
      },
      { linkId: 'current-medications-yes-no', answer: [{ valueString: 'Patient takes medication currently' }] },
    ],
  };
}

export function getMedicalConditionsStepAnswers(): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'medical-history-page',
    item: [
      {
        item: [{ linkId: 'medical-history-form-medical-condition', answer: [{ valueString: 'Constipation' }] }],
        linkId: 'medical-history',
      },
      { linkId: 'medical-history-yes-no', answer: [{ valueString: 'Patient has current medical conditions' }] },
    ],
  };
}

export function getSurgicalHistoryStepAnswers(): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'surgical-history-page',
    item: [
      {
        item: [
          {
            linkId: 'surgical-history-form-type',
            answer: [{ valueString: 'Circumcision' }, { valueString: 'Ear tube placement (Myringotomy)' }],
          },
        ],
        linkId: 'surgical-history',
      },
      { linkId: 'surgical-history-yes-no', answer: [{ valueString: 'Patient has surgical history' }] },
    ],
  };
}

export function getSchoolWorkNoteStepAnswers(): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'school-work-note-page',
    item: [{ linkId: 'school-work-note-choice', answer: [{ valueString: 'Neither' }] }],
  };
}

export function getInviteParticipantStepAnswers(): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'invite-participant-page',
    item: [
      { linkId: 'invite-from-another-device', answer: [{ valueString: 'No, only one device will be connected' }] },
    ],
  };
}

export function getPrimaryCarePhysicianStepAnswers({
  providerFirstName = DEMO_VISIT_PROVIDER_FIRST_NAME,
  providerLastName = DEMO_VISIT_PROVIDER_LAST_NAME,
  practiceName = DEMO_VISIT_PRACTICE_NAME,
  address = DEMO_VISIT_PHYSICIAN_ADDRESS,
  mobile = DEMO_VISIT_PHYSICIAN_MOBILE,
}: {
  providerFirstName?: string;
  providerLastName?: string;
  practiceName?: string;
  address?: string;
  mobile?: string;
}): PatchPaperworkParameters['answers'] {
  return {
    linkId: 'primary-care-physician-page',
    item: [
      {
        linkId: 'pcp-first',
        answer: [
          {
            valueString: providerFirstName,
          },
        ],
      },
      {
        linkId: 'pcp-last',
        answer: [
          {
            valueString: providerLastName,
          },
        ],
      },
      {
        linkId: 'pcp-practice',
        answer: [
          {
            valueString: practiceName,
          },
        ],
      },
      {
        linkId: 'pcp-address',
        answer: [
          {
            valueString: address,
          },
        ],
      },
      {
        linkId: 'pcp-number',
        answer: [
          {
            valueString: mobile,
          },
        ],
      },
    ],
  };
}

const cashPaymentDTOFromFhirPaymentNotice = (paymentNotice: PaymentNotice): CashPaymentDTO | undefined => {
  const { extension, amount, created, id } = paymentNotice;

  if (!extension || !amount || !amount.value || !created || !id) {
    return undefined;
  }

  const paymentMethod = extension.find((ext) => ext.url === PAYMENT_METHOD_EXTENSION_URL)?.valueString;

  if (!paymentMethod || (paymentMethod !== 'cash' && paymentMethod !== 'check')) {
    return undefined;
  }

  return {
    paymentMethod: paymentMethod as 'cash' | 'check',
    amountInCents: Math.round(amount.value * 100),
    dateISO: created,
    fhirPaymentNotificationId: id,
  };
};

export const convertPaymentNoticeListToCashPaymentDTOs = (
  paymentNotices: PaymentNotice[],
  encounterId?: string
): CashPaymentDTO[] => {
  return paymentNotices.flatMap((notice) => {
    const mapped = cashPaymentDTOFromFhirPaymentNotice(notice);
    if (!mapped) {
      return [];
    }

    if (!encounterId) {
      return mapped;
    }

    const { request } = notice;
    if (request && request.reference) {
      const [resourceType, resourceId] = request.reference.split('/');
      if (resourceType !== 'Encounter' || !resourceId) {
        return [];
      }
      if (resourceId !== encounterId) {
        return [];
      }
    }
    return mapped;
  });
};
