// Who may use Easy Chart: one list shared by the in-person layout and every Easy Chart endpoint. The endpoints
// do FHIR work under the M2M token, so this role check plus a per-encounter check is what enforces access.

import { CHART_DOCUMENT_ROLES, RoleType } from '../types/api/user.types';

/** The charting roles, the same ones that may print a patient's clinical documents. */
export const EASY_CHART_ROLES: readonly RoleType[] = CHART_DOCUMENT_ROLES;

/**
 * What the Easy Chart write endpoints answer for a signed, locked visit. The EHR matches on it to put the
 * Autochart panel into its read-only state when the visit was locked after the panel opened.
 */
export const EASY_CHART_VISIT_LOCKED_MESSAGE = 'This visit is signed and locked, so it can no longer be changed';
