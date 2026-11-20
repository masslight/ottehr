import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The real note and vitals queries, against an API whose reads fail or hang.
const api = vi.hoisted(() => ({
  noteFails: false,
  vitalsFail: false,
}));
const failOrHang = (fails: boolean): Promise<never> =>
  fails ? Promise.reject(new Error('failed')) : new Promise<never>(() => undefined);

vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'appointment-1' }) }));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'user-1' }) }));
vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({
    getVisitNote: () => failOrHang(api.noteFails),
    getChartSection: () => failOrHang(api.noteFails),
  }),
}));
vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: { zambda: { execute: () => failOrHang(api.vitalsFail) } } }),
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'encounter-1' } }),
}));

import {
  useErxSendDataFailed,
  useErxSendDataLoading,
} from '../../src/features/visits/in-person/components/erx/useVisitWeight';

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

// Review D2-4: a failed load ends the wait, so Send is enabled again and the order goes without them; the screens say
// so, and still send (they're optional).
describe('eRx send data after a failed load', () => {
  beforeEach(() => {
    api.noteFails = false;
    api.vitalsFail = false;
  });

  it('a failed visit note re-enables sending', async () => {
    api.noteFails = true;
    api.vitalsFail = true;
    const { result } = renderHook(() => useErxSendDataLoading(), { wrapper });
    await waitFor(() => expect(result.current).toBe(false));
  });

  it('still waits while they load', async () => {
    const { result } = renderHook(() => useErxSendDataLoading(), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toBe(true);
  });

  it('says which couldn’t load and that they won’t be sent', async () => {
    api.noteFails = true;
    api.vitalsFail = true;
    const { result } = renderHook(() => useErxSendDataFailed(), { wrapper });
    await waitFor(() => expect(result.current).toBe("Couldn't load allergies and vitals: they won't be sent."));
    const { result: allergiesOnly } = renderHook(() => useErxSendDataFailed(undefined, { vitals: false }), {
      wrapper,
    });
    await waitFor(() => expect(allergiesOnly.current).toBe("Couldn't load allergies: they won't be sent."));
  });

  it('says nothing while they load', async () => {
    const { result } = renderHook(() => useErxSendDataFailed(), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current).toBeUndefined();
  });
});
