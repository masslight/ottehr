import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { Patient } from 'fhir/r4b';
import { ReactNode } from 'react';
import { useGetPatient, useUpdatePatientAccount } from 'src/hooks/useGetPatient';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PATIENT_ID = 'patient-1';

let currentPatient: Patient;
const mockFhirSearch = vi.fn(async ({ params }: { params: { name: string; value: string }[] }) => {
  const isPatientById = params.some((p) => p.name === '_id');
  const resources = isPatientById ? [currentPatient] : [];
  return { unbundle: () => resources };
});
const mockUpdatePatientAccount = vi.fn();
// Stable references: useGetPatient's effect depends on the oystehr client.
const oystehrMock = { fhir: { search: mockFhirSearch } };
const apiClientMock = { updatePatientAccount: mockUpdatePatientAccount };

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: oystehrMock }),
}));

vi.mock('src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => apiClientMock,
}));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

const makePatient = (given: string, family: string, birthDate: string): Patient => ({
  resourceType: 'Patient',
  id: PATIENT_ID,
  name: [{ given: [given], family }],
  birthDate,
});

describe('useUpdatePatientAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPatient = makePatient('Old', 'Name', '2000-01-01');
    mockUpdatePatientAccount.mockImplementation(async () => {
      currentPatient = makePatient('New', 'Surname', '1990-05-05');
    });
  });

  it('refreshes the patient returned by useGetPatient after a successful save', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }): JSX.Element => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => ({ patientData: useGetPatient(PATIENT_ID), update: useUpdatePatientAccount() }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.patientData.patient?.name?.[0]?.given?.[0]).toBe('Old'));

    await act(async () => {
      await result.current.update.mutateAsync({
        resourceType: 'QuestionnaireResponse',
        status: 'completed',
        subject: { reference: `Patient/${PATIENT_ID}` },
        item: [],
      });
    });

    await waitFor(() => expect(result.current.patientData.patient?.name?.[0]?.given?.[0]).toBe('New'));
    expect(result.current.patientData.patient?.name?.[0]?.family).toBe('Surname');
    expect(result.current.patientData.patient?.birthDate).toBe('1990-05-05');
  });
});
