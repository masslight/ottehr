import Oystehr from '@oystehr/sdk';
import { HealthcareService } from 'fhir/r4b';
import { SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { describe, expect, it, vi } from 'vitest';
import { findServiceCategoryByCode } from '../../src/ehr/admin-service-categories/helpers';

const serviceCategory = (id: string, code: string): HealthcareService => ({
  resourceType: 'HealthcareService',
  id,
  active: true,
  type: [{ coding: [{ system: SERVICE_CATEGORY_SYSTEM, code }] }],
});

describe('findServiceCategoryByCode', () => {
  it('finds a matching category beyond the first FHIR search page', async () => {
    const pages = [serviceCategory('first', 'first-code'), serviceCategory('second', 'target-code')];
    const search = vi.fn().mockImplementation(async ({ params }) => {
      const offset = Number(params.find((param: { name: string }) => param.name === '_offset')?.value ?? 0);
      const resource = pages[offset];
      return {
        total: pages.length,
        entry: resource ? [{ resource, search: { mode: 'match' } }] : [],
        unbundle: () => (resource ? [resource] : []),
      };
    });
    const oystehr = { fhir: { search } } as unknown as Oystehr;

    await expect(findServiceCategoryByCode(oystehr, 'target-code')).resolves.toMatchObject({ id: 'second' });
    expect(search).toHaveBeenCalledTimes(2);
  });
});
