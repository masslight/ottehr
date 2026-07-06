import { Location } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { PUBLIC_EXTENSION_BASE_URL } from './constants';
import {
  isLocationFacilityGroup,
  isLocationInPerson,
  isLocationVirtual,
  LOCATION_IN_PERSON_CODE,
  LOCATION_PHYSICAL_TYPE_SYSTEM,
} from './location';

const LOCATION_FORM_EXTENSION_URL = `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release`;

const formCoding = (code: string): NonNullable<Location['extension']>[number] => ({
  url: LOCATION_FORM_EXTENSION_URL,
  valueCoding: { system: LOCATION_PHYSICAL_TYPE_SYSTEM, code },
});

const makeLocation = (...codes: string[]): Location => ({
  resourceType: 'Location',
  status: 'active',
  extension: codes.map(formCoding),
});

describe('location virtual / in-person helpers', () => {
  describe('isLocationVirtual', () => {
    it('is true for a location tagged virtual', () => {
      expect(isLocationVirtual(makeLocation('vi'))).toBe(true);
    });

    it('is false for a plain physical location', () => {
      expect(isLocationVirtual(makeLocation())).toBe(false);
    });

    it('is false for a facility-group (si) location', () => {
      expect(isLocationVirtual(makeLocation('si'))).toBe(false);
    });

    it('detects virtual even when another coding precedes it on the same URL', () => {
      // Regression guard: the old `.find(...)?.code === 'vi'` only inspected the
      // first coding and would return false here.
      expect(isLocationVirtual(makeLocation(LOCATION_IN_PERSON_CODE, 'vi'))).toBe(true);
    });
  });

  describe('isLocationInPerson', () => {
    it('is true for a legacy location with no location-form coding (backward-compat)', () => {
      expect(isLocationInPerson(makeLocation())).toBe(true);
    });

    it('is false for a virtual-only location', () => {
      expect(isLocationInPerson(makeLocation('vi'))).toBe(false);
    });

    it('is true for a location explicitly tagged in-person', () => {
      expect(isLocationInPerson(makeLocation(LOCATION_IN_PERSON_CODE))).toBe(true);
    });

    it('is true for a dual-mode (virtual AND in-person) location', () => {
      const dualMode = makeLocation('vi', LOCATION_IN_PERSON_CODE);
      expect(isLocationVirtual(dualMode)).toBe(true);
      expect(isLocationInPerson(dualMode)).toBe(true);
    });

    it('treats a facility-group (si) location as in-person', () => {
      expect(isLocationInPerson(makeLocation('si'))).toBe(true);
    });
  });

  describe('isLocationFacilityGroup', () => {
    it('detects a facility group even alongside other codings', () => {
      expect(isLocationFacilityGroup(makeLocation('vi', 'si'))).toBe(true);
      expect(isLocationFacilityGroup(makeLocation())).toBe(false);
    });
  });
});
