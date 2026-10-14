import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, RenderHookResult, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MedicalRecordDateSpan } from 'utils/lib/types/data/get-patient-medical-record.types';
import { describe, expect, it, vi } from 'vitest';

const mockGetMedicalRecordDateSpan = vi.fn<(oystehr: unknown, input: unknown) => Promise<MedicalRecordDateSpan>>();

vi.mock('src/api/api', () => ({
  getMedicalRecordDateSpan: (oystehr: unknown, input: unknown) => mockGetMedicalRecordDateSpan(oystehr, input),
}));
vi.mock('src/hooks/useAppClients', () => ({ useApiClients: () => ({ oystehrZambda: {} }) }));

import { useMedicalRecordDateSpan } from '../../src/hooks/useMedicalRecordDateSpan';

const PATIENT_ID = '11111111-1111-1111-1111-111111111111';
const CACHED = { earliest: '2026-01-15T15:00:00.000Z', latest: '2026-03-01T14:00:00.000Z' };
const FRESH = { earliest: '2025-11-03T15:00:00.000Z', latest: '2026-03-01T14:00:00.000Z' };

type DateSpanResult = ReturnType<typeof useMedicalRecordDateSpan>;

const renderDateSpan = (queryClient: QueryClient): RenderHookResult<DateSpanResult, { open: boolean }> =>
  renderHook<DateSpanResult, { open: boolean }>(({ open }) => useMedicalRecordDateSpan(PATIENT_ID, open), {
    initialProps: { open: true },
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

describe('useMedicalRecordDateSpan', () => {
  it('requests fresh record dates on every reopening, even when the app keeps queries fresh by default', async () => {
    mockGetMedicalRecordDateSpan.mockResolvedValueOnce(CACHED);
    const { result, rerender } = renderDateSpan(
      new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
    );
    await waitFor(() => expect(result.current.data).toEqual(CACHED));

    rerender({ open: false });
    let resolveFresh: (span: MedicalRecordDateSpan) => void = () => undefined;
    mockGetMedicalRecordDateSpan.mockReturnValueOnce(new Promise((resolve) => (resolveFresh = resolve)));
    rerender({ open: true });

    expect(result.current.data).toEqual(CACHED);
    expect(result.current.isFetching).toBe(true);

    resolveFresh(FRESH);
    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(result.current.data).toEqual(FRESH);
    expect(mockGetMedicalRecordDateSpan).toHaveBeenLastCalledWith({}, { patientId: PATIENT_ID });
  });

  it('retries a failed request once before reporting the failure', async () => {
    mockGetMedicalRecordDateSpan.mockReset();
    mockGetMedicalRecordDateSpan.mockRejectedValue(new Error('unavailable'));
    const { result } = renderDateSpan(new QueryClient({ defaultOptions: { queries: { retry: 3 } } }));

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 3000 });
    expect(mockGetMedicalRecordDateSpan).toHaveBeenCalledTimes(2);
  });
});
