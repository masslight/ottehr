import { Location } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { isLocationBookable, LOCATION_BOOKABLE_SEARCH_PARAM } from './location';

const withStatus = (status?: Location['status']): Location => ({ resourceType: 'Location', id: 'loc-1', status });

describe('isLocationBookable', () => {
  it('excludes a deactivated Location', () => {
    expect(isLocationBookable(withStatus('inactive'))).toBe(false);
  });

  it('includes an active Location', () => {
    expect(isLocationBookable(withStatus('active'))).toBe(true);
  });

  it('includes a Location with no status set', () => {
    // The divergence this pair exists to end: `status === 'active'` in list-bookables hid these
    // while every other path treated them as bookable, so a status-less Location was invisible in
    // the patient list yet reachable by direct link. `Location.status` is optional in FHIR, and
    // anything seeded, imported, or created outside `scaffoldLocation` can arrive without one.
    expect(isLocationBookable(withStatus(undefined))).toBe(true);
  });

  it('includes a suspended Location — only "inactive" means deactivated here', () => {
    // `suspended` is a real FHIR status this product doesn't use. Treating any non-active value as
    // deactivated would silently change what the admin toggle means if that ever changes.
    expect(isLocationBookable(withStatus('suspended'))).toBe(true);
  });
});

describe('LOCATION_BOOKABLE_SEARCH_PARAM', () => {
  it('is the server-side form of the same rule', () => {
    // `status:not` rather than `status=active`, so the query and the predicate agree about
    // status-less Locations — `:not` also matches resources where the field is absent.
    expect(LOCATION_BOOKABLE_SEARCH_PARAM).toEqual({ name: 'status:not', value: 'inactive' });
  });
});
