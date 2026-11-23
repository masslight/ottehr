import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Medication } from 'fhir/r4b';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_MEDICATION_TYPE_CODE,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { RoleType } from 'utils/lib/types/api/user.types';
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
import { AdminHeaderSlotProvider } from 'src/features/admin/AdminPageHeader';
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

const makeCatalogMed = (id: string, name: string): Medication => ({
  ...makeMed(id, name, 'active'),
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name },
  ],
});

const makeVaccine = (id: string, name: string, cvx: string, status: Medication['status'] = 'active'): Medication => ({
  ...makeMed(id, name, status),
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name },
  ],
  code: { coding: [{ system: CVX_CODE_SYSTEM_URL, code: cvx }] },
});

const adminUser = {
  hasRole: (roles: RoleType[]) => roles.includes(RoleType.Administrator),
} as any;

const nonAdminUser = {
  hasRole: () => false,
} as any;

const selectType = (label: 'All types' | 'Medications' | 'Vaccines'): void => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Type' }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: label }));
};

const dataRowCells = (): string[][] => {
  const table = screen.getByRole('table', { name: 'medicationsTable' });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) =>
      within(row)
        .getAllByRole('cell')
        .slice(0, 3)
        .map((cell) => cell.textContent ?? '')
    );
};

const selectStatus = (label: 'All statuses' | 'Active' | 'Inactive'): void => {
  fireEvent.mouseDown(screen.getByRole('combobox', { name: 'Status' }));
  fireEvent.click(within(screen.getByRole('listbox')).getByRole('option', { name: label }));
};

const dataRowNames = (): string[] => {
  const table = screen.getByRole('table', { name: 'medicationsTable' });
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getByRole('link').textContent ?? '');
};

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
    selectStatus('All statuses');

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
    selectStatus('All statuses');
    const table = screen.getByRole('table', { name: 'medicationsTable' });
    expect(within(table).getByText('Active')).toBeInTheDocument();
    expect(within(table).getByText('Inactive')).toBeInTheDocument();
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

    await waitFor(() => expect(getInHouseMedications).toHaveBeenCalled());
    selectStatus('Inactive');
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

  it('filters medications by status, showing only active ones by default', async () => {
    vi.mocked(getInHouseMedications).mockResolvedValue([
      makeMed('1', 'Zoloft', 'inactive'),
      makeMed('2', 'Acetaminophen', 'active'),
      makeMed('3', 'Ibuprofen', undefined),
      makeMed('4', 'Aspirin', 'inactive'),
    ]);

    render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Acetaminophen')).toBeInTheDocument());
    expect(dataRowNames()).toEqual(['Acetaminophen', 'Ibuprofen']);

    selectStatus('Inactive');
    expect(dataRowNames()).toEqual(['Aspirin', 'Zoloft']);

    selectStatus('All statuses');
    expect(dataRowNames()).toEqual(['Acetaminophen', 'Ibuprofen', 'Aspirin', 'Zoloft']);

    fireEvent.change(screen.getByLabelText('Search by name'), { target: { value: 'z' } });
    selectStatus('Active');
    expect(screen.queryByText('Zoloft')).not.toBeInTheDocument();
    selectStatus('Inactive');
    expect(dataRowNames()).toEqual(['Zoloft']);
  });

  it('moves back a page when deactivating the only medication on the last page of the active view', async () => {
    const meds = Array.from({ length: 11 }, (_, i) => makeMed(`m${i}`, `Med ${String(i).padStart(2, '0')}`, 'active'));
    vi.mocked(getInHouseMedications)
      .mockResolvedValueOnce(meds)
      .mockResolvedValueOnce([...meds.slice(0, 10), makeMed('m10', 'Med 10', 'inactive')]);
    vi.mocked(updateInHouseMedication).mockResolvedValue({} as any);

    render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByText('Med 00')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(dataRowNames()).toEqual(['Med 10']);

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => expect(dataRowNames()).toHaveLength(10));
    expect(screen.queryByText('Med 10')).not.toBeInTheDocument();
  });

  describe('vaccines in the catalog', () => {
    const catalog = [
      makeCatalogMed('1', 'Ibuprofen 200mg'),
      makeVaccine('2', 'MMR', '03'),
      makeVaccine('3', 'DTaP-Hep B-IPV', '110', 'inactive'),
    ];

    it('says in the Type column which entries are vaccines', async () => {
      vi.mocked(getInHouseMedications).mockResolvedValue(catalog);

      render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

      await waitFor(() => expect(screen.getByText('MMR')).toBeInTheDocument());
      expect(
        within(screen.getByRole('table', { name: 'medicationsTable' }))
          .getAllByRole('columnheader')
          .map((header) => header.textContent)
      ).toEqual(['Name', 'Type', 'Status', 'Actions']);
      selectStatus('All statuses');
      expect(dataRowCells()).toEqual([
        ['Ibuprofen 200mg', 'Medication', 'Active'],
        ['MMR', 'Vaccine', 'Active'],
        ['DTaP-Hep B-IPV', 'Vaccine', 'Inactive'],
      ]);
    });

    it('lists both types until one is picked in the Type filter', async () => {
      vi.mocked(getInHouseMedications).mockResolvedValue(catalog);

      render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

      await waitFor(() => expect(screen.getByText('MMR')).toBeInTheDocument());
      selectStatus('All statuses');
      expect(dataRowNames()).toEqual(['Ibuprofen 200mg', 'MMR', 'DTaP-Hep B-IPV']);

      selectType('Vaccines');
      expect(dataRowNames()).toEqual(['MMR', 'DTaP-Hep B-IPV']);

      selectType('Medications');
      expect(dataRowNames()).toEqual(['Ibuprofen 200mg']);

      selectType('All types');
      expect(dataRowNames()).toEqual(['Ibuprofen 200mg', 'MMR', 'DTaP-Hep B-IPV']);
    });

    it('deactivates and activates a vaccine as it does a medication, and says vaccine', async () => {
      vi.mocked(getInHouseMedications).mockResolvedValue([makeVaccine('vaccine-1', 'MMR', '03')]);
      vi.mocked(updateInHouseMedication).mockResolvedValue({} as any);

      render(<MedicationsConfigurationPage />, { wrapper: createWrapper() });

      await waitFor(() => expect(screen.getByText('MMR')).toBeInTheDocument());
      fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));

      await waitFor(() => {
        expect(updateInHouseMedication).toHaveBeenCalledWith(mockOystehrZambda, {
          medicationID: 'vaccine-1',
          status: 'inactive',
        });
      });
      expect(enqueueSnackbar).toHaveBeenCalledWith('Vaccine deactivated', { variant: 'success' });
    });

    it.each([
      ['an administrator', adminUser, true],
      ['anyone else', nonAdminUser, false],
    ])('offers "Add medication or vaccine" to %s', async (_label, user, enabled) => {
      vi.mocked(useEvolveUser).mockReturnValue(user);
      vi.mocked(getInHouseMedications).mockResolvedValue(catalog);
      const header = document.createElement('div');
      document.body.appendChild(header);

      render(
        <AdminHeaderSlotProvider value={header}>
          <MedicationsConfigurationPage />
        </AdminHeaderSlotProvider>,
        { wrapper: createWrapper() }
      );

      const button = await within(header).findByRole('button', { name: 'Add medication or vaccine' });
      if (enabled) {
        expect(button).toBeEnabled();
        expect(button.closest('a')).toHaveAttribute('href', '/admin/medications/add');
      } else {
        expect(button).toBeDisabled();
      }
      header.remove();
    });
  });
});
