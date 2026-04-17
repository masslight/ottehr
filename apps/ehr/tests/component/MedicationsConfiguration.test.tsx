import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Medication } from 'fhir/r4b';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { MEDICATION_IDENTIFIER_NAME_SYSTEM, RoleType } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('src/api/api', () => ({
  getInHouseMedications: vi.fn(),
  updateInHouseMedication: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(),
}));

vi.mock('src/hooks/useEvolveUser', () => ({
  default: vi.fn(),
}));

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
}));

import { enqueueSnackbar } from 'notistack';
import { getInHouseMedications, updateInHouseMedication } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import useEvolveUser from 'src/hooks/useEvolveUser';
import MedicationsConfigurationPage from '../../src/pages/configuration/MedicationsConfiguration';

const mockOystehrZambda = {} as any;

const createWrapper = () => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const makeMed = (id: string, name: string, status: Medication['status']): Medication => ({
  resourceType: 'Medication',
  id,
  status,
  identifier: [{ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name }],
});

const adminUser = {
  hasRole: (roles: RoleType[]) => roles.includes(RoleType.Administrator),
} as any;

const nonAdminUser = {
  hasRole: () => false,
} as any;

describe('MedicationsConfigurationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: mockOystehrZambda } as any);
    vi.mocked(useEvolveUser).mockReturnValue(adminUser);
  });

  it('renders medications sorted with active first, then alphabetically', async () => {
    const medications = [
      makeMed('1', 'Zoloft', 'inactive'),
      makeMed('2', 'Acetaminophen', 'active'),
      makeMed('3', 'Ibuprofen', 'active'),
      makeMed('4', 'Aspirin', 'inactive'),
    ];
    vi.mocked(getInHouseMedications).mockResolvedValue(medications);

    render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Acetaminophen')).toBeInTheDocument());

    // Get all table rows (skip header row)
    const table = screen.getByRole('table', { name: 'medicationsTable' });
    const rows = within(table).getAllByRole('row');
    // First row is header, rest are data rows
    const dataRows = rows.slice(1);

    // Active first alphabetically: Acetaminophen, Ibuprofen
    // Then inactive alphabetically: Aspirin, Zoloft
    expect(within(dataRows[0]).getByText('Acetaminophen')).toBeInTheDocument();
    expect(within(dataRows[1]).getByText('Ibuprofen')).toBeInTheDocument();
    expect(within(dataRows[2]).getByText('Aspirin')).toBeInTheDocument();
    expect(within(dataRows[3]).getByText('Zoloft')).toBeInTheDocument();
  });

  it('shows Actions column for admin users', async () => {
    vi.mocked(getInHouseMedications).mockResolvedValue([makeMed('1', 'TestMed', 'active')]);

    render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('TestMed')).toBeInTheDocument());
    expect(screen.getByText('Actions')).toBeInTheDocument();
  });

  it('hides Actions column for non-admin users', async () => {
    vi.mocked(useEvolveUser).mockReturnValue(nonAdminUser);
    vi.mocked(getInHouseMedications).mockResolvedValue([makeMed('1', 'TestMed', 'active')]);

    render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('TestMed')).toBeInTheDocument());
    expect(screen.queryByText('Actions')).not.toBeInTheDocument();
  });

  it('shows active/inactive status chips', async () => {
    vi.mocked(getInHouseMedications).mockResolvedValue([
      makeMed('1', 'ActiveMed', 'active'),
      makeMed('2', 'InactiveMed', 'inactive'),
    ]);

    render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('ActiveMed')).toBeInTheDocument());
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('calls updateInHouseMedication to deactivate when clicking deactivate button on active med', async () => {
    vi.mocked(getInHouseMedications).mockResolvedValue([makeMed('med-1', 'TestMed', 'active')]);
    vi.mocked(updateInHouseMedication).mockResolvedValue({} as any);

    render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('TestMed')).toBeInTheDocument());

    // Find the deactivate button (BlockIcon tooltip says "Deactivate")
    const deactivateButton = screen.getByRole('button', { name: 'Deactivate' });
    fireEvent.click(deactivateButton);

    await waitFor(() => {
      expect(updateInHouseMedication).toHaveBeenCalledWith(mockOystehrZambda, {
        medicationID: 'med-1',
        status: 'inactive',
      });
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith('Medication deactivated', { variant: 'success' });
  });

  it('calls updateInHouseMedication to activate when clicking activate button on inactive med', async () => {
    vi.mocked(getInHouseMedications).mockResolvedValue([makeMed('med-2', 'InactiveMed', 'inactive')]);
    vi.mocked(updateInHouseMedication).mockResolvedValue({} as any);

    render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('InactiveMed')).toBeInTheDocument());

    const activateButton = screen.getByRole('button', { name: 'Activate' });
    fireEvent.click(activateButton);

    await waitFor(() => {
      expect(updateInHouseMedication).toHaveBeenCalledWith(mockOystehrZambda, {
        medicationID: 'med-2',
        status: 'active',
      });
    });

    expect(enqueueSnackbar).toHaveBeenCalledWith('Medication activated', { variant: 'success' });
  });

  it('shows error snackbar when status toggle fails', async () => {
    vi.mocked(getInHouseMedications).mockResolvedValue([makeMed('med-1', 'TestMed', 'active')]);
    vi.mocked(updateInHouseMedication).mockRejectedValue(new Error('Network error'));

    render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('TestMed')).toBeInTheDocument());

    const deactivateButton = screen.getByRole('button', { name: 'Deactivate' });
    fireEvent.click(deactivateButton);

    await waitFor(() => {
      expect(enqueueSnackbar).toHaveBeenCalledWith('Failed to update medication status', { variant: 'error' });
    });
  });

  it('filters medications by search text', async () => {
    vi.mocked(getInHouseMedications).mockResolvedValue([
      makeMed('1', 'Acetaminophen', 'active'),
      makeMed('2', 'Ibuprofen', 'active'),
    ]);

    render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Acetaminophen')).toBeInTheDocument());
    expect(screen.getByText('Ibuprofen')).toBeInTheDocument();

    const searchInput = screen.getByLabelText('Search by name');
    fireEvent.change(searchInput, { target: { value: 'acet' } });

    expect(screen.getByText('Acetaminophen')).toBeInTheDocument();
    expect(screen.queryByText('Ibuprofen')).not.toBeInTheDocument();
  });
});
