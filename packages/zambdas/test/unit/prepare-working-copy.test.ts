import { Coverage, Location, Organization, Patient, Practitioner, Resource } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  BILLING_RESOURCE_TAG,
  BILLING_WORKING_COPY_TAG,
  prepareWorkingCopy,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../../src/billing/shared';

const ORIGINAL_ID = '11111111-1111-4111-8111-111111111111';

const identifiersOf = (r: Resource): { system?: string; value?: string }[] =>
  (r as { identifier?: { system?: string; value?: string }[] }).identifier ?? [];

// Everything prepareWorkingCopy is allowed to change: id, meta, identifier.
const withoutCopyFields = (r: Resource): Record<string, unknown> => {
  const clone = structuredClone(r) as unknown as Record<string, unknown>;
  delete clone.id;
  delete clone.meta;
  delete clone.identifier;
  return clone;
};

const cases: { resourceType: string; resource: Resource }[] = [
  {
    resourceType: 'Patient',
    resource: {
      resourceType: 'Patient',
      id: ORIGINAL_ID,
      name: [{ family: 'Doe', given: ['Jane'] }],
      birthDate: '1990-01-01',
    } as Patient,
  },
  {
    resourceType: 'Coverage',
    resource: {
      resourceType: 'Coverage',
      id: ORIGINAL_ID,
      status: 'active',
      subscriberId: 'SUB-1',
      beneficiary: { reference: 'Patient/p1' },
      payor: [{ reference: 'Organization/o1' }],
    } as Coverage,
  },
  {
    resourceType: 'Practitioner',
    resource: {
      resourceType: 'Practitioner',
      id: ORIGINAL_ID,
      name: [{ family: 'Smith', given: ['Sam'] }],
    } as Practitioner,
  },
  { resourceType: 'Location', resource: { resourceType: 'Location', id: ORIGINAL_ID, name: 'Clinic A' } as Location },
  {
    resourceType: 'Organization',
    resource: { resourceType: 'Organization', id: ORIGINAL_ID, name: 'Acme Labs' } as Organization,
  },
];

describe('prepareWorkingCopy', () => {
  // The same contract must hold for every resource type it is called on.
  describe.each(cases)('for $resourceType', ({ resourceType, resource }) => {
    it('tags the copy as a billing working copy (so list views exclude it)', () => {
      expect(prepareWorkingCopy(resource, ORIGINAL_ID).meta?.tag).toEqual([
        BILLING_RESOURCE_TAG,
        BILLING_WORKING_COPY_TAG,
      ]);
    });

    it('drops the original id so create() makes a new resource', () => {
      expect(prepareWorkingCopy(resource, ORIGINAL_ID).id).toBeUndefined();
    });

    it('links back to the original via a source identifier', () => {
      expect(identifiersOf(prepareWorkingCopy(resource, ORIGINAL_ID))).toContainEqual({
        system: SOURCE_IDENTIFIER_SYSTEM,
        value: `${resourceType}/${ORIGINAL_ID}`,
      });
    });

    it('preserves every other field unchanged', () => {
      expect(withoutCopyFields(prepareWorkingCopy(resource, ORIGINAL_ID))).toEqual(withoutCopyFields(resource));
    });

    it('does not mutate the original', () => {
      const before = structuredClone(resource);
      prepareWorkingCopy(resource, ORIGINAL_ID);
      expect(resource).toEqual(before);
    });
  });

  describe('identifier list handling', () => {
    const otherId = { system: 'https://example.org/external-id', value: 'EXT-1' };

    it('preserves existing non-source identifiers', () => {
      const patient: Patient = { resourceType: 'Patient', id: ORIGINAL_ID, identifier: [{ ...otherId }] };
      expect(identifiersOf(prepareWorkingCopy(patient, ORIGINAL_ID))).toContainEqual(otherId);
    });

    it('creates the identifier list when the original has none', () => {
      const coverage: Coverage = {
        resourceType: 'Coverage',
        id: ORIGINAL_ID,
        status: 'active',
        beneficiary: { reference: 'Patient/p1' },
        payor: [{ reference: 'Organization/o1' }],
      };
      expect(prepareWorkingCopy(coverage, ORIGINAL_ID).identifier).toEqual([
        { system: SOURCE_IDENTIFIER_SYSTEM, value: `Coverage/${ORIGINAL_ID}` },
      ]);
    });

    it('replaces a stale source identifier instead of duplicating it', () => {
      const patient: Patient = {
        resourceType: 'Patient',
        id: ORIGINAL_ID,
        identifier: [{ system: SOURCE_IDENTIFIER_SYSTEM, value: 'Patient/stale' }, { ...otherId }],
      };
      const sources = identifiersOf(prepareWorkingCopy(patient, ORIGINAL_ID)).filter(
        (i) => i.system === SOURCE_IDENTIFIER_SYSTEM
      );
      expect(sources).toEqual([{ system: SOURCE_IDENTIFIER_SYSTEM, value: `Patient/${ORIGINAL_ID}` }]);
    });

    it('overwrites any pre-existing meta.tag', () => {
      const patient: Patient = {
        resourceType: 'Patient',
        id: ORIGINAL_ID,
        meta: { tag: [{ system: 'old', code: 'x' }] },
      };
      expect(prepareWorkingCopy(patient, ORIGINAL_ID).meta?.tag).not.toContainEqual({ system: 'old', code: 'x' });
    });
  });
});
