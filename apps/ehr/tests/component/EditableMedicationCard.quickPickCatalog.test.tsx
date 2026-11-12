import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Medication } from 'fhir/r4b';
import { makeMedicationInventoryExtension } from 'utils/lib/fhir/medication-inventory';
import { MEDICATION_IDENTIFIER_NAME_SYSTEM } from 'utils/lib/types/api/medication-administration.constants';
import { InHouseMedicationQuickPickData } from 'utils/lib/types/api/quick-picks.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditableMedicationCard } from '../../src/features/visits/in-person/components/medication-administration/medication-editable-card/EditableMedicationCard';
import { MedicationOrderType } from '../../src/features/visits/in-person/components/medication-administration/medication-editable-card/fieldsConfig';
import { useCommandPaletteSource } from '../../src/hooks/useCommandPaletteSource';
import { useCommandPaletteStore } from '../../src/state/command-palette.store';
import { useInHouseMedicationOrderStore } from '../../src/state/draft-data.store';

const ENCOUNTER_ID = 'enc-med-test';
const { search } = vi.hoisted(() => ({ search: vi.fn() }));
const clients = vi.hoisted(() => ({ oystehr: { fhir: { search } }, oystehrZambda: {} }));

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual('react-router-dom')),
  useNavigate: () => vi.fn(),
  useParams: () => ({ id: 'appointment-1' }),
}));
vi.mock('src/api/api', () => ({
  getEmployees: vi.fn(async () => ({ employees: [] })),
  getInHouseMedicationQuickPicks: vi.fn(),
  createInHouseMedicationQuickPick: vi.fn(),
  updateInHouseMedicationQuickPick: vi.fn(),
}));
vi.mock(
  '../../src/features/visits/in-person/components/medication-administration/statuses/MedicationStatusChip',
  () => ({ MedicationStatusChip: () => <div /> })
);
vi.mock(
  '../../src/features/visits/in-person/components/medication-administration/medication-editable-card/MedicationCardField',
  async (importOriginal) => ({ ...(await importOriginal<object>()), MedicationCardField: () => <div /> })
);
vi.mock('src/components/input/CptCodesInput', () => ({
  CptCodesInput: () => <div />,
  CptCodeSearch: () => <div />,
  addCptCode: (codes: unknown[]) => codes,
  removeCptCode: (codes: unknown[]) => codes,
  designateMedicationCptCode: (codes: unknown[]) => codes,
}));
vi.mock('../../src/features/admin/inventory/inventory.queries', () => ({
  useInventoryLotsOnHand: () => ({ data: undefined }),
}));
vi.mock('../../src/features/visits/shared/components/ERX', () => ({
  ERX: () => <div />,
  ERXStatus: { LOADING: 'loading', READY: 'ready', COMPLETE: 'complete' },
}));
vi.mock('../../src/features/visits/shared/components/ERXInteractionsReadiness', () => ({
  ERXInteractionsReadiness: () => null,
}));
vi.mock('../../src/features/visits/in-person/hooks/useMedicationHistory', () => ({
  useMedicationHistory: () => ({ isLoading: false, medicationHistory: [], refetchHistory: vi.fn() }),
}));
vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));
vi.mock('../../src/features/visits/shared/hooks/useChartData', () => ({
  useChartData: () => ({ chartData: undefined, isChartDataLoading: false }),
}));
vi.mock('../../src/features/visits/shared/hooks/useMainEncounterChartData', () => ({
  useMainEncounterChartData: () => ({ data: undefined }),
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ mappedData: {}, resources: { encounter: { id: ENCOUNTER_ID } } }),
}));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => clients }));
vi.mock('../../src/hooks/useCommandPaletteSource', () => ({ useCommandPaletteSource: vi.fn() }));
vi.mock('../../src/hooks/useEvolveUser', () => ({ default: () => ({ hasRole: () => false }) }));
vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  sortQuickPicks: () => 0,
  useMergedInHouseMedicationQuickPicks: () => ({ quickPicks: [quickPick], loading: false, refetch: vi.fn() }),
}));
vi.mock('../../src/features/visits/in-person/hooks/useMedicationManagement', () => ({
  useMedicationManagement: () => ({
    updateMedication: vi.fn(),
    getMedicationFieldValue: vi.fn(() => ''),
    getIsMedicationEditable: vi.fn(() => true),
    deleteMedication: vi.fn(),
  }),
}));

const quickPick: InHouseMedicationQuickPickData = vi.hoisted(() => ({
  id: 'qp-1',
  name: 'Ondansetron IV',
  medicationId: 'med-1',
  medicationName: 'Ondansetron',
  dose: 4,
  units: 'mg',
  route: 'IV',
  lotNumber: 'OLD-LOT',
  ndc: '0000-0000-00',
  expDate: '2025-01-31',
  manufacturer: 'Old Maker',
}));
const QUICK_PICK_LABEL = 'Ondansetron IV, 4 mg';
const PALETTE_ITEM_ID = 'in-house-medication-qp-1';
const NO_LOT_DETAILS = { lotNumber: undefined, expDate: undefined, ndc: undefined, manufacturer: undefined };
const QUICK_PICK_LOT_DETAILS = {
  lotNumber: 'OLD-LOT',
  expDate: '2025-01-31',
  ndc: '0000-0000-00',
  manufacturer: 'Old Maker',
};

