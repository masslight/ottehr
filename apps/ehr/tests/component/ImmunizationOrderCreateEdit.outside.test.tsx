// The order page with externally administered immunizations: the add button, the save button's label and one save
// that both orders and records.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockNavigate, mockCreateUpdateOrder, mockRecordOutside, mockEnqueueSnackbar } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCreateUpdateOrder: vi.fn(),
  mockRecordOutside: vi.fn(),
  mockEnqueueSnackbar: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate, useParams: () => ({ id: 'appt-1' }) };
});
vi.mock('notistack', () => ({ enqueueSnackbar: mockEnqueueSnackbar }));
vi.mock('../../src/hooks/useAppClients', () => ({ useApiClients: () => ({}) }));
vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ hasRole: () => false, userName: 'Dr. Test' }),
}));
vi.mock('../../src/hooks/useCommandPaletteSource', () => ({ useCommandPaletteSource: vi.fn() }));
vi.mock('../../src/hooks/usePendingQuickPick', () => ({ usePendingQuickPick: vi.fn() }));
vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));
vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ resources: { encounter: { id: 'enc-imm-outside' }, patient: { id: 'pat-1' } } }),
}));
vi.mock('../../src/features/visits/in-person/components/RoundedButton', () => ({
  ButtonRounded: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));
vi.mock('../../src/components/AccordionCard', () => ({ AccordionCard: ({ children }: any) => <div>{children}</div> }));
vi.mock('../../src/components/BaseBreadcrumbs', () => ({ BaseBreadcrumbs: () => <div /> }));
vi.mock('../../src/components/dialogs/CustomDialog', () => ({ CustomDialog: () => <div /> }));
vi.mock('../../src/features/visits/in-person/components/medication-administration/PageHeader', () => ({
  PageHeader: () => <div />,
}));
vi.mock('../../src/features/visits/in-person/components/WarningBlock', () => ({ WarningBlock: () => <div /> }));
vi.mock('../../src/features/visits/shared/components/review-tab/components/AllergiesContainer', () => ({
  AllergiesContainer: () => <div />,
}));
vi.mock('../../src/features/visits/shared/components/review-tab/components/MedicationsContainer', () => ({
  MedicationsContainer: () => <div />,
}));
vi.mock('../../src/features/immunization/hooks/useImmunizationQuickPickManagement', () => ({
  useImmunizationQuickPickManagement: () => ({
    mergedQuickPicks: [],
    mergedQuickPicksLoading: false,
    quickPickDialogOpen: false,
    setQuickPickDialogOpen: vi.fn(),
    quickPickName: '',
    setQuickPickName: vi.fn(),
    existingQuickPicks: [],
    quickPickSaving: false,
    openQuickPickDialog: vi.fn(),
    onSaveAsQuickPick: vi.fn(),
  }),
}));
vi.mock('../../src/features/visits/in-person/hooks/useImmunization', () => ({
  useCancelImmunizationOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateUpdateImmunizationOrder: () => ({ mutateAsync: mockCreateUpdateOrder, isPending: false }),
  useRecordOutsideImmunization: () => ({ mutateAsync: mockRecordOutside, isPending: false }),
  useGetImmunizationOrders: () => ({ data: undefined, isLoading: false }),
  useGetImmunizationForecast: () => ({ data: undefined, isLoading: false, isError: false }),
  useGetVaccines: () => ({ data: [], isLoading: false }),
}));
vi.mock('../../src/features/immunization/hooks/useVaccineInventory', () => ({
  useVfcEligibility: () => ({ data: undefined, isLoading: false }),
  useConfirmVfcEligibility: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useVaccineLotsOnHand: () => ({ data: [] }),
  useVaccineInventoryAtLocation: () => ({ data: undefined }),
}));
vi.mock('../../src/features/immunization/components/OrderHistoryTable', () => ({ OrderHistoryTable: () => <div /> }));

// Each line shows whether it is an external one, its vaccine and errors
vi.mock('../../src/features/immunization/components/ImmunizationSentences', () => ({
  ImmunizationSectionLabel: ({ children }: any) => <h3>{children}</h3>,
  ImmunizationSentences: ({ line, errors }: any) => (
    <div
      data-testid={line.outside ? 'outside-line' : 'order-line'}
      data-vaccine={line.details.medication?.name ?? ''}
      data-dose={line.details.dose ?? ''}
    >
      {errors.length > 0 && <p data-testid="line-errors">{errors.join('. ')}</p>}
    </div>
  ),
}));

import { dataTestIds } from '../../src/constants/data-test-ids';
import { ImmunizationFormValues } from '../../src/features/immunization/components/immunizationLines';
import { ImmunizationOrderCreateEdit } from '../../src/features/immunization/pages/ImmunizationOrderCreateEdit';
import { useImmunizationOrderStore } from '../../src/state/draft-data.store';

const ENCOUNTER_ID = 'enc-imm-outside';
const PROVIDER = { id: 'prov-1', name: 'Dr. Test' };

const orderLine = (vaccine: string): ImmunizationFormValues => ({
  details: { medication: { id: `${vaccine}-id`, name: vaccine }, dose: '0.5', units: 'ml', orderedProvider: PROVIDER },
  administrationDetails: {},
});
const outsideLine = (vaccine: string, dateGiven?: string): ImmunizationFormValues => ({
  details: { medication: { id: `${vaccine}-id`, name: vaccine }, orderedProvider: PROVIDER },
  administrationDetails: { cvx: '20' },
  outside: { dateGiven, place: 'Mercy Pediatrics', source: 'written-record' },
});
const seedLines = (...lines: ImmunizationFormValues[]): void => {
  useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, { lines });
};
const lineKinds = (): string[] =>
  screen.getAllByTestId(/^(order|outside)-line$/).map((line) => line.getAttribute('data-testid')!);

