// Lightweight canonical identifiers for the virtual intake questionnaire.
// See ../intake-paperwork/canonical.ts for rationale — same pattern.

export const VIRTUAL_INTAKE_PAPERWORK_URL = 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-virtual';
export const VIRTUAL_INTAKE_PAPERWORK_VERSION = '1.0.22';

export const VIRTUAL_INTAKE_PAPERWORK_CANONICAL = {
  url: VIRTUAL_INTAKE_PAPERWORK_URL,
  version: VIRTUAL_INTAKE_PAPERWORK_VERSION,
} as const;
