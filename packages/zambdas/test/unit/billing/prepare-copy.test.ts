import { Coverage, DomainResource, Extension, Location, Organization, Patient, Practitioner, Resource } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import {
  BILLING_WORKING_COPY_TAG,
  CopyableBillingResource,
  prepareCopy,
  prepareWorkingCopy,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../../../src/billing/shared';

const ORIGINAL_ID = '11111111-1111-4111-8111-111111111111';

const extensionsOf = (r: DomainResource): Extension[] => r.extension ?? [];

// Everything prepareWorkingCopy is allowed to change: id, meta, identifier.
const withoutCopyFields = (r: Resource): Record<string, unknown> => {
  const clone = structuredClone(r) as unknown as Record<string, unknown>;
  delete clone.id;
  delete clone.meta;
  delete clone.extension;
  return clone;
};

const cases: { resourceType: string; resource: CopyableBillingResource }[] = [
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
      // Only the working-copy tag is set explicitly; the workspace SDK client adds BILLING_RESOURCE_TAG on write.
      expect(prepareWorkingCopy<typeof resource>(resource, ORIGINAL_ID).meta?.tag).toEqual([BILLING_WORKING_COPY_TAG]);
    });

    it('drops the original id so create() makes a new resource', () => {
      expect(prepareWorkingCopy<typeof resource>(resource, ORIGINAL_ID).id).toBeUndefined();
    });

    it('links back to the original via a source identifier', () => {
      expect(extensionsOf(prepareWorkingCopy<typeof resource>(resource, ORIGINAL_ID))).toContainEqual({
        url: SOURCE_IDENTIFIER_SYSTEM,
        valueReference: { reference: `${resourceType}/${ORIGINAL_ID}` },
      });
    });

    it('preserves every other field unchanged', () => {
      expect(withoutCopyFields(prepareWorkingCopy<typeof resource>(resource, ORIGINAL_ID))).toEqual(
        withoutCopyFields(resource)
      );
    });

    it('does not mutate the original', () => {
      const before = structuredClone(resource);
      prepareWorkingCopy<typeof resource>(resource, ORIGINAL_ID);
      expect(resource).toEqual(before);
    });
  });

  describe('extension list handling', () => {
    const otherId = { url: 'https://example.org/external-id', valueString: 'EXT-1' };

    it('does not preserve existing non-source identifiers', () => {
      const patient: Patient = { resourceType: 'Patient', id: ORIGINAL_ID, extension: [{ ...otherId }] };
      expect(extensionsOf(prepareWorkingCopy<typeof patient>(patient, ORIGINAL_ID))).not.toContainEqual(otherId);
    });

    it('creates the identifier list when the original has none', () => {
      const coverage: Coverage = {
        resourceType: 'Coverage',
        id: ORIGINAL_ID,
        status: 'active',
        beneficiary: { reference: 'Patient/p1' },
        payor: [{ reference: 'Organization/o1' }],
      };
      expect(extensionsOf(prepareWorkingCopy<typeof coverage>(coverage, ORIGINAL_ID))).toEqual([
        { url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: `Coverage/${ORIGINAL_ID}` } },
      ]);
    });

    it('replaces a stale source identifier instead of duplicating it', () => {
      const patient: Patient = {
        resourceType: 'Patient',
        id: ORIGINAL_ID,
        extension: [{ url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: 'Patient/stale' } }, { ...otherId }],
      };
      const sources = extensionsOf(prepareWorkingCopy<typeof patient>(patient, ORIGINAL_ID)).filter(
        (i) => i.url === SOURCE_IDENTIFIER_SYSTEM
      );
      expect(sources).toEqual([
        { url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: `Patient/${ORIGINAL_ID}` } },
      ]);
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

describe('prepareCopy', () => {
  describe.each(cases)('for $resourceType', ({ resourceType, resource }) => {
    it('does not tag the copy as a working copy', () => {
      // Only the working-copy tag is set explicitly; the workspace SDK client adds BILLING_RESOURCE_TAG on write.
      expect(prepareCopy<typeof resource>(resource, ORIGINAL_ID).meta?.tag).toBeUndefined();
    });

    it('drops the original id so create() makes a new resource', () => {
      expect(prepareCopy<typeof resource>(resource, ORIGINAL_ID).id).toBeUndefined();
    });

    it('links back to the original via a source identifier', () => {
      expect(extensionsOf(prepareCopy<typeof resource>(resource, ORIGINAL_ID))).toContainEqual({
        url: SOURCE_IDENTIFIER_SYSTEM,
        valueReference: { reference: `${resourceType}/${ORIGINAL_ID}` },
      });
    });

    it('preserves every other field unchanged', () => {
      expect(withoutCopyFields(prepareCopy<typeof resource>(resource, ORIGINAL_ID))).toEqual(
        withoutCopyFields(resource)
      );
    });

    it('does not mutate the original', () => {
      const before = structuredClone(resource);
      prepareCopy<typeof resource>(resource, ORIGINAL_ID);
      expect(resource).toEqual(before);
    });
  });
});
