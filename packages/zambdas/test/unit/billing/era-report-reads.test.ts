import { SearchParam } from '@oystehr/sdk';
import { PaymentReconciliation } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import { ERA_PAGE_SIZE, fetchAllEras } from '../../../src/billing/reports/shared';
import { OystehrMock } from '../../helpers/oystehr-mock';

// OTR-3330: both Insurance Payments and Net Collections use this scan when refreshed.
describe('fetchAllEras', () => {
  it('excludes voided ERAs on every page without losing active ERAs', async () => {
    const active: PaymentReconciliation[] = Array.from({ length: ERA_PAGE_SIZE + 1 }, (_, index) => ({
      resourceType: 'PaymentReconciliation',
      id: `era-${index}`,
      status: 'active',
      created: '2026-01-01',
      paymentDate: '2026-01-01',
      paymentAmount: { value: 100, currency: 'USD' },
    }));
    const voided: PaymentReconciliation = { ...active[0], id: 'voided', status: 'cancelled' };
    const stored = [voided, ...active];
    const search = vi.fn().mockImplementation(({ params }: { params: SearchParam[] }) => {
      const excludedStatus = params.find((param) => param.name === 'status:not')?.value;
      const offset = Number(params.find((param) => param.name === '_offset')?.value);
      const count = Number(params.find((param) => param.name === '_count')?.value);
      const filtered = stored.filter((era) => era.status !== excludedStatus);
      const resources = filtered.slice(offset, offset + count);
      return Promise.resolve({
        unbundle: () => resources,
        link: offset + count < filtered.length ? [{ relation: 'next', url: 'next-page' }] : [],
      });
    });
    const oystehr = { fhir: { search } } as unknown as OystehrMock;

    expect(await fetchAllEras(oystehr)).toEqual(active);
    expect(search).toHaveBeenCalledTimes(2);
    for (const [input] of search.mock.calls) {
      expect(input.resourceType).toBe('PaymentReconciliation');
      expect(input.params).toContainEqual({ name: 'status:not', value: 'cancelled' });
    }
  });
});
