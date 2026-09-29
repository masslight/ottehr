// Who may use Easy Chart: one list shared by the in-person layout and every Easy Chart endpoint. The endpoints
// do FHIR work under the M2M token, so this role check plus a per-encounter check is what enforces access.

import { CHART_DOCUMENT_ROLES, RoleType } from '../types/api/user.types';

/** The charting roles, the same ones that may print a patient's clinical documents. */
export const EASY_CHART_ROLES: readonly RoleType[] = CHART_DOCUMENT_ROLES;
