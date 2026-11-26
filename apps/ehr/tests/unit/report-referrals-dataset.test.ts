import Oystehr from '@oystehr/sdk';
import { QueryClient } from '@tanstack/react-query';
import { Settings } from 'luxon';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { referralsDataset } from '../../src/features/report-builder/datasets/referrals';

describe('referrals dataset fetch', () => {
  const zone = Settings.defaultZone;
  afterEach(() => {
    vi.unstubAllGlobals();
    Settings.defaultZone = zone;
  });

  it('adds the viewer-local creation day as `date`, like every other dataset', async () => {
    Settings.defaultZone = 'America/New_York';
    const execute = vi.fn(async ({ id, taskId }: { id: string; taskId?: string }) => ({
      output: taskId ? { status: 'completed', downloadUrl: 'https://signed.example/rows.json' } : { taskId: 'task-1' },
      id,
    }));
    const lateEvening = { referralId: 'referral-1', createdAt: '2026-10-31T02:30:00.000Z', date: null };
    const noCreatedAt = { referralId: 'referral-2', createdAt: '', date: null };
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ referrals: [lateEvening, noCreatedAt] }) }))
    );

    const rows = await referralsDataset.fetch({
      oystehrZambda: { zambda: { execute } } as unknown as Oystehr,
      queryClient: new QueryClient(),
      dateRange: { start: '2026-10-01T00:00:00.000-04:00', end: '2026-10-31T23:59:59.999-04:00' },
      options: {},
    });

    expect(execute.mock.calls[0][0]).toMatchObject({ datasetId: 'referrals' });
    expect(rows).toEqual([
      { ...lateEvening, date: '2026-10-30' },
      { ...noCreatedAt, date: null },
    ]);
  });
});
