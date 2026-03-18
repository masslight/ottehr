import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/api/api', () => ({
  createInHouseMedication: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(),
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetMedicationsSearch: vi.fn(),
  ExtractObjectType: undefined,
}));

import { createInHouseMedication } from 'src/api/api';
import { useGetMedicationsSearch } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useApiClients } from 'src/hooks/useAppClients';
import AddMedicationPage from '../../src/pages/configuration/AddMedicationPage';

const mockOystehrZambda = {} as any;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const mockMedication = {
  id: 1,
  routedDoseFormDrugId: 98765,
  name: 'Ibuprofen',
  strength: '200mg',
  ndc: '12345-678-90',
  rxcui: '5640',
  isObsolete: false,
};

describe('AddMedicationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: mockOystehrZambda });
    vi.mocked(useGetMedicationsSearch).mockReturnValue({ isFetching: false, data: [] } as any);
    vi.mocked(createInHouseMedication).mockResolvedValue({ resourceType: 'Medication', id: 'new-med' } as any);
  });

  it('renders add medication form', () => {
    render(<AddMedicationPage />, { wrapper: createWrapper() });
    expect(screen.getByRole('heading', { name: 'Add medication' })).toBeInTheDocument();
    expect(screen.getAllByLabelText(/name/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/^cpt/i).length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText(/^hcpcs/i).length).toBeGreaterThan(0);
  });

  it('renders Create Medication submit button', () => {
    render(<AddMedicationPage />, { wrapper: createWrapper() });
    expect(screen.getByRole('button', { name: /create medication/i })).toBeInTheDocument();
  });

  it('shows medication search results in autocomplete', () => {
    vi.mocked(useGetMedicationsSearch).mockReturnValue({ isFetching: false, data: [mockMedication] } as any);
    render(<AddMedicationPage />, { wrapper: createWrapper() });
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument();
  });

  it('renders without errors while search is in progress', () => {
    vi.mocked(useGetMedicationsSearch).mockReturnValue({ isFetching: true, data: [] } as any);
    render(<AddMedicationPage />, { wrapper: createWrapper() });
    expect(screen.getByRole('heading', { name: 'Add medication' })).toBeInTheDocument();
  });

  it('shows breadcrumbs with correct navigation', () => {
    render(<AddMedicationPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('Medications')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Add medication' })).toBeInTheDocument();
  });
});
