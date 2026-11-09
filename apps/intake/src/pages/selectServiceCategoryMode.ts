import { ServiceMode } from 'utils/lib/types/common';

/**
 * Derive the service mode this picker is selecting for, from the URL path.
 *
 * Where the URL itself declares which mode the patient is booking, return
 * it so the picker can filter out mode-incompatible categories (e.g. an
 * in-person-only "massage" entry on `/prebook/virtual/...`). Only the
 * `/walkin/schedule/:id/...` route truly doesn't know mode here — it
 * depends on the Schedule's owner resource type, which is resolved
 * downstream — so we return undefined for it and let the booking flow
 * reject if the patient picks a mode-incompatible category.
 *
 * Walk-in routes may pin the mode explicitly via the `serviceMode` query param (WALKIN_SERVICE_MODE_QUERY_PARAM);
 * pass its value as `walkinServiceModeParam` and it wins over the path-based default.
 *
 * Lives in its own file so unit tests can import without pulling in the
 * SelectServiceCategory component tree (which transitively touches
 * `document` at module load and would force a jsdom-only test).
 */
export const deriveServiceModeFromPath = (
  pathname: string,
  walkinServiceModeParam?: string | null
): string | undefined => {
  const prebookMatch = pathname.match(/^\/prebook\/([^/]+)\/select-service-category\/?(?:$|[?#])/);
  if (prebookMatch) return prebookMatch[1];
  if (pathname.startsWith('/start-virtual/')) return 'virtual';
  if (
    pathname.startsWith('/walkin/') &&
    walkinServiceModeParam &&
    Object.values<string>(ServiceMode).includes(walkinServiceModeParam)
  ) {
    return walkinServiceModeParam;
  }
  if (pathname.startsWith('/walkin/location/')) return 'in-person';
  return undefined;
};
