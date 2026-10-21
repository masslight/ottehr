import Oystehr from '@oystehr/sdk';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { billingClaimsDataset } from '../../src/features/report-builder/datasets/billing-claims';
import { AD_HOC_DATASETS, datasetCatalog } from '../../src/features/report-builder/datasets/registry';

describe('ad-hoc dataset registry', () => {
  it('gives every dataset a unique id, a base schema and a layer map', () => {
    const ids = AD_HOC_DATASETS.map((dataset) => dataset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const dataset of AD_HOC_DATASETS) {
      expect(dataset.baseSchema, dataset.id).toBeDefined();
      expect(dataset.layers, dataset.id).toBeDefined();
    }
  });

  it('lists the clinical and the billing-app finance datasets under distinct names', () => {
    const catalog = datasetCatalog();
    const labels = catalog.map((dataset) => dataset.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(catalog.find((dataset) => dataset.id === 'billing')?.label).toBe('Visit payments & charges (EHR)');
    const claims = catalog.find((dataset) => dataset.id === 'billing-claims');
    expect(claims?.label).toBe('Claims (billing app)');
    expect(claims?.layers.map((layer) => layer.id)).toEqual([
      'codes',
      'claimDetails',
      'coverage',
      'writeOffs',
      'patientPayments',
      'remits',
      'timeline',
      'insurancePayments',
      'history',
    ]);
    // Internal ids never reach the model.
    expect(claims?.fields.map((field) => field.name)).not.toContain('encounterId');
  });
});

describe('billing-claims dataset fetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('builds through the billing app zambda and turns event dates into calendar days', async () => {
    const execute = vi.fn(async ({ id, taskId }: { id: string; taskId?: string }) => ({
      output: taskId ? { status: 'completed', downloadUrl: 'https://signed.example/rows.json' } : { taskId: 'task-1' },
      id,
    }));
    const row = {
      claimId: 'claim-1',
      serviceDate: '2026-10-05',
      lastRemitDate: '2026-10-11T12:00:00Z',
      remits: [{ date: '2026-10-11T12:00:00Z', allowed: 150, paid: 120, patientResp: 30 }],
      writeOffs: [{ date: '2026-10-13', amount: 10, party: '', payer: '', reason: 'x', voided: false }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ rows: [row] }) }))
    );

    const rows = await billingClaimsDataset.fetch({
      oystehrZambda: { zambda: { execute } } as unknown as Oystehr,
      queryClient: new QueryClient(),
      dateRange: { start: '2026-10-01T00:00:00.000-04:00', end: '2026-10-19T23:59:59.999-04:00' },
      options: { remits: true },
    });

    expect(execute.mock.calls.map(([args]) => args.id)).toEqual(['adhoc-billing-dataset', 'adhoc-billing-dataset']);
    expect(execute.mock.calls[0][0]).toMatchObject({ datasetId: 'billing-claims', options: { remits: true } });
    expect(rows[0]).toMatchObject({
      serviceDate: '2026-10-05',
      lastRemitDate: '2026-10-11',
      remits: [{ date: '2026-10-11' }],
      writeOffs: [{ date: '2026-10-13' }],
    });
    // A layer that was not loaded stays absent rather than turning into a null column.
    expect(rows[0]).not.toHaveProperty('insuranceFinalizedDate');
  });
});

describe('report builder custom date range', () => {
  it('reads picked days as New York days whatever the browser zone', async () => {
    const { Settings } = await import('luxon');
    const { rangeFromControls } = await import('../../src/features/report-builder/page/useReportBuilder');
    const zone = Settings.defaultZone;
    try {
      for (const browserZone of ['Europe/Kyiv', 'America/Los_Angeles', 'Asia/Tokyo']) {
        Settings.defaultZone = browserZone;
        expect(rangeFromControls('customRange', '', '2026-07-01', '2026-10-20')).toEqual({
          start: '2026-07-01T00:00:00.000-04:00',
          end: '2026-10-20T23:59:59.999-04:00',
        });
        expect(rangeFromControls('custom', '2026-07-01', '', '')).toEqual({
          start: '2026-07-01T00:00:00.000-04:00',
          end: '2026-07-01T23:59:59.999-04:00',
        });
      }
    } finally {
      Settings.defaultZone = zone;
    }
  });
});
