export const PRIVATE_EXTENSION_BASE_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions';
export const PUBLIC_EXTENSION_BASE_URL = 'https://extensions.fhir.zapehr.com';

export const FHIR_EXTENSION = {
  Appointment: {
    additionalInfo: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/additional-information`,
    },
    otherEHRVisitStatus: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/visit-history`,
    },
  },
  Encounter: {
    otherEHRVisitStatus: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/encounter-visit-history`,
    },
    otherParticipants: {
      url: `${PUBLIC_EXTENSION_BASE_URL}/encounter-other-participants`,
      extension: {
        otherParticipant: {
          url: `${PUBLIC_EXTENSION_BASE_URL}/encounter-other-participant`,
        },
      },
    },
  },
  Location: {
    otherEHRFacility: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/other-ehr-facility`,
    },
    otherEHRProviderIdPrebook: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/other-ehr-provider-id-prebook`,
    },
    otherEHRProviderIdWalkin: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/other-ehr-provider-id-walkin`,
    },
    otherEHRProviderFirstName: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/other-ehr-provider-first-name`,
    },
  },
  Patient: {
    formUser: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/form-user`,
    },
  },
} as const;

export type FHIR_EXTENSION_TYPE = typeof FHIR_EXTENSION;
