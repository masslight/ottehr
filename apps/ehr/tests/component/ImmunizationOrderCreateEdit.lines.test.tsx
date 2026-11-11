import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (must come before component imports) ─────────────────────────────

const { mockNavigate, mockCreateUpdateOrder, mockEnqueueSnackbar } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockCreateUpdateOrder: vi.fn(),
  mockEnqueueSnackbar: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ id: 'appt-1' }),
  };
});

vi.mock('notistack', () => ({
  enqueueSnackbar: mockEnqueueSnackbar,
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({}),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ hasRole: () => false, userName: 'Dr. Test' }),
}));

vi.mock('../../src/hooks/useCommandPaletteSource', () => ({
  useCommandPaletteSource: vi.fn(),
}));

vi.mock('../../src/hooks/usePendingQuickPick', () => ({
  usePendingQuickPick: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    resources: {
      encounter: { id: 'enc-imm-lines' },
      patient: { id: 'pat-1' },
    },
  }),
}));

vi.mock('../../src/features/visits/in-person/components/RoundedButton', () => ({
  ButtonRounded: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('../../src/components/AccordionCard', () => ({
  AccordionCard: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/components/BaseBreadcrumbs', () => ({
  BaseBreadcrumbs: () => <div />,
}));

vi.mock('../../src/components/dialogs/CustomDialog', () => ({
  CustomDialog: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/medication-administration/PageHeader', () => ({
  PageHeader: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/WarningBlock', () => ({
  WarningBlock: () => <div />,
}));

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
    onQuickPickSelect: vi.fn(),
    openQuickPickDialog: vi.fn(),
    onSaveAsQuickPick: vi.fn(),
  }),
}));

