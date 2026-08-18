// Who may use Easy Chart.
//
// ONE list, consumed by the router guard AND by every Easy Chart endpoint. The plan's rule is that a
// role which can open the UI must be able to use the API and vice versa; defining the set twice is
// how those drift apart, so it is defined here and imported by both.
//
// Why an explicit check is needed at all: these endpoints do their FHIR work under the project's M2M
// token, so the SDK never consults the caller's permissions. `"type": "http_auth"` only proves the
// token is valid FOR THE PROJECT. Without a role check plus a per-encounter access check, any
// authenticated token could plan against any encounterId and read that patient's demographics.

import { RoleType } from '../types/api/user.types';

/** Roles that may open the Easy Chart page and call its endpoints. Charting roles only. */
export const EASY_CHART_ROLES: readonly RoleType[] = [
  RoleType.Administrator,
  RoleType.Manager,
  RoleType.Provider,
  RoleType.Clinician,
  RoleType.Staff,
];

export const EASY_CHART_ROUTE_BASE = '/easy-chart';

export const getEasyChartUrl = (encounterId: string): string => `${EASY_CHART_ROUTE_BASE}/${encounterId}`;