const catalogDrug = (tracked: boolean): Medication => ({
  resourceType: 'Medication',
  id: 'med-1',
  identifier: [{ system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Ondansetron' }],
  ...(tracked && {
    extension: [
      makeMedicationInventoryExtension({
        countedAs: 'vial',
        eachContains: { amount: 4, unit: 'mg' },
        use: 'single-use',
        reorderLevels: [],
      }),
    ],
  }),
});

function catalogRequest(): { resolve: (tracked: boolean) => void; reject: () => void } {
  let resolve!: (value: { unbundle: () => Medication[] }) => void;
  let reject!: (error: Error) => void;
  search.mockReturnValueOnce(
    new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    })
  );
  return {
    resolve: (tracked) => resolve({ unbundle: () => [catalogDrug(tracked)] }),
    reject: () => reject(new Error('catalog search failed')),
  };
}

const newQueryClient = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

const renderCard = (queryClient: QueryClient, type: MedicationOrderType = 'order-new'): ReturnType<typeof render> =>
  render(
    <QueryClientProvider client={queryClient}>
      <EditableMedicationCard type={type} />
    </QueryClientProvider>
  );

const draft = (): Record<string, unknown> | undefined =>
  useInHouseMedicationOrderStore.getState().getDraft(ENCOUNTER_ID) as Record<string, unknown> | undefined;
const lotDetails = (): Record<string, unknown> => ({
  lotNumber: draft()?.lotNumber,
  expDate: draft()?.expDate,
  ndc: draft()?.ndc,
  manufacturer: draft()?.manufacturer,
});
const queuePendingQuickPick = (): void =>
  useCommandPaletteStore
    .getState()
    .setPendingQuickPick({ category: 'in-house-medications', itemId: 'qp-1', payload: quickPick });
const pendingQuickPick = (): unknown => useCommandPaletteStore.getState().pendingQuickPick;
const paletteItem = (): { onSelect: () => void } | undefined =>
  vi.mocked(useCommandPaletteSource).mock.lastCall?.[1].find((item) => item.id === PALETTE_ITEM_ID);
const settle = (ms = 300): Promise<void> => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

describe('EditableMedicationCard - quick picks wait for the medication catalog', () => {
  beforeEach(() => {
    search.mockReset();
    useInHouseMedicationOrderStore.setState({ draftsByEncounterId: {} });
    useCommandPaletteStore.getState().setPendingQuickPick(null);
    vi.mocked(useCommandPaletteSource).mockClear();
  });

  it('applies a pending quick pick only after the catalog loads, leaving a tracked drug lot details to stock', async () => {
    const request = catalogRequest();
    queuePendingQuickPick();
    renderCard(newQueryClient());

    await settle();
    expect(pendingQuickPick()).not.toBeNull();
    expect(draft()?.medicationId).toBeUndefined();

    request.resolve(true);
    await waitFor(() => expect(pendingQuickPick()).toBeNull());
    expect(draft()).toMatchObject({ medicationId: 'med-1', dose: 4, units: 'mg' });
    expect(lotDetails()).toEqual(NO_LOT_DETAILS);
  });

  it('keeps the lot details of a pending quick pick for an untracked drug once the catalog loads', async () => {
    const request = catalogRequest();
    queuePendingQuickPick();
    renderCard(newQueryClient());

    request.resolve(false);
    await waitFor(() => expect(pendingQuickPick()).toBeNull());
    expect(lotDetails()).toEqual(QUICK_PICK_LOT_DETAILS);
  });

  it('offers quick picks in the order menu only once the catalog has loaded', async () => {
    const request = catalogRequest();
    const user = userEvent.setup();
    renderCard(newQueryClient());
    await user.click(screen.getByTestId('input-medicationId'));

    expect(screen.queryByRole('option', { name: QUICK_PICK_LABEL })).not.toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeInTheDocument();

    request.resolve(true);
    await user.click(await screen.findByRole('option', { name: QUICK_PICK_LABEL }));
    expect(draft()).toMatchObject({ medicationId: 'med-1', dose: 4 });
    expect(lotDetails()).toEqual(NO_LOT_DETAILS);
  });

  it('lists quick picks in the command palette only once the catalog has loaded', async () => {
    const request = catalogRequest();
    renderCard(newQueryClient());

    expect(paletteItem()).toBeUndefined();

    request.resolve(true);
    await waitFor(() => expect(paletteItem()).toBeDefined());
    act(() => paletteItem()!.onSelect());
    expect(draft()).toMatchObject({ medicationId: 'med-1', dose: 4 });
    expect(lotDetails()).toEqual(NO_LOT_DETAILS);
  });

  it('offers quick picks in the Quick Picks button only once the catalog has loaded', async () => {
    const request = catalogRequest();
    const user = userEvent.setup();
    renderCard(newQueryClient(), 'dispense');

    await user.click(screen.getByRole('textbox', { name: 'Quick Picks' }));
    expect(screen.queryByRole('menuitem', { name: QUICK_PICK_LABEL })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Loading…' })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    request.resolve(true);
    await settle();
    await user.click(screen.getByRole('textbox', { name: 'Quick Picks' }));
    expect(await screen.findByRole('menuitem', { name: QUICK_PICK_LABEL })).toBeInTheDocument();
  });

  it('holds quick picks while the catalog request has failed, without a loading indicator', async () => {
    const queryClient = newQueryClient();
    const failed = catalogRequest();
    queuePendingQuickPick();
    const user = userEvent.setup();
    const { unmount } = renderCard(queryClient);

    failed.reject();
    await settle(500);
    expect(pendingQuickPick()).not.toBeNull();
    expect(draft()?.medicationId).toBeUndefined();
    expect(paletteItem()).toBeUndefined();
    await user.click(screen.getByTestId('input-medicationId'));
    expect(screen.queryByRole('option', { name: QUICK_PICK_LABEL })).not.toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();

    unmount();
    const retried = catalogRequest();
    renderCard(queryClient);
    retried.resolve(true);
    await waitFor(() => expect(pendingQuickPick()).toBeNull());
    expect(lotDetails()).toEqual(NO_LOT_DETAILS);
  });
});
