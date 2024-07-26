// nota bene: some legacy resources could be using 'http' instead of 'https' here, and there are still some string vals out there with http
export const PRIVATE_EXTENSION_BASE_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions';
export const PUBLIC_EXTENSION_BASE_URL = 'https://extensions.fhir.zapehr.com';
export const FHIR_ZAPEHR_URL = 'https://fhir.zapehr.com';

export const FHIR_EXTENSION = {
  Appointment: {
    additionalInfo: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/additional-information`,
    },
    unconfirmedDateOfBirth: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/date-of-birth-not-confirmed`,
    },
    visitHistory: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/visit-history`,
    }
  },
  Encounter: {
    otherParticipants: {
      url: `${PUBLIC_EXTENSION_BASE_URL}/encounter-other-participants`,
      extension: {
        otherParticipant: {
          url: `${PUBLIC_EXTENSION_BASE_URL}/encounter-other-participant`,
        },
      },
    },
  },
  Patient: {
    formUser: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/form-user`,
    },
  },
  Paperwork: {
    formListValues: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/form-list-values`,
      extension: {
        formListValue: {
          url: `${PRIVATE_EXTENSION_BASE_URL}/form-list-value`,
        },
      },
    },
  },
} as const;

export type FHIR_EXTENSION_TYPE = typeof FHIR_EXTENSION;

export const TIMEZONE_EXTENSION_URL = 'http://hl7.org/fhir/StructureDefinition/timezone';
