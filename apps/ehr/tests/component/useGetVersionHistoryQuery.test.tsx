import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import { ReactNode } from 'react';
import { APIErrorCode } from 'utils/lib/types/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/rcm/state/fee-schedules/fee-schedule.api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getVersionHistory: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(),
}));

import { useApiClients } from 'src/hooks/useAppClients';
import { getVersionHistory } from 'src/rcm/state/fee-schedules/fee-schedule.api';
import { useGetVersionHistoryQuery } from 'src/rcm/state/fee-schedules/fee-schedule.queries';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const apiError = (code: APIErrorCode): Error => Object.assign(new Error(`API error ${code}`), { code });

const VERSIONS = { versions: [{ versionId: 'v2', timestamp: '2026-01-02T00:00:00.000Z' }] };

describe('useGetVersionHistoryQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(getVersionHistory).mockReset();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: {} as any } as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps fetching through VERSION_HISTORY_UNAVAILABLE and resolves once a retry succeeds', async () => {
    vi.mocked(getVersionHistory)
      .mockRejectedValueOnce(apiError(APIErrorCode.VERSION_HISTORY_UNAVAILABLE))
      .mockResolvedValueOnce(VERSIONS);

    const { result } = renderHook(() => useGetVersionHistoryQuery('fs-1', true), { wrapper: createWrapper() });
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(getVersionHistory).toHaveBeenCalledTimes(1);
    expect(result.current.isFetching).toBe(true);
    expect(result.current.isError).toBe(false);
    expect(result.current.data).toBeUndefined();

    await act(() => vi.advanceTimersByTimeAsync(4_000));
    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getVersionHistory).toHaveBeenCalledTimes(2);
    expect(result.current.data).toEqual(VERSIONS);
  });

  it('fails immediately on any other error', async () => {
    vi.mocked(getVersionHistory).mockRejectedValue(apiError(APIErrorCode.FHIR_RESOURCE_NOT_FOUND));

    const { result } = renderHook(() => useGetVersionHistoryQuery('fs-1', true), { wrapper: createWrapper() });
    await act(() => vi.advanceTimersByTimeAsync(0));

    expect(result.current.isError).toBe(true);
    expect(result.current.isFetching).toBe(false);

    await act(() => vi.advanceTimersByTimeAsync(20_000));

    expect(getVersionHistory).toHaveBeenCalledTimes(1);
  });
});