describe('ImmunizationOrderCreateEdit — externally administered immunizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateUpdateOrder.mockResolvedValue({ orderId: 'order-1' });
    mockRecordOutside.mockResolvedValue({ immunizationId: 'imm-1' });
    useImmunizationOrderStore.setState({ draftsByEncounterId: {} });
  });

  it('converts the untouched empty line, otherwise adds a line, and the save button counts both kinds', async () => {
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit />);
    expect(lineKinds()).toEqual(['order-line']);
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.orderVaccineButton)).toHaveTextContent('Order Immunization');

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.addOutsideButton));
    expect(lineKinds()).toEqual(['outside-line']);
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.orderVaccineButton)).toHaveTextContent('Record 1 Outside');

    await user.click(screen.getByRole('button', { name: 'Add another immunization' }));
    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.addOutsideButton));
    // the empty order line just added converts; a second click adds a line
    expect(lineKinds()).toEqual(['outside-line', 'outside-line']);
    await user.click(screen.getByRole('button', { name: 'Add another immunization' }));
    expect(lineKinds()).toEqual(['outside-line', 'outside-line', 'order-line']);
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.orderVaccineButton)).toHaveTextContent(
      'Order Immunization · Record 2 Outside'
    );
  });

  it('a written-in order line is kept: the external line is added after it', async () => {
    seedLines(orderLine('MMR'));
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit />);

    await user.click(screen.getByTestId(dataTestIds.orderVaccinePage.addOutsideButton));

    expect(lineKinds()).toEqual(['order-line', 'outside-line']);
    expect(screen.getByTestId(dataTestIds.orderVaccinePage.orderVaccineButton)).toHaveTextContent(
      'Order Immunization · Record 1 Outside'
    );
  });

  it('one save orders the order lines and records the outside doses, undated ones without a date', async () => {
    seedLines(orderLine('MMR'), outsideLine('DTaP', '2026-03-02'), outsideLine('Hep B'));
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit />);

    await user.click(screen.getByRole('button', { name: 'Order Immunization · Record 2 Outside' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(mockCreateUpdateOrder).toHaveBeenCalledTimes(1);
    expect(mockCreateUpdateOrder.mock.calls[0][0].details.medication.name).toBe('MMR');
    expect(mockRecordOutside.mock.calls.map(([request]) => request)).toEqual([
      {
        encounterId: ENCOUNTER_ID,
        vaccine: { id: 'DTaP-id', name: 'DTaP' },
        cvx: '20',
        dateGiven: '2026-03-02',
        place: 'Mercy Pediatrics',
        source: 'written-record',
      },
      {
        encounterId: ENCOUNTER_ID,
        vaccine: { id: 'Hep B-id', name: 'Hep B' },
        cvx: '20',
        place: 'Mercy Pediatrics',
        source: 'written-record',
      },
    ]);
    expect(useImmunizationOrderStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
    expect(mockEnqueueSnackbar).not.toHaveBeenCalled();
  });

  it('an external line without a vaccine stops the save and says so; its date and place are optional', async () => {
    seedLines({ details: { orderedProvider: PROVIDER }, administrationDetails: {}, outside: {} });
    const user = userEvent.setup();
    render(<ImmunizationOrderCreateEdit />);

    await user.click(screen.getByRole('button', { name: 'Record 1 Outside' }));

    expect(mockRecordOutside).not.toHaveBeenCalled();
    expect(screen.getByTestId('line-errors')).toHaveTextContent('Pick the immunization');
  });
});
