// Identifies the singular Basic resource that stores the eligibility verification configuration.
export const ELIGIBILITY_VERIFICATION_CONFIG_BASIC_TAG = {
  system: 'eligibility-config',
  code: 'eligibility-verification',
};

// Extension on the Basic resource whose valueString holds the JSON-serialized config blob.
export const ELIGIBILITY_VERIFICATION_CONFIG_EXTENSION_URL =
  'https://fhir.ottehr.com/Extension/eligibility-verification-config';

// Maximum number of service-type codes that may appear on the eligibility short list.
export const MAX_ELIGIBILITY_SHORT_LIST_CODES = 3;

// Default short list / primary code, mirroring the previously hardcoded behavior (Urgent Care).
export const DEFAULT_ELIGIBILITY_SHORT_LIST_CODES = ['UC'];
export const DEFAULT_ELIGIBILITY_PRIMARY_CODE = 'UC';
