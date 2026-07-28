import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Medication } from 'fhir/r4b';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { MEDICATION_DISPENSABLE_DRUG_ID, MEDICATION_IDENTIFIER_NAME_SYSTEM } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: vi.fn() };
});

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('src/api/api', () => ({
  getInHouseMedications: vi.fn(),
  updateInHouseMedication: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(),
}));

const { FORBIDDEN_MESSAGE } = vi.hoisted(() => ({
  FORBIDDEN_MESSAGE: 'Your role does not have access to the medication database. Please contact an administrator.',
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetMedicationsSearch: vi.fn(),
  useGetMedicationDetails: vi.fn(),
  MEDICATION_DATABASE_FORBIDDEN_MESSAGE: FORBIDDEN_MESSAGE,
}));

import { useParams } from 'react-router-dom';
import { getInHouseMedications, updateInHouseMedication } from 'src/api/api';
import {
  useGetMedicationDetails,
  useGetMedicationsSearch,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
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
    coding: [{ system: MEDICATION_DISPENSABLE_DRUG_ID, code: '12345' }],
  },
};

const inactiveMedication: Medication = { ...activeMedication, id: 'med-xyz', status: 'inactive' };

describe('UpdateMedicationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useApiClients).mockReturnValue({ oystehrZambda: mockOystehrZambda });
    vi.mocked(useParams).mockReturnValue({ 'medication-id': 'med-abc' });
    vi.mocked(useGetMedicationsSearch).mockReturnValue({ isFetching: false, data: [] } as any);
    vi.mocked(useGetMedicationDetails).mockReturnValue({
      isFetching: false,
      data: [{ id: 12345, name: 'Ibuprofen', strength: '200mg', isObsolete: false }],
    } as any);
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
    // The medication name is populated through: getInHouseMedications resolving →
    // setMedication → render past <Loading> → MUI Autocomplete's post-mount inputValue
    // sync from `value`. On a CPU-starved CI runner that chain can exceed waitFor's
    // 1s default, so give it generous headroom (the assertion still returns as soon
    // as the value appears).
    await waitFor(
      () => expect(screen.getByRole('combobox', { name: 'Medication Name' })).toHaveValue('Ibuprofen 200mg'),
      { timeout: 10_000 }
    );
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

  // The drug details come from the eRx reference database, which not every role can read. Before, a failed
  // lookup left the page on <Loading /> forever with only a raw-message snackbar to explain it.
  it('explains a forbidden medication database lookup instead of loading forever', async () => {
    vi.mocked(useGetMedicationDetails).mockReturnValue({
      isFetching: false,
      data: undefined,
      error: Object.assign(new Error('Forbidden'), { code: 403 }),
    } as any);

    render(<UpdateMedicationPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByTestId('medication-database-alert')).toBeInTheDocument());
    expect(screen.getByTestId('medication-database-alert')).toHaveTextContent(FORBIDDEN_MESSAGE);
    expect(screen.queryByText(/refreshing/i)).not.toBeInTheDocument();
    // Submitting with no details loaded would clear the stored interactions Medispan ID.
    expect(screen.getByRole('button', { name: /^update medication$/i })).toBeDisabled();
    // The status change doesn't depend on the drug database, so it stays available.
    expect(screen.getByRole('button', { name: /remove medication/i })).toBeEnabled();
  });

  it('reports a non-permission medication database failure as transient', async () => {
    vi.mocked(useGetMedicationDetails).mockReturnValue({
      isFetching: false,
      data: undefined,
      error: Object.assign(new Error('Service Unavailable'), { code: 503 }),
    } as any);

    render(<UpdateMedicationPage />, { wrapper: createWrapper() });

    await waitFor(() => expect(screen.getByTestId('medication-database-alert')).toBeInTheDocument());
    expect(screen.getByTestId('medication-database-alert')).toHaveTextContent(/could not be reached/i);
  });

  it('submits the original medication data when typed text does not match any option', async () => {
    const user = userEvent.setup();
    vi.mocked(useGetMedicationsSearch).mockReturnValue({ isFetching: false, data: [] } as any);

    render(<UpdateMedicationPage />, { wrapper: createWrapper() });
    await waitFor(
      () => expect(screen.getByRole('combobox', { name: 'Medication Name' })).toHaveValue('Ibuprofen 200mg'),
      { timeout: 10_000 }
    );

    const nameInput = screen.getByRole('combobox', { name: 'Medication Name' });
    await user.click(nameInput);
    await user.keyboard('Totally made up name');

    await user.click(screen.getByRole('button', { name: /^update medication$/i }));

    await waitFor(() => expect(updateInHouseMedication).toHaveBeenCalled());
    const callArg = vi.mocked(updateInHouseMedication).mock.calls[0][1];
    expect(callArg.name).toBe('Ibuprofen 200mg');
    expect(callArg.name).not.toContain('Totally made up name');
    expect(callArg.medicationID).toBe('med-abc');
  });
});
