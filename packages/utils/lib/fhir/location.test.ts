import { Location } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { isValidSlug, PUBLIC_EXTENSION_BASE_URL, slugFromName } from './constants';
import {
  isLocationFacilityGroup,
  isLocationInPerson,
  isLocationManuallyCreated,
  isLocationVirtual,
  LOCATION_IN_PERSON_CODE,
  LOCATION_MANUALLY_CREATED_EXTENSION_URL,
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

  describe('isLocationManuallyCreated', () => {
    const withMarker = (value: boolean): Location => ({
      resourceType: 'Location',
      status: 'active',
      extension: [{ url: LOCATION_MANUALLY_CREATED_EXTENSION_URL, valueBoolean: value }],
    });

    it('is true when the manually-created marker is present and true', () => {
      expect(isLocationManuallyCreated(withMarker(true))).toBe(true);
    });

    it('is false when the marker is absent (terraform-managed / legacy)', () => {
      expect(isLocationManuallyCreated(makeLocation())).toBe(false);
    });

    it('is false when the marker is present but false', () => {
      expect(isLocationManuallyCreated(withMarker(false))).toBe(false);
    });
  });
});

describe('slugFromName', () => {
  it('derives a URL-safe slug and preserves case', () => {
    expect(slugFromName('New York')).toBe('New-York');
    expect(isValidSlug(slugFromName('New York'))).toBe(true);
  });

  it('collapses runs of non-url-safe characters into a single hyphen and trims edges', () => {
    expect(slugFromName('  Café  &  Clinic!! ')).toBe('Caf-Clinic');
    expect(isValidSlug(slugFromName('  Café  &  Clinic!! '))).toBe(true);
  });

  it('returns an empty string (invalid slug) for a name with no url-safe characters', () => {
    expect(slugFromName('Москва')).toBe('');
    expect(isValidSlug(slugFromName('Москва'))).toBe(false);
  });
});