vi.mock('../../src/features/visits/in-person/hooks/useImmunization', () => ({
  useCancelImmunizationOrder: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useRecordOutsideImmunization: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useCreateUpdateImmunizationOrder: () => ({ mutateAsync: mockCreateUpdateOrder, isPending: false }),
  useGetImmunizationOrders: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('../../src/features/immunization/components/OrderHistoryTable', () => ({
  OrderHistoryTable: () => <div />,
}));

// The line shows its vaccine and errors, and offers its remove button
vi.mock('../../src/features/immunization/components/ImmunizationSentences', () => ({
  ImmunizationSectionLabel: ({ children }: any) => <h3>{children}</h3>,
  ImmunizationSentences: ({ line, index, onRemove, errors }: any) => (
    <div data-testid="immunization-line" data-vaccine={line.details.medication?.name ?? ''}>
      {errors.length > 0 && <p data-testid="line-errors">{errors.join('. ')}</p>}
      {onRemove && <button onClick={onRemove}>Remove immunization {index + 1}</button>}
    </div>
  ),
}));

// ─── Component + real draft store (imports after all vi.mock calls) ──────────

import { ImmunizationFormValues } from '../../src/features/immunization/components/immunizationLines';
import { ImmunizationOrderCreateEdit } from '../../src/features/immunization/pages/ImmunizationOrderCreateEdit';
import { useImmunizationOrderStore } from '../../src/state/draft-data.store';

// ─── Constants ───────────────────────────────────────────────────────────────

const ENCOUNTER_ID = 'enc-imm-lines';
const PROVIDER = { id: 'prov-1', name: 'Dr. Test' };

const completeLine = (vaccine: string, dose: string): ImmunizationFormValues => ({
  details: { medication: { id: `${vaccine}-id`, name: vaccine }, dose, units: 'ml', orderedProvider: PROVIDER },
  administrationDetails: { lot: `lot-${vaccine}` },
});

const seedLines = (...lines: ImmunizationFormValues[]): void => {
  useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, { lines });
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ImmunizationOrderCreateEdit — several immunizations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateUpdateOrder.mockResolvedValue({ orderId: 'order-1' });
    useImmunizationOrderStore.setState({ draftsByEncounterId: {} });
  });

  it('orders every line with one create call each, then clears the draft and leaves the page', async () => {
    seedLines(completeLine('MMR', '0.5'), completeLine('DTaP', '1'));
    const user = userEvent.setup();

    render(<ImmunizationOrderCreateEdit />);
    await user.click(screen.getByRole('button', { name: 'Order 2 Immunizations' }));

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledTimes(1));
    expect(mockCreateUpdateOrder).toHaveBeenCalledTimes(2);
    expect(mockCreateUpdateOrder.mock.calls.map(([request]) => request)).toEqual([
      {
        encounterId: ENCOUNTER_ID,
        orderId: undefined,
        details: { medication: { id: 'MMR-id', name: 'MMR' }, dose: '0.5', units: 'ml', orderedProvider: PROVIDER },
        administrationDetails: { lot: 'lot-MMR' },
      },
      {
        encounterId: ENCOUNTER_ID,
        orderId: undefined,
        details: { medication: { id: 'DTaP-id', name: 'DTaP' }, dose: '1', units: 'ml', orderedProvider: PROVIDER },
        administrationDetails: { lot: 'lot-DTaP' },
      },
    ]);
    expect(useImmunizationOrderStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
    expect(mockEnqueueSnackbar).not.toHaveBeenCalled();
  });

  it('on a failure part-way, says how many went, keeps the unsent lines and their draft, and stays', async () => {
    seedLines(completeLine('MMR', '0.5'), completeLine('DTaP', '1'), completeLine('Hep B', '0.5'));
    mockCreateUpdateOrder.mockResolvedValueOnce({ orderId: 'order-1' }).mockRejectedValueOnce(new Error('Server down'));
    const user = userEvent.setup();

    render(<ImmunizationOrderCreateEdit />);
    await user.click(screen.getByRole('button', { name: 'Order 3 Immunizations' }));

    await waitFor(() => expect(mockEnqueueSnackbar).toHaveBeenCalledTimes(1));
    expect(mockEnqueueSnackbar).toHaveBeenCalledWith('1 of 3 immunizations ordered. Server down', {
      variant: 'error',
    });
    expect(mockCreateUpdateOrder).toHaveBeenCalledTimes(2);
    expect(mockNavigate).not.toHaveBeenCalled();
    // the two unsent lines stay to try again
    await waitFor(() =>
      expect(screen.getAllByTestId('immunization-line').map((line) => line.getAttribute('data-vaccine'))).toEqual([
        'DTaP',
        'Hep B',
      ])
    );
    expect(screen.getByRole('button', { name: 'Order 2 Immunizations' })).toBeEnabled();
    const draft = useImmunizationOrderStore.getState().getDraft(ENCOUNTER_ID);
    expect(draft.lines?.map((line) => line.details.medication?.name)).toEqual(['DTaP', 'Hep B']);
  });

  it('does not order while a line is incomplete, and says what is missing', async () => {
    seedLines(completeLine('MMR', '0.5'), { details: { orderedProvider: PROVIDER }, administrationDetails: {} });
    const user = userEvent.setup();

    render(<ImmunizationOrderCreateEdit />);
    await user.click(screen.getByRole('button', { name: 'Order 2 Immunizations' }));

    expect(mockCreateUpdateOrder).not.toHaveBeenCalled();
    expect(screen.getByTestId('line-errors')).toHaveTextContent(
      'Pick the immunization. Enter the dose. Pick the units'
    );
  });

  it('removes a line when there are several, never the last one', async () => {
    seedLines(completeLine('MMR', '0.5'), completeLine('DTaP', '1'));
    const user = userEvent.setup();

    render(<ImmunizationOrderCreateEdit />);
    await user.click(screen.getByRole('button', { name: 'Remove immunization 1' }));

    expect(screen.getAllByTestId('immunization-line').map((line) => line.getAttribute('data-vaccine'))).toEqual([
      'DTaP',
    ]);
    expect(screen.queryByRole('button', { name: /remove immunization/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Order Immunization' })).toBeInTheDocument();
  });

  it('edits an existing order as one line, without adding another', () => {
    render(<ImmunizationOrderCreateEdit orderId="order-1" />);

    expect(screen.getAllByTestId('immunization-line')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Add another immunization' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });
});
