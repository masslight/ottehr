import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { Encounter, Patient } from 'fhir/r4b';
import { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncERXPatient } from '../../src/features/visits/shared/stores/appointment/appointment.queries';

const mockSyncPatient = vi.fn<(...args: any[]) => Promise<any>>();
const mockZambdaExecute = vi.fn<(...args: any[]) => Promise<any>>();

const oystehrMock = {
  erx: { syncPatient: (...args: any[]) => mockSyncPatient(...args) },
} as any;

const oystehrZambdaMock = {
  zambda: { execute: (...args: any[]) => mockZambdaExecute(...args) },
} as any;

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: oystehrMock,
    oystehrZambda: oystehrZambdaMock,
  }),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: oystehrMock,
    oystehrZambda: oystehrZambdaMock,
  }),
}));

vi.mock('@auth0/auth0-react', () => ({
  useAuth0: () => ({ getAccessTokenSilently: vi.fn().mockResolvedValue('token') }),
}));

const PATIENT: Patient = {
  resourceType: 'Patient',
  id: 'patient-1',
};

const makeEncounter = (overrides: Partial<Encounter> = {}): Encounter => ({
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'in-progress',
  class: {
    system: 'system',
    code: 'ACUTE',
  },
  meta: {
    versionId: 'v1',
  },
  ...overrides,
});

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const renderSync = (encounter: Encounter): ReturnType<typeof renderHook> =>
  renderHook(
    () =>
      useSyncERXPatient({
        patient: PATIENT,
        encounter,
        enabled: true,
        onError: vi.fn(),
      }),
    { wrapper }
  );

describe('useSyncERXPatient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls the tag zambda after a successful sync', async () => {
    mockSyncPatient.mockResolvedValue(undefined);
    mockZambdaExecute.mockResolvedValue({});

    const { result } = renderSync(makeEncounter());

    await waitFor(() => expect((result.current as any).isFetched).toBe(true));

    expect(mockSyncPatient).toHaveBeenCalledWith({
      patientId: 'patient-1',
      encounterId: 'enc-1',
    });
    expect(mockZambdaExecute).toHaveBeenCalledTimes(1);
    expect(mockZambdaExecute).toHaveBeenCalledWith({
      id: 'tag-encounter-erx-synced',
      encounterId: 'enc-1',
    });
  });

  it('still succeeds when tagging fails', async () => {
    mockSyncPatient.mockResolvedValue(undefined);
    mockZambdaExecute.mockRejectedValue(new Error('zambda failed'));

    const { result } = renderSync(makeEncounter());

    await waitFor(() => expect((result.current as any).isFetched).toBe(true));

    expect((result.current as any).data).toBe(true);
    expect((result.current as any).isError).toBe(false);
  });
});
