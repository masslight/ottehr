import { Basic } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getMailedStatementSyncState,
  recordMailedStatementSyncRun,
} from '../../src/shared/mailed-statement-sync-state';

const LAST_RUN_AT_URL = 'https://fhir.ottehr.com/mailed-statement-sync/last-run-at';
const LAST_RUN_UPDATED_URL = 'https://fhir.ottehr.com/mailed-statement-sync/last-run-updated-count';
const LAST_RUN_ERRORS_URL = 'https://fhir.ottehr.com/mailed-statement-sync/last-run-error-count';

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function makeBundle(resources: Basic[]) {
  return { unbundle: () => resources };
}

const mockOystehr = {
  fhir: {
    search: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getMailedStatementSyncState', () => {
  it('returns an empty state when no Basic exists', async () => {
    mockOystehr.fhir.search.mockResolvedValueOnce(makeBundle([]));

    const state = await getMailedStatementSyncState(mockOystehr as any);

    expect(state).toEqual({ lastRunAt: null, updatedCount: null, errorCount: null });
  });

  it('parses the persisted run state from the Basic extensions', async () => {
    const basic: Basic = {
      resourceType: 'Basic',
      id: 'state-1',
      code: { text: 'Mailed statement status sync cron state' },
      extension: [
        { url: LAST_RUN_AT_URL, valueDateTime: '2026-06-22T06:00:00.000Z' },
        { url: LAST_RUN_UPDATED_URL, valueInteger: 5 },
        { url: LAST_RUN_ERRORS_URL, valueInteger: 1 },
      ],
    };
    mockOystehr.fhir.search.mockResolvedValueOnce(makeBundle([basic]));

    const state = await getMailedStatementSyncState(mockOystehr as any);

    expect(state).toEqual({ lastRunAt: '2026-06-22T06:00:00.000Z', updatedCount: 5, errorCount: 1 });
  });
});

describe('recordMailedStatementSyncRun', () => {
  it('creates a new Basic when none exists', async () => {
    mockOystehr.fhir.search.mockResolvedValueOnce(makeBundle([]));
    mockOystehr.fhir.create.mockResolvedValueOnce({ id: 'new-1' });

    await recordMailedStatementSyncRun(mockOystehr as any, {
      ranAt: '2026-06-22T06:00:00.000Z',
      updatedCount: 3,
      errorCount: 0,
    });

    expect(mockOystehr.fhir.create).toHaveBeenCalledOnce();
    expect(mockOystehr.fhir.update).not.toHaveBeenCalled();

    const created = mockOystehr.fhir.create.mock.calls[0][0] as Basic;
    expect(created.resourceType).toBe('Basic');
    expect(created.extension).toContainEqual({ url: LAST_RUN_AT_URL, valueDateTime: '2026-06-22T06:00:00.000Z' });
    expect(created.extension).toContainEqual({ url: LAST_RUN_UPDATED_URL, valueInteger: 3 });
    expect(created.extension).toContainEqual({ url: LAST_RUN_ERRORS_URL, valueInteger: 0 });
  });

  it('updates the existing Basic when one exists', async () => {
    const existing: Basic = {
      resourceType: 'Basic',
      id: 'state-1',
      code: { text: 'Mailed statement status sync cron state' },
      extension: [{ url: LAST_RUN_AT_URL, valueDateTime: '2026-06-21T06:00:00.000Z' }],
    };
    mockOystehr.fhir.search.mockResolvedValueOnce(makeBundle([existing]));
    mockOystehr.fhir.update.mockResolvedValueOnce({});

    await recordMailedStatementSyncRun(mockOystehr as any, {
      ranAt: '2026-06-23T06:00:00.000Z',
      updatedCount: 7,
      errorCount: 2,
    });

    expect(mockOystehr.fhir.update).toHaveBeenCalledOnce();
    expect(mockOystehr.fhir.create).not.toHaveBeenCalled();

    const updated = mockOystehr.fhir.update.mock.calls[0][0] as Basic;
    expect(updated.id).toBe('state-1');
    expect(updated.extension).toContainEqual({ url: LAST_RUN_AT_URL, valueDateTime: '2026-06-23T06:00:00.000Z' });
    expect(updated.extension).toContainEqual({ url: LAST_RUN_UPDATED_URL, valueInteger: 7 });
    expect(updated.extension).toContainEqual({ url: LAST_RUN_ERRORS_URL, valueInteger: 2 });
  });
});
