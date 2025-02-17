import Oystehr, { OystehrConfig } from '@oystehr/sdk';
import { Appointment, Extension, QuestionnaireResponse, Resource } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { Secrets } from '../secrets';
import { getSecret } from '../secrets';
import { SecretsKeys } from '../secrets';
import { OTTEHR_MODULE } from '../fhir';
import { UpdateQuestionnaireResponseParams } from '../types';
import path from 'path';

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

export function createOystehrClientFromSecrets(token: string, secrets: Secrets | null): Oystehr {
  const FHIR_API = getSecret(SecretsKeys.FHIR_API, secrets).replace(/\/r4/g, '');
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);
  return createOystehrClient(token, FHIR_API, PROJECT_API);
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

export function updateQuestionnaireResponse({
  questionnaire,
  questionnaireResponseId,
  encounterId,
  status = 'in-progress',
  firstName = 'TEST-FIRST-NAME',
  lastName = 'TEST-LAST-NAME',
  birthDate = '1990-02-02',
  email = 'test-email@test-domain-1237843298123.co',
  phoneNumber = '(202) 733-9622',
  birthSex = 'Female',
  address = {
    street: '123 Main Street',
    street2: 'Apt 4B',
    city: 'Orlando',
    state: 'AK',
    zip: '32801',
  },
  ethnicity = 'Decline to Specify',
  race = 'Native Hawaiian or Other Pacific Islander',
  pronouns = 'She/her',
  paymentOption = 'I will pay without insurance',
  responsibleParty = {
    relationship: 'Legal Guardian',
    firstName: 'fwe',
    lastName: 'sf',
    birthDate: '1990-02-02',
    birthSex: 'Intersex',
  },
}: UpdateQuestionnaireResponseParams): QuestionnaireResponse {
  // console.log(params);
  return {
    id: questionnaireResponseId,
    resourceType: 'QuestionnaireResponse',
    questionnaire,
    encounter: {
      reference: `Encounter/${encounterId}`,
    },
    status,
    item: [
      {
        linkId: 'contact-information-page',
        item: [
          {
            linkId: 'patient-will-be-18',
            answer: [
              {
                valueBoolean: false,
              },
            ],
          },
          {
            linkId: 'is-new-qrs-patient',
            answer: [
              {
                valueBoolean: false,
              },
            ],
          },
          {
            linkId: 'patient-first-name',
            answer: [
              {
                valueString: firstName,
              },
            ],
          },
          {
            linkId: 'patient-last-name',
            answer: [
              {
                valueString: lastName,
              },
            ],
          },
          {
            linkId: 'patient-birthdate',
            answer: [
              {
                valueString: birthDate,
              },
            ],
          },
          {
            linkId: 'patient-birth-sex',
            answer: [
              {
                valueString: birthSex,
              },
            ],
          },
          {
            linkId: 'patient-birth-sex-missing',
          },
          {
            linkId: 'patient-street-address',
            answer: [
              {
                valueString: address.street,
              },
            ],
          },
          {
            linkId: 'patient-street-address-2',
            answer: [
              {
                valueString: address.street2,
              },
            ],
          },
          {
            linkId: 'patient-city',
            answer: [
              {
                valueString: address.city,
              },
            ],
          },
          {
            linkId: 'patient-state',
            answer: [
              {
                valueString: address.state,
              },
            ],
          },
          {
            linkId: 'patient-zip',
            answer: [
              {
                valueString: address.zip,
              },
            ],
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
          {
            linkId: 'mobile-opt-in',
          },
        ],
      },
      {
        linkId: 'patient-details-page',
        item: [
          {
            linkId: 'patient-ethnicity',
            answer: [
              {
                valueString: ethnicity,
              },
            ],
          },
          {
            linkId: 'patient-race',
            answer: [
              {
                valueString: race,
              },
            ],
          },
          {
            linkId: 'patient-pronouns',
            answer: [
              {
                valueString: pronouns,
              },
            ],
          },
          {
            linkId: 'patient-pronouns-custom',
          },
          {
            linkId: 'patient-point-of-discovery',
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
      },
      {
        linkId: 'primary-care-physician-page',
        item: [
          {
            linkId: 'pcp-first',
            answer: [
              {
                valueString: 'qweqwe',
              },
            ],
          },
          {
            linkId: 'pcp-last',
            answer: [
              {
                valueString: 'qweqwe',
              },
            ],
          },
          {
            linkId: 'pcp-practice',
            answer: [
              {
                valueString: 'qweqwe',
              },
            ],
          },
          {
            linkId: 'pcp-address',
            answer: [
              {
                valueString: 'qweqweqwe',
              },
            ],
          },
          {
            linkId: 'pcp-number',
            answer: [
              {
                valueString: '(123) 123-1231',
              },
            ],
          },
        ],
      },
      {
        linkId: 'current-medications-page',
        item: [
          {
            linkId: 'current-medications-yes-no',
            answer: [
              {
                valueString: 'Patient does not take any medications currently',
              },
            ],
          },
          {
            linkId: 'current-medications',
          },
        ],
      },
      {
        linkId: 'allergies-page',
        item: [
          {
            linkId: 'allergies-yes-no',
            answer: [
              {
                valueString: 'Patient has no known current allergies',
              },
            ],
          },
          {
            linkId: 'allergies',
          },
        ],
      },
      {
        linkId: 'medical-history-page',
        item: [
          {
            linkId: 'medical-history-yes-no',
            answer: [
              {
                valueString: 'Patient has no current medical conditions',
              },
            ],
          },
          {
            linkId: 'medical-history',
          },
        ],
      },
      {
        linkId: 'surgical-history-page',
        item: [
          {
            linkId: 'surgical-history-yes-no',
            answer: [
              {
                valueString: 'Patient has no surgical history',
              },
            ],
          },
          {
            linkId: 'surgical-history',
          },
        ],
      },
      {
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
                valueString: 'No',
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
      },
      {
        linkId: 'payment-option-page',
        item: [
          {
            linkId: 'payment-option',
            answer: [
              {
                valueString: paymentOption,
              },
            ],
          },
          {
            item: [
              {
                linkId: 'valid-card-on-file',
              },
            ],
            linkId: 'card-payment-data',
          },
          {
            linkId: 'insurance-carrier',
          },
          {
            linkId: 'insurance-member-id',
          },
          {
            linkId: 'policy-holder-first-name',
          },
          {
            linkId: 'policy-holder-middle-name',
          },
          {
            linkId: 'policy-holder-last-name',
          },
          {
            linkId: 'policy-holder-date-of-birth',
          },
          {
            linkId: 'policy-holder-birth-sex',
          },
          {
            linkId: 'policy-holder-address-as-patient',
          },
          {
            linkId: 'policy-holder-address',
          },
          {
            linkId: 'policy-holder-address-additional-line',
          },
          {
            linkId: 'policy-holder-city',
          },
          {
            linkId: 'policy-holder-state',
          },
          {
            linkId: 'policy-holder-zip',
          },
          {
            linkId: 'patient-relationship-to-insured',
          },
          {
            linkId: 'insurance-card-front',
          },
          {
            linkId: 'insurance-card-back',
          },
          {
            linkId: 'display-secondary-insurance',
          },
          {
            linkId: 'secondary-insurance',
          },
        ],
      },
      {
        linkId: 'responsible-party-page',
        item: [
          {
            linkId: 'responsible-party-relationship',
            answer: [
              {
                valueString: 'Parent',
              },
            ],
          },
          {
            linkId: 'responsible-party-first-name',
            answer: [
              {
                valueString: responsibleParty.firstName,
              },
            ],
          },
          {
            linkId: 'responsible-party-last-name',
            answer: [
              {
                valueString: responsibleParty.lastName,
              },
            ],
          },
          {
            linkId: 'responsible-party-date-of-birth',
            answer: [
              {
                valueString: responsibleParty.birthDate,
              },
            ],
          },
          {
            linkId: 'responsible-party-birth-sex',
            answer: [
              {
                valueString: responsibleParty.birthSex,
              },
            ],
          },
          // {
          //   linkId: 'responsible-party-number',
          //   answer: [
          //     {
          //       valueString: responsibleParty.phoneNumber,
          //     },
          //   ],
          // },
        ],
      },
      // {
      //   linkId: 'photo-id-page',
      //   item: [
      //     {
      //       linkId: 'photo-id-front',
      //     },
      //     {
      //       linkId: 'photo-id-back',
      //     },
      //   ],
      // },
      // {
      //   linkId: 'patient-condition-page',
      //   item: [
      //     {
      //       linkId: 'patient-photos',
      //     },
      //   ],
      // },
      {
        linkId: 'school-work-note-page',
        item: [
          {
            linkId: 'school-work-note-choice',
            answer: [
              {
                valueString: 'Neither',
              },
            ],
          },
          {
            linkId: 'school-work-note-template-upload-group',
          },
        ],
      },
      {
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
                valueString: 'asdf',
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
      },
      {
        linkId: 'invite-participant-page',
        item: [
          {
            linkId: 'invite-from-another-device',
            answer: [
              {
                valueString: 'No, only one device will be connected',
              },
            ],
          },
          {
            linkId: 'invite-first',
          },
          {
            linkId: 'invite-last',
          },
          {
            linkId: 'invite-contact',
          },
          {
            linkId: 'invite-email',
          },
          {
            linkId: 'invite-phone',
          },
        ],
      },
    ],
    // authored: '2025-02-13T12:39:34.515+04:00',
    // extension: [
    //   {
    //     url: 'https://fhir.zapehr.com/r4/StructureDefinitions/ip-address',
    //     valueString: '::1',
    //   },
    // ],
  };
}

export const performEffectWithEnvFile = async (
  pkg: 'intake' | 'ehr',
  callback: (config: any) => void
): Promise<void> => {
  const env = process.argv[2];
  try {
    const configPath = path.resolve(__dirname, `../../../${pkg}/zambdas/.env/${env}.json`);
    const config = await import(configPath);
    await callback(config);
  } catch (e) {
    console.error(e);
    throw new Error(`can't import config for the environment: '${env}'`);
  }
};
