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
  useCreateUpdateImmunizationOrder: () => ({
    mutateAsync: vi.fn().mockResolvedValue({}),
    isPending: false,
  }),
  useGetImmunizationOrders: () => ({ data: undefined, isLoading: false }),
}));

vi.mock('../../src/features/immunization/components/OrderHistoryTable', () => ({
  OrderHistoryTable: () => <div />,
}));

// The sentences expose the form's dose and lot, a change of the user's and a quick pick.
vi.mock('../../src/features/immunization/components/ImmunizationSentences', () => ({
  ImmunizationSectionLabel: ({ children }: any) => <h3>{children}</h3>,
  ImmunizationSentences: ({ values, onChange, onQuickPick }: any) => (
    <div
      data-testid="immunization-sentences"
      data-dose={values.details.dose ?? ''}
      data-lot={values.administrationDetails.lot ?? ''}
    >
      <button onClick={() => onChange({ ...values, details: { ...values.details, dose: '2' } })}>Type dose 2</button>
      <button
        onClick={() =>
          onQuickPick({ name: 'Tdap adult', vaccine: { id: '115', name: 'Tdap' }, dose: '0.5', lot: 'QP-LOT' })
        }
      >
        Pick the quick pick
      </button>
    </div>
  ),
}));

// ─── Component + real draft store (imports after all vi.mock calls) ──────────

import { ImmunizationOrderCreateEdit } from '../../src/features/immunization/pages/ImmunizationOrderCreateEdit';
import { useImmunizationOrderStore } from '../../src/state/draft-data.store';

// ─── Constants ───────────────────────────────────────────────────────────────

const ENCOUNTER_ID = 'enc-imm-test';

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
      useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, { dose: '1.5' });

      render(<ImmunizationOrderCreateEdit />);

      expect(screen.getByRole('alert')).toHaveTextContent('immunization order in progress');
    });

    it('shows the restored banner when hasNavigatedAway is true', () => {
      useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, {
        dose: '1.5',
        hasNavigatedAway: true,
      });

      render(<ImmunizationOrderCreateEdit />);

      expect(screen.getByRole('alert')).toHaveTextContent('previously entered data has been restored');
    });
  });

  // ── Clear Form button visibility ─────────────────────────────────────────

  describe('Clear Form button', () => {
    it('shows the Clear Form button when a draft exists', () => {
      useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, { dose: '1.5' });

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
    it('populates form fields from the draft on mount', () => {
      useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, { dose: '1.5' });

      render(<ImmunizationOrderCreateEdit />);

      expect(screen.getByTestId('immunization-sentences')).toHaveAttribute('data-dose', '1.5');
    });

    it('clicking Clear Form clears the draft store', async () => {
      useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, { dose: '1.5' });
      const user = userEvent.setup();

      render(<ImmunizationOrderCreateEdit />);
      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(useImmunizationOrderStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
    });

    it('clicking Clear Form resets form fields to empty', async () => {
      useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, { dose: '1.5' });
      const user = userEvent.setup();

      render(<ImmunizationOrderCreateEdit />);
      expect(screen.getByTestId('immunization-sentences')).toHaveAttribute('data-dose', '1.5');

      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(screen.getByTestId('immunization-sentences')).toHaveAttribute('data-dose', '');
    });

    it('populates administration fields from the draft on mount', () => {
      useImmunizationOrderStore
        .getState()
        .setDraft(ENCOUNTER_ID, { dose: '1.5', administrationDetails: { lot: 'L1' } });

      render(<ImmunizationOrderCreateEdit />);

      expect(screen.getByTestId('immunization-sentences')).toHaveAttribute('data-lot', 'L1');
    });

    it('does not apply the creation draft when editing an existing order', () => {
      useImmunizationOrderStore
        .getState()
        .setDraft(ENCOUNTER_ID, { dose: '1.5', administrationDetails: { lot: 'L1' } });

      render(<ImmunizationOrderCreateEdit orderId="order-1" />);

      expect(screen.getByTestId('immunization-sentences')).toHaveAttribute('data-dose', '');
      expect(screen.getByTestId('immunization-sentences')).toHaveAttribute('data-lot', '');
    });

    it('clicking Clear Form resets administration fields to empty', async () => {
      useImmunizationOrderStore
        .getState()
        .setDraft(ENCOUNTER_ID, { dose: '1.5', administrationDetails: { lot: 'L1' } });
      const user = userEvent.setup();

      render(<ImmunizationOrderCreateEdit />);
      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(screen.getByTestId('immunization-sentences')).toHaveAttribute('data-lot', '');
    });
  });

  // ── Saving the draft ─────────────────────────────────────────────────────

  describe('saving the draft', () => {
    it('saves a change of the form to the draft, in the stored shape', async () => {
      const user = userEvent.setup();

      render(<ImmunizationOrderCreateEdit />);
      expect(useImmunizationOrderStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
      await user.click(screen.getByRole('button', { name: 'Type dose 2' }));

      const draft = useImmunizationOrderStore.getState().getDraft(ENCOUNTER_ID);
      expect(draft.dose).toBe('2');
      expect(draft.administrationDetails).toMatchObject({ lot: '', cptCodes: [] });
      expect(screen.getByRole('button', { name: /clear form/i })).toBeInTheDocument();
    });

    it('saves an applied quick pick to the draft', async () => {
      const user = userEvent.setup();

      render(<ImmunizationOrderCreateEdit />);
      await user.click(screen.getByRole('button', { name: 'Pick the quick pick' }));

      expect(screen.getByTestId('immunization-sentences')).toHaveAttribute('data-dose', '0.5');
      const draft = useImmunizationOrderStore.getState().getDraft(ENCOUNTER_ID);
      expect(draft.medication).toEqual({ id: '115', name: 'Tdap' });
      expect(draft.administrationDetails?.lot).toBe('QP-LOT');
    });

    it('starts no draft after Clear Form until the form changes again', async () => {
      useImmunizationOrderStore.getState().setDraft(ENCOUNTER_ID, { dose: '1.5' });
      const user = userEvent.setup();

      render(<ImmunizationOrderCreateEdit />);
      await user.click(screen.getByRole('button', { name: 'Type dose 2' }));
      await user.click(screen.getByRole('button', { name: /clear form/i }));
      expect(useImmunizationOrderStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);

      await user.click(screen.getByRole('button', { name: 'Type dose 2' }));
      expect(useImmunizationOrderStore.getState().getDraft(ENCOUNTER_ID).dose).toBe('2');
    });

    it('keeps no draft of an order being edited', async () => {
      const user = userEvent.setup();

      render(<ImmunizationOrderCreateEdit orderId="order-1" />);
      await user.click(screen.getByRole('button', { name: 'Type dose 2' }));

      expect(screen.getByTestId('immunization-sentences')).toHaveAttribute('data-dose', '2');
      expect(useImmunizationOrderStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
    });
  });
});
