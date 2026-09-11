import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/api/api', () => ({
  getAppointments: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(),
}));

import { getAppointments } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { TrackingBoardFilters, useGetTrackingBoard } from 'src/hooks/useGetTrackingBoard';

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

const filters: TrackingBoardFilters = {
  dateFrom: '2026-09-02',
  dateTo: '2026-09-02',
  locationIds: ['550e8400-e29b-41d4-a716-446655440000'],
  providerIds: [],
  serviceCategories: [],
  visitType: ['in-person-walk-in', 'in-person-pre-booked'],
};

describe('useGetTrackingBoard', () => {
  beforeEach(() => {
    vi.mocked(getAppointments).mockReset();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: {} as any } as any);
  });

  it('requests the board for the given filters', async () => {
    vi.mocked(getAppointments).mockResolvedValue({
      message: 'ok',
      preBooked: [],
      inOffice: [{ id: 'appt-1', encounterId: 'enc-1' }],
      completed: [],
      cancelled: [],
      orders: {},
      vitals: {},
    } as any);

    const { result } = renderHook(() => useGetTrackingBoard(filters), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getAppointments).toHaveBeenCalledTimes(1);
    const [, input] = vi.mocked(getAppointments).mock.calls[0];
    expect(input).toMatchObject({
      searchDateFrom: '2026-09-02',
      searchDateTo: '2026-09-02',
      locationIds: filters.locationIds,
      providerIds: [],
      serviceCategories: [],
      visitType: filters.visitType,
    });
    expect(input).not.toHaveProperty('include');
    expect(result.current.data?.inOffice).toHaveLength(1);
  });

  it('passes the server-grouped orders and vitals through untouched', async () => {
    const orders = { inHouseMedicationsByEncounterId: { 'enc-1': [{ id: 'med-1' }] } };
    const vitals = { 'enc-1': { 'vital-temperature': [{ resourceId: 'obs-1' }] } };
    vi.mocked(getAppointments).mockResolvedValue({
      message: 'ok',
      preBooked: [],
      inOffice: [],
      completed: [],
      cancelled: [],
      orders: orders as any,
      vitals: vitals as any,
    });

    const { result } = renderHook(() => useGetTrackingBoard(filters), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.orders).toBe(orders);
    expect(result.current.data?.vitals).toBe(vitals);
  });

  it('keeps the previous orders and vitals when the server reports them incomplete', async () => {
    const orders = { inHouseMedicationsByEncounterId: { 'enc-1': [{ id: 'med-1' }] } };
    const vitals = { 'enc-1': { 'vital-temperature': [{ resourceId: 'obs-1' }] } };
    const rows = [{ id: 'appt-1', encounterId: 'enc-1' }];
    vi.mocked(getAppointments)
      .mockResolvedValueOnce({
        message: 'ok',
        preBooked: [],
        inOffice: rows,
        completed: [],
        cancelled: [],
        orders,
        vitals,
      } as any)
      // One of the order searches failed server-side: the maps came back empty and flagged.
      .mockResolvedValueOnce({
        message: 'ok',
        preBooked: [],
        inOffice: [...rows, { id: 'appt-2', encounterId: 'enc-2' }],
        completed: [],
        cancelled: [],
        orders: {} as any,
        vitals: {},
        ordersAndVitalsIncomplete: true,
      } as any);

    const { result } = renderHook(() => useGetTrackingBoard(filters), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.orders).toBe(orders);

    await result.current.refetch();

    // The rows are the new tick's; the icons and badges are the last complete ones.
    await waitFor(() => expect(result.current.data?.inOffice).toHaveLength(2));
    expect(getAppointments).toHaveBeenCalledTimes(2);
    expect(result.current.data?.orders).toBe(orders);
    expect(result.current.data?.vitals).toBe(vitals);
  });

  it('does not fetch without a location, provider or service category to scope the search', () => {
    const { result } = renderHook(
      () => useGetTrackingBoard({ ...filters, locationIds: [], providerIds: [], serviceCategories: [] }),
      { wrapper: createWrapper() }
    );

    expect(result.current.fetchStatus).toBe('idle');
    expect(getAppointments).not.toHaveBeenCalled();
  });

  it('does not fetch an invalid date range', () => {
    const { result } = renderHook(() => useGetTrackingBoard({ ...filters, dateFrom: '2026-09-03' }), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getAppointments).not.toHaveBeenCalled();
  });

  it('pauses while the page disables it (a comment is being edited)', () => {
    const { result } = renderHook(() => useGetTrackingBoard(filters, { enabled: false }), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe('idle');
    expect(getAppointments).not.toHaveBeenCalled();
  });
});
