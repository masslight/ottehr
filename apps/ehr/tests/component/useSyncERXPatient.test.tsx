import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { Encounter, Patient } from 'fhir/r4b';
import { ReactNode } from 'react';
import { FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncERXPatient } from '../../src/features/visits/shared/stores/appointment/appointment.queries';

const mockSyncPatient = vi.fn<(...args: any[]) => Promise<any>>();
const mockFhirPatch = vi.fn<(...args: any[]) => Promise<any>>();
const mockFhirGet = vi.fn<(...args: any[]) => Promise<any>>();

const oystehrMock = {
  erx: { syncPatient: (...args: any[]) => mockSyncPatient(...args) },
  fhir: {
    patch: (...args: any[]) => mockFhirPatch(...args),
    get: (...args: any[]) => mockFhirGet(...args),
  },
} as any;

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: oystehrMock,
    oystehrZambda: {} as any,
  }),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: oystehrMock,
    oystehrZambda: {} as any,
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

  it('tags the encounter as eRx-synced after a successful sync', async () => {
    mockSyncPatient.mockResolvedValue(undefined);
    mockFhirPatch.mockResolvedValue(undefined);

    const { result } = renderSync(makeEncounter());

    await waitFor(() => expect((result.current as any).isFetched).toBe(true));

    expect(mockSyncPatient).toHaveBeenCalledWith({
      patientId: 'patient-1',
      encounterId: 'enc-1',
    });
    expect(mockFhirPatch).toHaveBeenCalledTimes(1);
    expect(mockFhirPatch).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'Encounter',
        id: 'enc-1',
        operations: [
          {
            op: 'add',
            path: '/meta/tag',
            value: [FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG],
          },
        ],
      }),
      { optimisticLockingVersionId: 'v1' }
    );
  });

  it('does not patch when the encounter is already tagged', async () => {
    mockSyncPatient.mockResolvedValue(undefined);
    const alreadyTagged = makeEncounter({
      meta: {
        tag: [FHIR_ENCOUNTER_ERX_PATIENT_SYNC_TAG],
      },
    });

    const { result } = renderSync(alreadyTagged);

    await waitFor(() => expect((result.current as any).isFetched).toBe(true));

    expect(mockSyncPatient).toHaveBeenCalledTimes(1);
    expect(mockFhirPatch).not.toHaveBeenCalled();
  });

  it('still succeeds when tagging fails', async () => {
    mockSyncPatient.mockResolvedValue(undefined);
    mockFhirPatch.mockRejectedValue(new Error('patch failed'));
    mockFhirGet.mockRejectedValue(new Error('get failed'));

    const { result } = renderSync(makeEncounter());

    await waitFor(() => expect((result.current as any).isFetched).toBe(true));

    expect((result.current as any).data).toBe(true);
    expect((result.current as any).isError).toBe(false);
  });
});
