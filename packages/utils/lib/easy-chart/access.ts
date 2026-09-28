// Who may use Easy Chart: one list shared by the router guard and every Easy Chart endpoint. The endpoints do
// FHIR work under the M2M token, so this role check plus a per-encounter check is what enforces access.

import { RoleType } from '../types/api/user.types';

/** Roles that may open the Easy Chart page and call its endpoints. Charting roles only. */
export const EASY_CHART_ROLES: readonly RoleType[] = [
  RoleType.Administrator,
  RoleType.Manager,
  RoleType.Provider,
  RoleType.Clinician,
  RoleType.Staff,
];
