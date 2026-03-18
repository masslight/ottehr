import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { Medication } from 'fhir/r4b';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { CODE_SYSTEM_CPT, CODE_SYSTEM_HCPCS, MEDICATION_IDENTIFIER_NAME_SYSTEM } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: vi.fn() };
});

vi.mock('src/api/api', () => ({
  getInHouseMedications: vi.fn(),
  updateInHouseMedication: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetMedicationsSearch: vi.fn(),
}));

import { useParams } from 'react-router-dom';
import { getInHouseMedications, updateInHouseMedication } from 'src/api/api';
import { useGetMedicationsSearch } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useApiClients } from 'src/hooks/useAppClients';
import UpdateMedicationPage from '../../src/pages/configuration/UpdateMedicationPage';

const mockOystehrZambda = {} as any;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const activeMedication: Medication = {
  resourceType: 'Medication',
  id: 'med-abc',
  status: 'active',
  identifier: [{ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Ibuprofen 200mg' }],
  code: {
    coding: [
      { system: CODE_SYSTEM_CPT, code: '99213' },
      { system: CODE_SYSTEM_HCPCS, code: 'J0696' },
    ],
  },
};

const inactiveMedication: Medication = { ...activeMedication, id: 'med-xyz', status: 'inactive' };

describe('UpdateMedicationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: mockOystehrZambda });
    vi.mocked(useParams).mockReturnValue({ 'medication-id': 'med-abc' });
    vi.mocked(useGetMedicationsSearch).mockReturnValue({ isFetching: false, data: [] } as any);
    vi.mocked(getInHouseMedications).mockResolvedValue([activeMedication]);
    vi.mocked(updateInHouseMedication).mockResolvedValue(activeMedication);
  });

  it('shows loading indicator before medication is fetched', () => {
    vi.mocked(getInHouseMedications).mockReturnValue(new Promise(() => {}));
    render(<UpdateMedicationPage />, { wrapper: createWrapper() });
    expect(screen.getByText(/refreshing/i)).toBeInTheDocument();
  });

  it('renders medication name after data loads', async () => {
    render(<UpdateMedicationPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Update medication' })).toBeInTheDocument());
    expect(screen.getByDisplayValue('Ibuprofen 200mg')).toBeInTheDocument();
  });

  it('renders loaded CPT codes as chips', async () => {
    render(<UpdateMedicationPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('99213')).toBeInTheDocument());
  });

  it('renders loaded HCPCS codes as chips', async () => {
    render(<UpdateMedicationPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByText('J0696')).toBeInTheDocument());
  });

  it('shows Remove button for active medication', async () => {
    render(<UpdateMedicationPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByRole('button', { name: /remove medication/i })).toBeInTheDocument());
  });

  it('shows Activate button for inactive medication', async () => {
    vi.mocked(getInHouseMedications).mockResolvedValue([inactiveMedication]);
    vi.mocked(useParams).mockReturnValue({ 'medication-id': 'med-xyz' });
    render(<UpdateMedicationPage />, { wrapper: createWrapper() });
    await waitFor(() => expect(screen.getByRole('button', { name: /activate medication/i })).toBeInTheDocument());
  });
});
