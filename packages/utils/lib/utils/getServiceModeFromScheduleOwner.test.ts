import { Location, PractitionerRole, Schedule } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { PUBLIC_EXTENSION_BASE_URL, SlotServiceCategory } from '../fhir/constants';
import { LOCATION_IN_PERSON_CODE, LOCATION_PHYSICAL_TYPE_SYSTEM } from '../fhir/location';
import { ServiceMode } from '../types/common';
import { getServiceModeFromScheduleOwner } from './scheduleUtils';

const LOCATION_FORM_EXTENSION_URL = `${PUBLIC_EXTENSION_BASE_URL}/location-form-pre-release`;

const location = (...codes: string[]): Location => ({
  resourceType: 'Location',
  id: 'loc-1',
  status: 'active',
  extension: codes.map((code) => ({
    url: LOCATION_FORM_EXTENSION_URL,
    valueCoding: { system: LOCATION_PHYSICAL_TYPE_SYSTEM, code },
  })),
});

const dual = (): Location => location('vi', LOCATION_IN_PERSON_CODE);
const IN_PERSON = ServiceMode['in-person'];
const VIRTUAL = ServiceMode.virtual;

describe('getServiceModeFromScheduleOwner', () => {
  describe('without preferredServiceMode (unchanged behavior)', () => {
    it('resolves a dual-mode Location to virtual', () => {
      expect(getServiceModeFromScheduleOwner(dual())).toBe(VIRTUAL);
    });

    it('resolves virtual-only, in-person-only and legacy Locations by their tags', () => {
      expect(getServiceModeFromScheduleOwner(location('vi'))).toBe(VIRTUAL);
      expect(getServiceModeFromScheduleOwner(location(LOCATION_IN_PERSON_CODE))).toBe(IN_PERSON);
      expect(getServiceModeFromScheduleOwner(location())).toBe(IN_PERSON);
    });
  });

  describe('with preferredServiceMode', () => {
    it('returns the preferred mode for a dual-mode Location (OTR-3637)', () => {
      expect(getServiceModeFromScheduleOwner(dual(), undefined, IN_PERSON)).toBe(IN_PERSON);
      expect(getServiceModeFromScheduleOwner(dual(), undefined, VIRTUAL)).toBe(VIRTUAL);
    });

    it('ignores a preference the Location cannot serve', () => {
      expect(getServiceModeFromScheduleOwner(location('vi'), undefined, IN_PERSON)).toBe(VIRTUAL);
      expect(getServiceModeFromScheduleOwner(location(LOCATION_IN_PERSON_CODE), undefined, VIRTUAL)).toBe(IN_PERSON);
    });

    it('ignores the preference for non-Location owners', () => {
      const pr: PractitionerRole = { resourceType: 'PractitionerRole', id: 'pr-1' };
      expect(getServiceModeFromScheduleOwner(pr, undefined, VIRTUAL)).toBe(getServiceModeFromScheduleOwner(pr));
    });

    it('lets an explicit schedule mode win over the preference', () => {
      const virtualSchedule: Schedule = {
        resourceType: 'Schedule',
        actor: [{ reference: 'Location/loc-1' }],
        serviceCategory: [SlotServiceCategory.virtualServiceMode],
      };
      expect(getServiceModeFromScheduleOwner(dual(), virtualSchedule, IN_PERSON)).toBe(VIRTUAL);
    });
  });
});
