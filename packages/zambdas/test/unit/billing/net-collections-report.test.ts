import { describe, expect, it } from 'vitest';
import { netCollectionsReport } from '../../../src/billing/reports/definitions/net-collections.report';
import { reportRegistry } from '../../../src/billing/reports/framework/registry';

describe('net-collections report definition', () => {
  it('is registered and keys its cache by the date window', () => {
    expect(reportRegistry['net-collections']).toBe(netCollectionsReport);
    expect(netCollectionsReport.cacheKeyOf({ dateFrom: '2026-01-01', dateTo: '2026-01-31' })).toBe(
      '2026-01-01:2026-01-31'
    );
    expect(netCollectionsReport.cacheKeyOf({})).toBe('all:all');
  });

  it('serves an all-zero empty payload', () => {
    const empty = netCollectionsReport.emptyPayload();
    expect(empty.overall).toEqual({ collected: 0, expected: 0 });
    expect(empty.insurance).toEqual({ collected: 0, expected: 0 });
    expect(empty.patient).toEqual({ collected: 0, expected: 0 });
    expect(empty.payerRows).toEqual([]);
    expect(empty.monthly).toEqual([]);
  });

  it('summarize reports the overall rate', () => {
    const summary = netCollectionsReport.summarize({
      overall: { collected: 942, expected: 1000 },
      insurance: { collected: 800, expected: 820 },
      patient: { collected: 142, expected: 180 },
      payerRows: [{}, {}] as never,
      monthly: [],
      generatedAt: '2026-02-01T00:00:00.000Z',
    });
    expect(summary).toBe('net collections cached (94.2% overall, 2 payers)');
  });
});
