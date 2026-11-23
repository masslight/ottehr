import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

import { enqueueSnackbar } from 'notistack';
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
    expect(screen.queryByLabelText(/^cpt/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^hcpcs/i)).not.toBeInTheDocument();
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

  describe('adding a vaccine', () => {
    const pickVaccine = async (
      user: ReturnType<typeof userEvent.setup>,
      search: string,
      option: string
    ): Promise<void> => {
      await user.type(screen.getByRole('combobox', { name: /Vaccines/ }), search);
      await user.click(await screen.findByRole('option', { name: option }));
    };

    beforeEach(() => {
      window.history.pushState({}, '', '/admin/medications/add');
    });

    it('starts as Add medication and becomes Add vaccine when Vaccine is picked', async () => {
      const user = userEvent.setup();
      render(<AddMedicationPage />, { wrapper: createWrapper() });
      expect(screen.getByRole('button', { name: 'Medication' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.queryByRole('combobox', { name: /Vaccines/ })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Vaccine' }));

      expect(screen.getByRole('heading', { name: 'Add vaccine' })).toBeInTheDocument();
      expect(screen.getAllByText('Add vaccine')).toHaveLength(2); // the heading and the breadcrumb
      expect(screen.getByRole('combobox', { name: /Vaccines/ })).toBeInTheDocument();
      expect(screen.queryByLabelText(/Medication Name/)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Add Vaccine' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /create medication/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Medication' }));
      expect(screen.getByRole('heading', { name: 'Add medication' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Medication' })).toBeInTheDocument();
    });

    it('adds a vaccine picked from the CVX list by its CVX code and opens its page', async () => {
      const user = userEvent.setup();
      render(<AddMedicationPage />, { wrapper: createWrapper() });
      await user.click(screen.getByRole('button', { name: 'Vaccine' }));
      await pickVaccine(user, 'DTaP-Hep', 'DTaP-Hep B-IPV (CVX 110)');

      await user.click(screen.getByRole('button', { name: 'Add Vaccine' }));

      await waitFor(() => expect(createInHouseMedication).toHaveBeenCalledTimes(1));
      expect(createInHouseMedication).toHaveBeenCalledWith(mockOystehrZambda, { vaccine: { cvx: '110' } });
      await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith('Vaccine added', { variant: 'success' }));
      expect(window.location.pathname).toBe('/admin/medication/new-med');
    });

    it('adds several vaccines in one go, one request each, and returns to the catalog', async () => {
      const user = userEvent.setup();
      render(<AddMedicationPage />, { wrapper: createWrapper() });
      await user.click(screen.getByRole('button', { name: 'Vaccine' }));
      await pickVaccine(user, 'DTaP-Hep', 'DTaP-Hep B-IPV (CVX 110)');
      await pickVaccine(user, 'MMR', 'MMR (CVX 03)');

      await user.click(screen.getByRole('button', { name: 'Add 2 Vaccines' }));

      await waitFor(() => expect(createInHouseMedication).toHaveBeenCalledTimes(2));
      expect(vi.mocked(createInHouseMedication).mock.calls.map(([, parameters]) => parameters)).toEqual([
        { vaccine: { cvx: '110' } },
        { vaccine: { cvx: '03' } },
      ]);
      await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith('2 vaccines added', { variant: 'success' }));
      expect(window.location.pathname).toBe('/admin/medications');
    });

    it('adds nothing until a vaccine is picked', async () => {
      const user = userEvent.setup();
      render(<AddMedicationPage />, { wrapper: createWrapper() });
      await user.click(screen.getByRole('button', { name: 'Vaccine' }));

      await user.click(screen.getByRole('button', { name: 'Add Vaccine' }));

      expect(createInHouseMedication).not.toHaveBeenCalled();
      expect(window.location.pathname).toBe('/admin/medications/add');
    });

    it('stays on the page and says how many were added, and why it stopped, when one fails', async () => {
      vi.mocked(createInHouseMedication)
        .mockResolvedValueOnce({ resourceType: 'Medication', id: 'first' } as any)
        .mockRejectedValueOnce({ message: 'You are not authorized to perform this action' });
      const user = userEvent.setup();
      render(<AddMedicationPage />, { wrapper: createWrapper() });
      await user.click(screen.getByRole('button', { name: 'Vaccine' }));
      await pickVaccine(user, 'DTaP-Hep', 'DTaP-Hep B-IPV (CVX 110)');
      await pickVaccine(user, 'MMR', 'MMR (CVX 03)');

      await user.click(screen.getByRole('button', { name: 'Add 2 Vaccines' }));

      await waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith(
          '1 vaccine added before this error: You are not authorized to perform this action',
          { variant: 'error' }
        )
      );
      expect(window.location.pathname).toBe('/admin/medications/add');
    });

    it('says the vaccine was not added when the first request fails without a reason', async () => {
      vi.mocked(createInHouseMedication).mockRejectedValueOnce({});
      const user = userEvent.setup();
      render(<AddMedicationPage />, { wrapper: createWrapper() });
      await user.click(screen.getByRole('button', { name: 'Vaccine' }));
      await pickVaccine(user, 'MMR', 'MMR (CVX 03)');

      await user.click(screen.getByRole('button', { name: 'Add Vaccine' }));

      await waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith('Failed to add the vaccine', { variant: 'error' })
      );
      expect(window.location.pathname).toBe('/admin/medications/add');
    });
  });
});
