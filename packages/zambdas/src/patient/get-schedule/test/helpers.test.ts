import { HealthcareService, Location, PractitionerRole } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { isEntryAtBookableLocation } from '../helpers';

const bookable = (id: string): Location => ({ resourceType: 'Location', id, status: 'active' });
const deactivated = (id: string): Location => ({ resourceType: 'Location', id, status: 'inactive' });

/** Mirrors the handler's map: membership means the server-side lookup confirmed it bookable. */
const mapOf = (...locations: Location[]): Map<string, Location> => new Map(locations.map((loc) => [loc.id!, loc]));

const prAt = (...locationIds: string[]): { owner: PractitionerRole } => ({
  owner: {
    resourceType: 'PractitionerRole',
    id: 'pr-1',
    location: locationIds.map((id) => ({ reference: `Location/${id}` })),
  },
});

describe('isEntryAtBookableLocation', () => {
  describe('Location-actored schedules', () => {
    it('keeps a schedule at a bookable Location', () => {
      expect(isEntryAtBookableLocation({ owner: bookable('loc-1') }, mapOf())).toBe(true);
    });

    it('drops a schedule at a deactivated Location', () => {
      expect(isEntryAtBookableLocation({ owner: deactivated('loc-1') }, mapOf())).toBe(false);
    });

    it('judges the owner directly rather than by map membership', () => {
      // Location owners carry their own status, so they never depend on the paired-Location map —
      // which is only populated for PractitionerRole-derived references.
      expect(isEntryAtBookableLocation({ owner: bookable('loc-1') }, mapOf(deactivated('loc-9')))).toBe(true);
    });
  });

  describe('PractitionerRole-actored schedules', () => {
    it('keeps a provider with at least one bookable Location', () => {
      expect(isEntryAtBookableLocation(prAt('loc-1'), mapOf(bookable('loc-1')))).toBe(true);
    });

    it('keeps a provider who still has one bookable Location among several', () => {
      // Partial deactivation must not take the provider offline — the surviving Location can still
      // host them, and the picker narrows to it.
      expect(isEntryAtBookableLocation(prAt('loc-1', 'loc-2'), mapOf(bookable('loc-2')))).toBe(true);
    });

    it('drops a provider whose every Location is deactivated', () => {
      // The reported bug: a group of providers at one Location kept vending slots after that
      // Location was deactivated, because pruning the qualifying-id set left it empty and an empty
      // set takes neither narrowing branch.
      expect(isEntryAtBookableLocation(prAt('loc-1'), mapOf())).toBe(false);
      expect(isEntryAtBookableLocation(prAt('loc-1', 'loc-2'), mapOf())).toBe(false);
    });

    it('keeps a provider with no Location references at all', () => {
      // Nothing to deactivate. Dropping these would silently take Location-less provider schedules
      // out of booking, which is a behavior change well beyond deactivating a Location.
      expect(isEntryAtBookableLocation(prAt(), mapOf())).toBe(true);
    });

    it('ignores a malformed Location reference rather than treating it as bookable', () => {
      const owner = {
        owner: { resourceType: 'PractitionerRole', id: 'pr-1', location: [{ display: 'no reference here' }] },
      };
      expect(isEntryAtBookableLocation(owner, mapOf(bookable('loc-1')))).toBe(false);
    });
  });

  it('passes through owners that have no Location of their own', () => {
    // HealthcareService / Practitioner owners are rare in the current model and have nothing to
    // judge; the surrounding narrowing logic treats them the same way.
    const hs: { owner: HealthcareService } = { owner: { resourceType: 'HealthcareService', id: 'hs-1' } };
    expect(isEntryAtBookableLocation(hs, mapOf())).toBe(true);
  });
});
