import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { Encounter } from 'fhir/r4b';
import { ReactNode } from 'react';
import { getEmployees } from 'src/api/api';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useApiClients } from 'src/hooks/useAppClients';
import { EmployeeDetails } from 'utils/lib/types/api/get-employees/get-employees.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAssignedProvider } from '../../src/features/visits/shared/hooks/useAssignedProvider';

vi.mock('src/api/api', () => ({
  getEmployees: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: vi.fn(),
}));

const PRACTITIONER_ID = 'practitioner-1';

const encounterWithAssignedProvider = (practitionerId?: string): Encounter =>
  ({
    id: 'encounter-1',
    resourceType: 'Encounter',
    participant: practitionerId
      ? [
          {
            type: [{ coding: PRACTITIONER_CODINGS.Attender }],
            individual: { reference: `Practitioner/${practitionerId}` },
          },
        ]
      : undefined,
  }) as Encounter;

const employee = (overrides: Partial<EmployeeDetails>): EmployeeDetails =>
  ({
    id: 'user-1',
    profile: `Practitioner/${PRACTITIONER_ID}`,
    name: 'Sam Provider',
    email: 'sam@example.com',
    status: 'Active',
    roles: [RoleType.Provider],
    lastLogin: '',
    firstName: 'Sam',
    lastName: 'Provider',
    phoneNumber: '',
    licenses: [],
    seenPatientRecently: false,
    gettingAlerts: false,
    ...overrides,
  }) as EmployeeDetails;

const wrapper = ({ children }: { children: ReactNode }): JSX.Element => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const renderWithEmployees = async (
  employees: EmployeeDetails[]
): Promise<{ current: ReturnType<typeof useAssignedProvider> }> => {
  vi.mocked(getEmployees).mockResolvedValue({ message: 'ok', employees });
  const { result } = renderHook(() => useAssignedProvider(), { wrapper });
  await waitFor(() => expect(getEmployees).toHaveBeenCalled());
  return result;
};

describe('useAssignedProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: {} } as any);
    vi.mocked(useAppointmentData).mockReturnValue({
      encounter: encounterWithAssignedProvider(PRACTITIONER_ID),
    } as any);
  });

  it('accepts an assignment whose employee still holds the Provider role', async () => {
    const result = await renderWithEmployees([employee({})]);

    await waitFor(() => expect(result.current.isAssignedProviderEligible).toBe(true));
    expect(result.current.isAssignedProviderStale).toBe(false);
    expect(result.current.assignedProviderId).toBe(PRACTITIONER_ID);
  });

  it('rejects an assignment whose employee has lost the Provider role', async () => {
    const result = await renderWithEmployees([
      employee({ roles: [RoleType.Clinician], firstName: 'Sam', lastName: 'Clinician' }),
    ]);

    await waitFor(() => expect(result.current.isAssignedProviderStale).toBe(true));
    expect(result.current.isAssignedProviderEligible).toBe(false);
    // Surfaced so the alert can name who fell off the roster — the Provider picker renders blank.
    expect(result.current.assignedProviderName).toBe('Sam Clinician');
  });

  it('keeps a deactivated provider eligible — deactivation is a status, not a lost role', async () => {
    const result = await renderWithEmployees([employee({ status: 'Deactivated' })]);

    await waitFor(() => expect(result.current.isAssignedProviderEligible).toBe(true));
    expect(result.current.isAssignedProviderStale).toBe(false);
  });

  it('reports no eligible provider when the encounter has no attender', async () => {
    vi.mocked(useAppointmentData).mockReturnValue({
      encounter: encounterWithAssignedProvider(undefined),
    } as any);

    const result = await renderWithEmployees([employee({})]);

    await waitFor(() => expect(result.current.isAssignedProviderEligible).toBe(false));
    // Nothing is assigned, so nothing is stale — the two states get different copy.
    expect(result.current.isAssignedProviderStale).toBe(false);
    expect(result.current.assignedProviderId).toBeUndefined();
  });

  it('fails open while the employee list is unresolved, so a failed fetch cannot lock charting', () => {
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: undefined } as any);

    const { result } = renderHook(() => useAssignedProvider(), { wrapper });

    expect(result.current.isAssignedProviderEligible).toBe(true);
    expect(result.current.isAssignedProviderStale).toBe(false);
    expect(getEmployees).not.toHaveBeenCalled();
  });
});
