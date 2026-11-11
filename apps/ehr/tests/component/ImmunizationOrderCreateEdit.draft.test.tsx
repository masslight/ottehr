import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks (must come before component imports) ─────────────────────────────

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    // no orderId → isCreating = true
    useParams: () => ({ id: 'appt-1' }),
  };
});

vi.mock('notistack', () => ({
  enqueueSnackbar: vi.fn(),
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
      encounter: { id: 'enc-imm-test' },
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
  useCreateUpdateImmunizationOrder: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useGetImmunizationOrders: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('../../src/features/immunization/components/OrderHistoryTable', () => ({
  OrderHistoryTable: () => <div />,
}));

// Mock the line to expose its dose and lot
vi.mock('../../src/features/immunization/components/ImmunizationSentences', () => ({
  ImmunizationSectionLabel: ({ children }: any) => <h3>{children}</h3>,
  ImmunizationSentences: ({ line }: any) => (
    <div
      data-testid="immunization-line"
      data-dose={line.details.dose ?? ''}
      data-lot={line.administrationDetails.lot ?? ''}
    />
  ),
}));

// ─── Component + real draft store (imports after all vi.mock calls) ──────────

import { ImmunizationOrderCreateEdit } from '../../src/features/immunization/pages/ImmunizationOrderCreateEdit';
import { useImmunizationOrderStore } from '../../src/state/draft-data.store';

// ─── Constants ───────────────────────────────────────────────────────────────

const ENCOUNTER_ID = 'enc-imm-test';

const draftWith = (dose: string, lot?: string): void => {
  useImmunizationOrderStore
    .getState()
    .setDraft(ENCOUNTER_ID, { lines: [{ details: { dose }, administrationDetails: lot ? { lot } : {} }] });
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ImmunizationOrderCreateEdit — draft store behaviour', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useImmunizationOrderStore.setState({ draftsByEncounterId: {} });
  });

  // ── UnsavedDraftWarning banner ───────────────────────────────────────────

  describe('UnsavedDraftWarning banner', () => {
    it('does not show the banner when no draft exists', () => {
      render(<ImmunizationOrderCreateEdit />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the in-progress banner when a draft exists (no hasNavigatedAway)', () => {
      draftWith('1.5');

      render(<ImmunizationOrderCreateEdit />);

      expect(screen.getByRole('alert')).toHaveTextContent('immunization order in progress');
    });

    it('shows the restored banner when hasNavigatedAway is true', () => {
      draftWith('1.5');
      useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, { hasNavigatedAway: true });

      render(<ImmunizationOrderCreateEdit />);

      expect(screen.getByRole('alert')).toHaveTextContent('previously entered data has been restored');
    });
  });

  // ── Clear Form button visibility ─────────────────────────────────────────

  describe('Clear Form button', () => {
    it('shows the Clear Form button when a draft exists', () => {
      draftWith('1.5');

      render(<ImmunizationOrderCreateEdit />);

      expect(screen.getByRole('button', { name: /clear form/i })).toBeInTheDocument();
    });

    it('does not show the Clear Form button when no draft exists', () => {
      render(<ImmunizationOrderCreateEdit />);

      expect(screen.queryByRole('button', { name: /clear form/i })).not.toBeInTheDocument();
    });
  });

  // ── Form state ───────────────────────────────────────────────────────────

  describe('form state', () => {
    it('populates the line from the draft on mount', () => {
      draftWith('1.5');

      render(<ImmunizationOrderCreateEdit />);

      expect(screen.getByTestId('immunization-line')).toHaveAttribute('data-dose', '1.5');
    });

    it('restores every line of the draft', () => {
      useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, {
        lines: [
          { details: { dose: '1' }, administrationDetails: {} },
          { details: { dose: '2' }, administrationDetails: {} },
        ],
      });

      render(<ImmunizationOrderCreateEdit />);

      expect(screen.getAllByTestId('immunization-line').map((line) => line.getAttribute('data-dose'))).toEqual([
        '1',
        '2',
      ]);
      expect(screen.getByRole('button', { name: 'Order 2 Immunizations' })).toBeInTheDocument();
    });

    it('clicking Clear Form clears the draft store', async () => {
      draftWith('1.5');
      const user = userEvent.setup();

      render(<ImmunizationOrderCreateEdit />);
      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(useImmunizationOrderStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
    });

    it('clicking Clear Form resets the form to one empty line', async () => {
      useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, {
        lines: [
          { details: { dose: '1.5' }, administrationDetails: {} },
          { details: { dose: '2' }, administrationDetails: {} },
        ],
      });
      const user = userEvent.setup();

      render(<ImmunizationOrderCreateEdit />);
      expect(screen.getAllByTestId('immunization-line')).toHaveLength(2);

      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(screen.getAllByTestId('immunization-line')).toHaveLength(1);
      expect(screen.getByTestId('immunization-line')).toHaveAttribute('data-dose', '');
      // not a change of the user's: no new draft
      expect(useImmunizationOrderStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
    });

    it('populates administration fields from the draft on mount', () => {
      draftWith('1.5', 'L1');

      render(<ImmunizationOrderCreateEdit />);

      expect(screen.getByTestId('immunization-line')).toHaveAttribute('data-lot', 'L1');
    });

    it('does not apply the creation draft when editing an existing order', () => {
      draftWith('1.5', 'L1');

      render(<ImmunizationOrderCreateEdit orderId="order-1" />);

      expect(screen.getByTestId('immunization-line')).toHaveAttribute('data-dose', '');
      expect(screen.getByTestId('immunization-line')).toHaveAttribute('data-lot', '');
    });

    it('clicking Clear Form resets administration fields to empty', async () => {
      draftWith('1.5', 'L1');
      const user = userEvent.setup();

      render(<ImmunizationOrderCreateEdit />);
      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(screen.getByTestId('immunization-line')).toHaveAttribute('data-lot', '');
    });

    it('adding a line saves every line to the draft', async () => {
      const user = userEvent.setup();

      render(<ImmunizationOrderCreateEdit />);
      await user.click(screen.getByRole('button', { name: 'Add another immunization' }));

      expect(screen.getAllByTestId('immunization-line')).toHaveLength(2);
      expect(screen.getByRole('button', { name: 'Order 2 Immunizations' })).toBeInTheDocument();
      expect(useImmunizationOrderStore.getState().getDraft(ENCOUNTER_ID).lines).toHaveLength(2);
    });
  });
});
