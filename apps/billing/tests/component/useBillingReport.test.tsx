import { act, renderHook } from '@testing-library/react';
import { ReportRefreshStatus } from 'utils/lib/types/data/billing/billing.types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gzipSync } from 'zlib';
import { useBillingReport } from '../../src/hooks/useBillingReport';

// stable client identity: a fresh object per render would refire the hook's effect
const stableClient = {};
vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: stableClient }),
}));

// jsdom lacks the web compression streams; node provides them
if (!(globalThis as any).DecompressionStream) {
  const streamWeb = await import('node:stream/web');
  vi.stubGlobal('DecompressionStream', (streamWeb as any).DecompressionStream);
}

interface TestReport {
  generatedAt: string;
  rows?: number[];
  status?: ReportRefreshStatus;
  downloadUrl?: string;
}

const idle = (generatedAt: string): TestReport => ({ generatedAt, rows: [1], status: { state: 'idle' } });
const running = (): TestReport => ({
  generatedAt: '',
  rows: [],
  status: { state: 'running', progress: 'computing' },
});

const renderReport = (
  fetchReport: (client: unknown, refresh?: boolean) => Promise<TestReport>
): ReturnType<typeof renderHook<ReturnType<typeof useBillingReport<TestReport>>, unknown>> =>
  renderHook(() => useBillingReport<TestReport>({ fetch: fetchReport as any, errorMessage: 'failed to load report' }));

describe('useBillingReport', () => {
  beforeEach(() => {
    // only the poll timer is faked; stream/zlib I/O needs real macrotasks
    vi.useFakeTimers({ toFake: ['setTimeout'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('fetches once and does not poll when idle', async () => {
    const fetchReport = vi.fn().mockResolvedValue(idle('t1'));
    const { result } = renderReport(fetchReport);
    await act(async () => {});
    expect(fetchReport).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchReport).toHaveBeenCalledTimes(1);
    expect(result.current.report?.generatedAt).toBe('t1');
    expect(result.current.loading).toBe(false);
  });

  it('polls every 4s while running and stops once idle', async () => {
    const fetchReport = vi
      .fn()
      .mockResolvedValueOnce(running())
      .mockResolvedValueOnce(running())
      .mockResolvedValue(idle('t2'));
    const { result } = renderReport(fetchReport);
    await act(async () => {});
    expect(fetchReport).toHaveBeenCalledTimes(1);
    // just under the interval: no poll yet
    await act(() => vi.advanceTimersByTimeAsync(3_999));
    expect(fetchReport).toHaveBeenCalledTimes(1);
    await act(() => vi.advanceTimersByTimeAsync(1));
    expect(fetchReport).toHaveBeenCalledTimes(2);
    await act(() => vi.advanceTimersByTimeAsync(4_000));
    expect(fetchReport).toHaveBeenCalledTimes(3);
    expect(result.current.status?.state).toBe('idle');
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchReport).toHaveBeenCalledTimes(3);
  });

  it('abandons an in-flight poll loop on unmount (generation guard)', async () => {
    const fetchReport = vi.fn().mockResolvedValue(running());
    const { unmount } = renderReport(fetchReport);
    await act(async () => {});
    expect(fetchReport).toHaveBeenCalledTimes(1);
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(fetchReport).toHaveBeenCalledTimes(1);
  });

  it('refresh() refetches with refresh=true', async () => {
    const fetchReport = vi.fn().mockResolvedValue(idle('t1'));
    const { result } = renderReport(fetchReport);
    await act(async () => {});
    await act(async () => {
      result.current.refresh();
    });
    expect(fetchReport).toHaveBeenCalledTimes(2);
    expect(fetchReport).toHaveBeenLastCalledWith(expect.anything(), true);
  });

  it('surfaces fetch failures as error and clears loading', async () => {
    const fetchReport = vi.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderReport(fetchReport);
    await act(async () => {});
    expect(result.current.error).toBeTruthy();
    expect(result.current.loading).toBe(false);
  });

  it('resolves downloadUrl payloads and reuses them while generatedAt is unchanged', async () => {
    const payload = { generatedAt: 't3', rows: [1, 2, 3] };
    const gz = gzipSync(new Uint8Array(Buffer.from(JSON.stringify(payload), 'utf8')));
    const download = vi.fn(async () => new Response(new Uint8Array(gz)));
    vi.stubGlobal('fetch', download);

    const wire = (status: ReportRefreshStatus): TestReport => ({
      generatedAt: 't3',
      downloadUrl: 'https://z3.test/report.json.gz',
      status,
    });
    const fetchReport = vi
      .fn()
      .mockResolvedValueOnce(wire({ state: 'running', progress: 'finishing' }))
      .mockResolvedValue(wire({ state: 'idle' }));
    const { result } = renderReport(fetchReport);
    await act(async () => {
      await new Promise((resolve) => setImmediate(resolve));
    });
    expect(result.current.report?.rows).toEqual([1, 2, 3]);
    expect(download).toHaveBeenCalledTimes(1);

    // poll serves the same snapshot: status updates without a re-download
    await act(() => vi.advanceTimersByTimeAsync(4_000));
    expect(fetchReport).toHaveBeenCalledTimes(2);
    expect(download).toHaveBeenCalledTimes(1);
    expect(result.current.status?.state).toBe('idle');
    expect(result.current.report?.rows).toEqual([1, 2, 3]);

    vi.unstubAllGlobals();
  });
});
