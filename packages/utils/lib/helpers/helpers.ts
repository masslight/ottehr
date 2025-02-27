import Oystehr, { OystehrConfig } from '@oystehr/sdk';
import { Appointment, Extension, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { OTTEHR_MODULE } from '../fhir';
import { PatchPaperworkParameters } from '../types';

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

export function getAppointmentConfirmationMessage(
  appointmentID: string,
  locationName: string,
  startTime: string,
  websiteURL: string,
  firstName: string
): string {
  return `You're confirmed! Your check-in time for ${firstName} at ${locationName} is ${startTime}. Please save time at check-in by completing your pre-visit paperwork, or modify/cancel your visit: ${websiteURL}/appointment/${appointmentID}`;
}

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

export const isPhoneNumberValid = (phoneNumber: string | undefined): boolean => {
  if (!phoneNumber) {
    return false;
  }
  const plusOneRegex = /^\+1\d{10}$/;
  const tenDigitRegex = /^\d{10}$/;
  return plusOneRegex.test(phoneNumber) || tenDigitRegex.test(phoneNumber);
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
  const cleaned = ('' + phoneNumber).replace(/\D/g, '');
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

const formatPhoneNumberForQuestionarie = (phone: string): string => {
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
    street: '123 Main Street',
    street2: 'Apt 4B',
    city: 'Orlando',
    state: 'FL',
    zip: '32801',
  },
  email = 'test-email@test-domain-1237843298123.co',
  phoneNumber = '(202) 733-9622',

  mobileOptIn = true,
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
            valueString: formatPhoneNumberForQuestionarie(phoneNumber),
          },
        ],
      },
    ],
  };
}

export function getPatientDetailsStepAnswers({
  ethnicity = 'Decline to Specify',
  race = 'Native Hawaiian or Other Pacific Islander',
  pronouns = 'She/her',
  ovrpInterest = 'Need more info',
}: {
  ethnicity?: string;
  race?: string;
  pronouns?: string;
  ovrpInterest?: string;
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
            valueString: 'English',
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
  relationship = 'Legal Guardian',
  firstName = 'fwe',
  lastName = 'sf',
  birthDate = {
    day: '13',
    month: '05',
    year: '1900',
  },
  birthSex = 'Intersex',
}: {
  firstName?: string;
  relationship?: string;
  birthDate?: { day: string; month: string; year: string };
  birthSex?: string;
  lastName?: string;
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
