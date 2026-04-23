// Lightweight canonical identifiers for the in-person intake questionnaire.
// Kept in a separate module so callers that only need the {url, version}
// pair (e.g., zambdas on the hot path) can import it without triggering the
// full intake-paperwork config build (form fields, consent merge, Zod parse)
// that happens at module-init time for `./index.ts`.
//
// The full config consumes these constants when assembling its
// `questionnaireBase` defaults, so this file is the single source of truth
// for the in-person canonical url + version.

export const IN_PERSON_INTAKE_PAPERWORK_URL = 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson';
export const IN_PERSON_INTAKE_PAPERWORK_VERSION = '1.1.7';

export const IN_PERSON_INTAKE_PAPERWORK_CANONICAL = {
  url: IN_PERSON_INTAKE_PAPERWORK_URL,
  version: IN_PERSON_INTAKE_PAPERWORK_VERSION,
} as const;
