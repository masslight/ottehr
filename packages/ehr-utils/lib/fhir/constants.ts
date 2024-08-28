const PRIVATE_EXTENSION_BASE_URL = 'https://fhir.zapehr.com/r4/StructureDefinitions';
// const PUBLIC_EXTENSION_BASE_URL = 'https://extensions.fhir.zapehr.com';

export const FHIR_EXTENSION = {
  Appointment: {
    unconfirmedDateOfBirth: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/date-of-birth-not-confirmed`,
    },
  },
  Patient: {
    weight: {
      url: `${PRIVATE_EXTENSION_BASE_URL}/weight`,
    },
  },
};
