import { HealthcareService, Location, Practitioner, PractitionerRole } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { PUBLIC_EXTENSION_BASE_URL } from '../fhir/constants';
import { LOCATION_IN_PERSON_CODE, LOCATION_PHYSICAL_TYPE_SYSTEM } from '../fhir/location';
import { ServiceMode } from '../types';
import { scheduleOwnerSupportsServiceMode } from './scheduleUtils';

const LOCATION_FORM_EXTENSION_URL = `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release`;

const location = (id: string, ...codes: string[]): Location => ({
  resourceType: 'Location',
  id,
  status: 'active',
  extension: codes.map((code) => ({
    url: LOCATION_FORM_EXTENSION_URL,
    valueCoding: { system: LOCATION_PHYSICAL_TYPE_SYSTEM, code },
  })),
});

const virtual = (id: string): Location => location(id, 'vi');
const inPerson = (id: string): Location => location(id, LOCATION_IN_PERSON_CODE);
const dual = (id: string): Location => location(id, 'vi', LOCATION_IN_PERSON_CODE);

const prWithLocations = (...ids: string[]): PractitionerRole => ({
  resourceType: 'PractitionerRole',
  id: 'pr-1',
  location: ids.map((id) => ({ reference: `Location/${id}` })),
});

const mapOf = (...locs: Location[]): Map<string, Location> => new Map(locs.map((l) => [l.id!, l]));

describe('scheduleOwnerSupportsServiceMode', () => {
  describe('Location owner (checked directly via the seam)', () => {
    it('matches the Location capability for each mode', () => {
      const empty = new Map<string, Location>();
      expect(scheduleOwnerSupportsServiceMode(virtual('l1'), ServiceMode.virtual, empty)).toBe(true);
      expect(scheduleOwnerSupportsServiceMode(virtual('l1'), ServiceMode['in-person'], empty)).toBe(false);
      expect(scheduleOwnerSupportsServiceMode(inPerson('l1'), ServiceMode['in-person'], empty)).toBe(true);
      expect(scheduleOwnerSupportsServiceMode(inPerson('l1'), ServiceMode.virtual, empty)).toBe(false);
      expect(scheduleOwnerSupportsServiceMode(dual('l1'), ServiceMode.virtual, empty)).toBe(true);
      expect(scheduleOwnerSupportsServiceMode(dual('l1'), ServiceMode['in-person'], empty)).toBe(true);
    });
  });

  describe('PractitionerRole owner (kept if ANY paired Location fulfills the mode)', () => {
    it('excludes a provider whose only paired Location cannot serve the mode', () => {
      const pr = prWithLocations('l1');
      const locs = mapOf(inPerson('l1'));
      // in-person-only Location → excluded from the virtual path.
      expect(scheduleOwnerSupportsServiceMode(pr, ServiceMode.virtual, locs)).toBe(false);
      expect(scheduleOwnerSupportsServiceMode(pr, ServiceMode['in-person'], locs)).toBe(true);
    });

    it('keeps a multi-Location provider if any paired Location fulfills the mode', () => {
      const pr = prWithLocations('l1', 'l2');
      const locs = mapOf(inPerson('l1'), virtual('l2'));
      expect(scheduleOwnerSupportsServiceMode(pr, ServiceMode.virtual, locs)).toBe(true);
      expect(scheduleOwnerSupportsServiceMode(pr, ServiceMode['in-person'], locs)).toBe(true);
    });

    it('excludes a provider whose paired Location is not resolvable in the map', () => {
      const pr = prWithLocations('missing');
      expect(scheduleOwnerSupportsServiceMode(pr, ServiceMode.virtual, new Map())).toBe(false);
    });

    it('excludes a provider with no paired Locations at all', () => {
      const pr: PractitionerRole = { resourceType: 'PractitionerRole', id: 'pr-1' };
      expect(scheduleOwnerSupportsServiceMode(pr, ServiceMode['in-person'], new Map())).toBe(false);
    });
  });

  describe('owners with no Location of their own', () => {
    it('passes through a Practitioner owner', () => {
      const practitioner: Practitioner = { resourceType: 'Practitioner', id: 'p-1' };
      expect(scheduleOwnerSupportsServiceMode(practitioner, ServiceMode.virtual, new Map())).toBe(true);
    });

    it('passes through a HealthcareService owner', () => {
      const hs: HealthcareService = { resourceType: 'HealthcareService', id: 'hs-1' };
      expect(scheduleOwnerSupportsServiceMode(hs, ServiceMode['in-person'], new Map())).toBe(true);
    });
  });
});
