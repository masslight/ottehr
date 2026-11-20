import Oystehr from '@oystehr/sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Medication } from 'fhir/r4b';
import { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { makeMedicationInventoryExtension } from 'utils/lib/fhir/medication-inventory';
import {
  GetMedicationInventoryResponse,
  MEDICATION_COUNTED_AS_LABELS,
  MEDICATION_COUNTED_AS_OPTIONS,
  VACCINE_DEFAULT_INVENTORY,
} from 'utils/lib/types/api/config/in-house-medications';
import {
  CVX_CODE_SYSTEM_URL,
  INVENTORY_VACCINE_TYPE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { APIErrorCode } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useParams: vi.fn() };
});

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('src/api/api', () => ({
  getInHouseMedications: vi.fn(),
  getMedicationInventory: vi.fn(),
  lookupNdc: vi.fn(),
  receiveMedicationShipment: vi.fn(),
  updateInHouseMedication: vi.fn(),
}));

vi.mock('src/features/notifications/notifications.queries', () => ({
  useGetAllLocations: vi.fn(),
}));

vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: vi.fn(),
}));

vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({ hasRole: () => true }),
}));

const { FORBIDDEN_MESSAGE } = vi.hoisted(() => ({
  FORBIDDEN_MESSAGE: 'Your role does not have access to the medication database. Please contact an administrator.',
}));

vi.mock('src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetMedicationsSearch: vi.fn(),
  useGetMedicationDetails: vi.fn(),
  MEDICATION_DATABASE_FORBIDDEN_MESSAGE: FORBIDDEN_MESSAGE,
}));

import { enqueueSnackbar } from 'notistack';
import { useParams } from 'react-router-dom';
import {
  getInHouseMedications,
  getMedicationInventory,
  lookupNdc,
  receiveMedicationShipment,
  updateInHouseMedication,
} from 'src/api/api';
import { dataTestIds } from 'src/constants/data-test-ids';
import { recordedInventoryQueryKey, useHasRecordedInventory } from 'src/features/admin/inventory/inventory.queries';
import { useGetAllLocations } from 'src/features/notifications/notifications.queries';
import {
  useGetMedicationDetails,
  useGetMedicationsSearch,
} from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useApiClients } from 'src/hooks/useAppClients';
import UpdateMedicationPage from '../../src/pages/configuration/UpdateMedicationPage';

const mockOystehrZambda = {} as any;

