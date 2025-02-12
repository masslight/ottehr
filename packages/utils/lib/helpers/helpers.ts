import Oystehr, { OystehrConfig } from '@oystehr/sdk';
import { Appointment, Extension, QuestionnaireResponse, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { OTTEHR_MODULE } from '../fhir';
import { UpdateQuestionnaireResponseParams } from '../types';

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

export function updateQuestionnaireResponse({
  questionnaireResponseId,
  patientId,
  encounterId,
  status = 'in-progress',
  firstName,
  lastName,
  birthDate,
  consentJurisdiction = 'NY',
  willBe18 = false,
  isNewPatient = false,
  fillingOutAs = 'Parent/Guardian',
  guardianEmail = 'testemail@s0metestdomain123454321.com',
  guardianNumber = '(925) 622-4222',
  birthSex = 'Female',
  address = {
    street: '123 Main Street',
    street2: 'Apt 4B',
    city: 'Orlando',
    state: 'FL',
    zip: '32801',
  },
  mobileOptIn = true,
  ethnicity = 'Decline to Specify',
  race = 'Native Hawaiian or Other Pacific Islander',
  pronouns = 'She/her',
  ovrpInterest = 'Need more info',
  paymentOption = 'I will pay without insurance',
  responsibleParty = {
    relationship: 'Legal Guardian',
    firstName: 'fwe',
    lastName: 'sf',
    birthDate: {
      day: '13',
      month: '05',
      year: '2009',
    },
    birthSex: 'Intersex',
  },
}: UpdateQuestionnaireResponseParams): QuestionnaireResponse {
  return {
    resourceType: 'QuestionnaireResponse',
    id: questionnaireResponseId,
    status,
    subject: {
      reference: `Patient/${patientId}`,
    },
    encounter: {
      reference: `Encounter/${encounterId}`,
    },
    item: [
      {
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
            linkId: 'patient-filling-out-as',
            answer: [{ valueString: fillingOutAs }],
          },
          {
            linkId: 'guardian-email',
            answer: [{ valueString: guardianEmail }],
          },
          {
            linkId: 'guardian-number',
            answer: [{ valueString: guardianNumber }],
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
        ],
      },
      {
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
        ],
      },
      {
        linkId: 'payment-option-page',
        item: [
          {
            linkId: 'payment-option',
            answer: [{ valueString: paymentOption }],
          },
        ],
      },
      {
        linkId: 'responsible-party-page',
        item: [
          {
            linkId: 'responsible-party-relationship',
            answer: [{ valueString: responsibleParty.relationship }],
          },
          {
            linkId: 'responsible-party-first-name',
            answer: [{ valueString: responsibleParty.firstName }],
          },
          {
            linkId: 'responsible-party-last-name',
            answer: [{ valueString: responsibleParty.lastName }],
          },
          {
            linkId: 'responsible-party-date-of-birth',
            item: [
              {
                linkId: 'responsible-party-dob-day',
                answer: [{ valueString: responsibleParty.birthDate?.day }],
              },
              {
                linkId: 'responsible-party-dob-month',
                answer: [{ valueString: responsibleParty.birthDate?.month }],
              },
              {
                linkId: 'responsible-party-dob-year',
                answer: [{ valueString: responsibleParty.birthDate?.year }],
              },
            ],
          },
          {
            linkId: 'responsible-party-birth-sex',
            answer: [{ valueString: responsibleParty.birthSex }],
          },
        ],
      },
      {
        linkId: 'consent-forms-page',
        item: [
          {
            linkId: 'consent-jurisdiction',
            answer: [{ valueString: consentJurisdiction }],
          },
        ],
      },
    ],
  };
}