const createWrapper = (
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
) => {
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

const mainStreet = { id: 'loc-main', name: 'Main Street' };

const locationsQuery = (status: 'pending' | 'error' | 'success', data?: (typeof mainStreet)[]): any => ({
  status,
  data,
  isPending: status === 'pending',
  isError: status === 'error',
  isSuccess: status === 'success',
});

const trackedMedication: Medication = {
  ...activeMedication,
  extension: [
    makeMedicationInventoryExtension({
      countedAs: 'vial',
      eachContains: { amount: 4, unit: 'mg' },
      use: 'single-use',
      reorderLevels: [
        { locationId: 'loc-closed', level: 5 },
        { locationId: mainStreet.id, level: 10 },
      ],
    }),
  ],
};

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
    vi.mocked(getMedicationInventory).mockResolvedValue({});
    vi.mocked(useGetAllLocations).mockReturnValue(locationsQuery('success', []));
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

  describe('Update Medication button', () => {
    it.each([
      ['is loading', 'pending'],
      ['has failed', 'error'],
    ] as const)('is disabled while the locations request %s', async (_state, status) => {
      vi.mocked(useGetAllLocations).mockReturnValue(locationsQuery(status));
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });

      expect(await screen.findByRole('button', { name: /^update medication$/i }, { timeout: 10_000 })).toBeDisabled();
    });

    it('is enabled once locations have loaded, even when there are none', async () => {
      vi.mocked(useGetAllLocations).mockReturnValue(locationsQuery('success', []));
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });

      expect(await screen.findByRole('button', { name: /^update medication$/i }, { timeout: 10_000 })).toBeEnabled();
    });
  });

  describe('reorder levels', () => {
    const submittedReorderLevels = async (): Promise<unknown> => {
      await userEvent.click(screen.getByRole('button', { name: /^update medication$/i }));
      await waitFor(() => expect(updateInHouseMedication).toHaveBeenCalledTimes(1));
      return vi.mocked(updateInHouseMedication).mock.calls[0][1].inventory?.reorderLevels;
    };

    beforeEach(() => {
      vi.mocked(getInHouseMedications).mockResolvedValue([trackedMedication]);
      vi.mocked(updateInHouseMedication).mockResolvedValue(trackedMedication);
    });

    it('keeps the level of a clinic missing from the locations list', async () => {
      vi.mocked(useGetAllLocations).mockReturnValue(locationsQuery('success', [mainStreet]));
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });
      await waitFor(() => expect(screen.getByLabelText('Main Street')).toHaveValue(10), { timeout: 10_000 });

      expect(await submittedReorderLevels()).toEqual([
        { locationId: 'loc-closed', level: 5 },
        { locationId: mainStreet.id, level: 10 },
      ]);
    });

    it('removes only the level of the clinic whose field was cleared', async () => {
      vi.mocked(useGetAllLocations).mockReturnValue(locationsQuery('success', [mainStreet]));
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });
      await waitFor(() => expect(screen.getByLabelText('Main Street')).toHaveValue(10), { timeout: 10_000 });
      await userEvent.clear(screen.getByLabelText('Main Street'));

      expect(await submittedReorderLevels()).toEqual([{ locationId: 'loc-closed', level: 5 }]);
    });
  });

  describe('Counting Unit', () => {
    const LOCKED_HELP = "Can't be changed after inventory has been recorded";
    const CHECKING_HELP = 'Checking whether inventory has been recorded…';
    const CHECK_FAILED_HELP = "Couldn't check whether inventory has been recorded. Reload to change the unit.";
    const ALL_UNITS = MEDICATION_COUNTED_AS_OPTIONS.map((option) => MEDICATION_COUNTED_AS_LABELS[option].singular);

    const findCountingUnit = (): Promise<HTMLElement> =>
      screen.findByRole('combobox', { name: /^Counting Unit/ }, { timeout: 10_000 });

    const selectableOptions = (): string[] =>
      screen
        .getAllByRole('option')
        .filter((option) => option.getAttribute('aria-disabled') !== 'true')
        .map((option) => option.textContent ?? '');

    const expectCountingUnitHelp = (help: string): Promise<void> =>
      waitFor(
        () => {
          expect(screen.getByRole('combobox', { name: /^Counting Unit/ })).toHaveAccessibleDescription(help);
        },
        { timeout: 10_000 }
      );

    const RECORDED_LOT: GetMedicationInventoryResponse = {
      lastReceivedLot: { id: 'lot-1', locationId: mainStreet.id, lotNumber: 'A1' },
    };

    const reconnect = (): void =>
      act(() => {
        window.dispatchEvent(new Event('offline'));
        window.dispatchEvent(new Event('online'));
      });

    beforeEach(() => {
      vi.mocked(getInHouseMedications).mockResolvedValue([trackedMedication]);
    });

    it('allows only the saved unit or Not tracked once inventory has been recorded', async () => {
      vi.mocked(getMedicationInventory).mockResolvedValue(RECORDED_LOT);
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });

      await expectCountingUnitHelp(LOCKED_HELP);
      await userEvent.click(await findCountingUnit());
      expect(selectableOptions()).toEqual(['Not tracked', 'Vial']);
    });

    it('allows every unit once the server confirms no inventory has been recorded, until a later check fails', async () => {
      const user = userEvent.setup();
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });

      await user.click(await findCountingUnit());
      await waitFor(() => expect(selectableOptions()).toEqual(['Not tracked', ...ALL_UNITS]));
      expect(screen.queryByText(LOCKED_HELP)).not.toBeInTheDocument();
      expect(screen.queryByText(CHECKING_HELP)).not.toBeInTheDocument();
      await user.click(screen.getByRole('option', { name: 'Bottle' }));

      vi.mocked(getMedicationInventory).mockRejectedValue(new Error('Network error'));
      reconnect();

      await expectCountingUnitHelp(CHECK_FAILED_HELP);
      expect(await findCountingUnit()).toHaveTextContent('Bottle');
      await user.click(await findCountingUnit());
      expect(selectableOptions()).toEqual(['Not tracked', 'Vial']);

      await user.keyboard('{Escape}');
      await user.click(screen.getByRole('button', { name: /^update medication$/i }));
      await waitFor(() =>
        expect(enqueueSnackbar).toHaveBeenCalledWith(
          "The Counting Unit can't be changed until it's confirmed that no inventory has been recorded. Reload to try again.",
          { variant: 'error' }
        )
      );
      expect(updateInHouseMedication).not.toHaveBeenCalled();

      await user.click(await findCountingUnit());
      await user.click(screen.getByRole('option', { name: 'Not tracked' }));
      await user.click(screen.getByRole('button', { name: /^update medication$/i }));
      await waitFor(() => expect(updateInHouseMedication).toHaveBeenCalledTimes(1));
      expect(vi.mocked(updateInHouseMedication).mock.calls[0][1].inventory).toBeNull();
    });

    it('puts the saved unit back when a later check finds inventory', async () => {
      const user = userEvent.setup();
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });
      await user.click(await findCountingUnit());
      await waitFor(() => expect(selectableOptions()).toEqual(['Not tracked', ...ALL_UNITS]));
      await user.click(screen.getByRole('option', { name: 'Bottle' }));

      vi.mocked(getMedicationInventory).mockResolvedValue(RECORDED_LOT);
      reconnect();

      await expectCountingUnitHelp(LOCKED_HELP);
      expect(await findCountingUnit()).toHaveTextContent('Vial');
    });

    it('keeps other units unavailable on a return visit until the check has been repeated', async () => {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      queryClient.setQueryData(recordedInventoryQueryKey('med-abc'), false);
      vi.mocked(getMedicationInventory).mockReturnValue(new Promise(() => {}));
      render(<UpdateMedicationPage />, { wrapper: createWrapper(queryClient) });

      await expectCountingUnitHelp(CHECKING_HELP);
      await userEvent.click(await findCountingUnit());
      expect(selectableOptions()).toEqual(['Not tracked', 'Vial']);
    });

    it('treats recorded inventory as permanent when a stale check reports none', async () => {
      let answerCheck: (response: GetMedicationInventoryResponse) => void = () => {};
      vi.mocked(getMedicationInventory).mockReturnValue(new Promise((resolve) => (answerCheck = resolve)));
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      const { result } = renderHook(() => useHasRecordedInventory('med-abc', true), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        ),
      });
      await waitFor(() => expect(result.current.isFetching).toBe(true));

      act(() => {
        queryClient.setQueryData(recordedInventoryQueryKey('med-abc'), true);
      });
      answerCheck({});
      await waitFor(() => expect(result.current.isFetching).toBe(false));
      expect(result.current.data).toBe(true);

      vi.mocked(getMedicationInventory).mockResolvedValue({});
      await act(async () => {
        await result.current.refetch();
      });
      expect(result.current.data).toBe(true);
    });

    it.each([
      ['in progress', () => new Promise<never>(() => {}), CHECKING_HELP],
      ['failed', () => Promise.reject(new Error('Network error')), CHECK_FAILED_HELP],
    ])('keeps other units unavailable while the inventory check is %s', async (_state, response, help) => {
      vi.mocked(getMedicationInventory).mockImplementation(response);
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });

      await expectCountingUnitHelp(help);
      await userEvent.click(await findCountingUnit());
      expect(selectableOptions()).toEqual(['Not tracked', 'Vial']);
    });

    it('locks other units and restores the saved setup as soon as the first shipment is received on the page', async () => {
      vi.mocked(useGetAllLocations).mockReturnValue(locationsQuery('success', [mainStreet]));
      vi.mocked(lookupNdc).mockResolvedValue({ status: 'unavailable' });
      vi.mocked(receiveMedicationShipment).mockResolvedValue({} as never);
      vi.mocked(useGetMedicationDetails).mockReturnValue({
        isFetching: false,
        data: { id: 12345, name: 'Ibuprofen', isObsolete: true },
      } as any);
      vi.mocked(useGetMedicationsSearch).mockReturnValue({
        isFetching: false,
        data: [{ id: 67890, name: 'Ibuprofen 200mg tablet', isObsolete: false }],
      } as any);
      const user = userEvent.setup();
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });
      await findCountingUnit();
      await waitFor(() => expect(screen.queryByText(CHECKING_HELP)).not.toBeInTheDocument());
      expect(screen.queryByText(LOCKED_HELP)).not.toBeInTheDocument();
      await user.click(await findCountingUnit());
      await user.click(screen.getByRole('option', { name: 'Bottle' }));
      await user.clear(screen.getByLabelText(/^Each Contains/));
      await user.type(screen.getByLabelText(/^Each Contains/), '100');
      await user.clear(screen.getByLabelText('Main Street'));
      await user.type(screen.getByLabelText('Main Street'), '3');
      await user.click(screen.getByRole('combobox', { name: /^Medication Name for Interactions/ }));
      await user.click(screen.getByRole('option', { name: 'Ibuprofen 200mg tablet' }));

      await user.click(screen.getByTestId(dataTestIds.updateMedicationPage.receiveShipmentButton));
      await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.ndcField), '72572-0160-25');
      await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.lotNumberField), 'A123');
      await user.click(screen.getByLabelText(/Expiration Date/));
      await user.keyboard('01012028');
      await user.type(screen.getByTestId(dataTestIds.receiveShipmentDialog.quantityField), '10');
      await screen.findByText(/lookup unavailable/);
      await user.click(screen.getByTestId(dataTestIds.receiveShipmentDialog.receiveButton));

      expect(await screen.findByText(LOCKED_HELP)).toBeInTheDocument();
      expect(await findCountingUnit()).toHaveTextContent('Vial');
      await user.click(await findCountingUnit());
      expect(selectableOptions()).toEqual(['Not tracked', 'Vial']);

      await user.keyboard('{Escape}');
      await user.click(screen.getByRole('button', { name: /^update medication$/i }));
      await waitFor(() => expect(updateInHouseMedication).toHaveBeenCalledTimes(1));
      const submitted = vi.mocked(updateInHouseMedication).mock.calls[0][1];
      expect(submitted.inventory).toEqual({
        countedAs: 'vial',
        eachContains: { amount: 4, unit: 'mg' },
        use: 'single-use',
        reorderLevels: [
          { locationId: 'loc-closed', level: 5 },
          { locationId: mainStreet.id, level: 10 },
        ],
      });
      expect(submitted.medispanIDForInteractions).toBe('67890');
    });
  });

  describe('update failure toast', () => {
    const REASON = "The Counting Unit can't be changed after inventory has been recorded for this medication.";

    it.each([
      [
        "the server's reason for a rejected update",
        new Oystehr.OystehrSdkError({ message: REASON, code: APIErrorCode.INVALID_INPUT }),
        REASON,
      ],
      [
        'the generic message when the server sends no message',
        new Oystehr.OystehrSdkError({
          message: { status: 500, output: { error: 'Internal error' } } as unknown as string,
          code: 500,
        }),
        'Failed to update medication',
      ],
    ])('shows %s', async (_case, error, toast) => {
      vi.mocked(updateInHouseMedication).mockRejectedValue(error);
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });

      await userEvent.click(await screen.findByRole('button', { name: /^update medication$/i }, { timeout: 10_000 }));

      await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(toast, { variant: 'error' }));
    });
  });

  describe('a vaccine', () => {
    const vaccine: Medication = {
      resourceType: 'Medication',
      id: 'vaccine-1',
      status: 'active',
      identifier: [
        { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_VACCINE_TYPE_CODE },
        { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'DTaP-Hep B-IPV' },
      ],
      code: {
        coding: [{ system: CVX_CODE_SYSTEM_URL, code: '110', display: 'DTaP-hepatitis B and poliovirus vaccine' }],
      },
      extension: [makeMedicationInventoryExtension(VACCINE_DEFAULT_INVENTORY)],
    };
    const MEDICATION_UNITS = MEDICATION_COUNTED_AS_OPTIONS.map(
      (option) => MEDICATION_COUNTED_AS_LABELS[option].singular
    );

    const findCountingUnit = (): Promise<HTMLElement> =>
      screen.findByRole('combobox', { name: /^Counting Unit/ }, { timeout: 10_000 });

    beforeEach(() => {
      vi.mocked(useParams).mockReturnValue({ 'medication-id': 'vaccine-1' });
      vi.mocked(getInHouseMedications).mockResolvedValue([vaccine]);
      vi.mocked(updateInHouseMedication).mockResolvedValue(vaccine);
      // A vaccine has no drug database entry, so there are never drug details for it.
      vi.mocked(useGetMedicationDetails).mockReturnValue({ isFetching: false, data: undefined } as any);
    });

    it('is the Update vaccine page, with the CVX name and code read-only and no drug database notice', async () => {
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });

      expect(await screen.findByRole('heading', { name: 'Update vaccine' }, { timeout: 10_000 })).toBeInTheDocument();
      expect(screen.getByRole('textbox', { name: 'Vaccine' })).toHaveValue('DTaP-Hep B-IPV');
      expect(screen.getByRole('textbox', { name: 'Vaccine' })).toBeDisabled();
      expect(screen.getByText('CVX 110 · from the CDC CVX list')).toBeInTheDocument();
      expect(screen.queryByRole('combobox', { name: 'Medication Name' })).not.toBeInTheDocument();
      expect(screen.queryByTestId(dataTestIds.updateMedicationPage.medicationDatabaseAlert)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Update Vaccine' })).toBeEnabled();
      expect(screen.getByText("Add a lot of this vaccine to a location's stock.")).toBeInTheDocument();
    });

    it('does not wait for the drug database', async () => {
      vi.mocked(useGetMedicationDetails).mockReturnValue({ isFetching: true, data: undefined } as any);
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });

      expect(await screen.findByRole('heading', { name: 'Update vaccine' }, { timeout: 10_000 })).toBeInTheDocument();
    });

    it('is counted in doses, a unit offered for a vaccine and not for a medication', async () => {
      const user = userEvent.setup();
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });

      expect(await findCountingUnit()).toHaveTextContent('Dose');
      await user.click(await findCountingUnit());
      await waitFor(() =>
        expect(
          screen
            .getAllByRole('option')
            .filter((option) => option.getAttribute('aria-disabled') !== 'true')
            .map((option) => option.textContent)
        ).toEqual(['Not tracked', 'Dose', ...MEDICATION_UNITS])
      );
      expect(MEDICATION_UNITS).not.toContain('Dose');
    });

    it('saves the inventory setup under the vaccine name, with no drug codes', async () => {
      vi.mocked(useGetAllLocations).mockReturnValue(locationsQuery('success', [mainStreet]));
      const user = userEvent.setup();
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });
      await user.type(await screen.findByLabelText('Main Street', undefined, { timeout: 10_000 }), '5');

      await user.click(screen.getByRole('button', { name: 'Update Vaccine' }));

      await waitFor(() => expect(updateInHouseMedication).toHaveBeenCalledTimes(1));
      expect(vi.mocked(updateInHouseMedication).mock.calls[0][1]).toEqual({
        medicationID: 'vaccine-1',
        name: 'DTaP-Hep B-IPV',
        ndc: undefined,
        medispanID: undefined,
        medispanIDForInteractions: undefined,
        inventory: { ...VACCINE_DEFAULT_INVENTORY, reorderLevels: [{ locationId: mainStreet.id, level: 5 }] },
      });
      expect(enqueueSnackbar).toHaveBeenCalledWith('Vaccine updated successfully', { variant: 'success' });
    });

    it('stops tracking stock when the Counting Unit is set to Not tracked', async () => {
      const user = userEvent.setup();
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });
      await user.click(await findCountingUnit());
      await user.click(screen.getByRole('option', { name: 'Not tracked' }));

      await user.click(screen.getByRole('button', { name: 'Update Vaccine' }));

      await waitFor(() => expect(updateInHouseMedication).toHaveBeenCalledTimes(1));
      expect(vi.mocked(updateInHouseMedication).mock.calls[0][1].inventory).toBeNull();
    });

    it('is removed like a medication, and says what that does for a vaccine', async () => {
      vi.mocked(updateInHouseMedication).mockResolvedValue({ ...vaccine, status: 'inactive' });
      const user = userEvent.setup();
      render(<UpdateMedicationPage />, { wrapper: createWrapper() });

      expect(await screen.findByRole('heading', { name: 'Remove vaccine' }, { timeout: 10_000 })).toBeInTheDocument();
      expect(
        screen.getByText(
          'Removing this vaccine makes it inactive in the catalog. Lots already received stay in inventory, and the vaccine can still be ordered for a visit.'
        )
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Remove Vaccine' }));

      await waitFor(() =>
        expect(updateInHouseMedication).toHaveBeenCalledWith(mockOystehrZambda, {
          medicationID: 'vaccine-1',
          status: 'inactive',
        })
      );
      expect(enqueueSnackbar).toHaveBeenCalledWith('Vaccine removed successfully', { variant: 'success' });
      expect(await screen.findByRole('button', { name: 'Activate Vaccine' })).toBeInTheDocument();
      expect(screen.getByText('Activating this vaccine makes it active in the catalog again.')).toBeInTheDocument();
    });
  });
});
