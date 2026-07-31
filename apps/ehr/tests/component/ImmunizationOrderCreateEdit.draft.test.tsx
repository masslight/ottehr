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
  useChartData: () => ({ chartData: undefined }),
}));

vi.mock('../../src/features/visits/in-person/components/RoundedButton', () => ({
  ButtonRounded: ({ children, onClick }: any) => <button onClick={onClick}>{children}</button>,
}));

vi.mock('../../src/features/visits/shared/components/QuickPicksButton', () => ({
  QuickPicksButton: () => <div />,
}));

vi.mock('../../src/components/AccordionCard', () => ({
  AccordionCard: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../src/components/BaseBreadcrumbs', () => ({
  BaseBreadcrumbs: () => <div />,
}));

vi.mock('../../src/components/dialogs', () => ({
  CustomDialog: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/medication-administration/PageHeader', () => ({
  PageHeader: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/WarningBlock', () => ({
  WarningBlock: () => <div />,
}));

vi.mock('../../src/helpers/misc.helper', () => ({
  cleanupProperties: vi.fn(async (x: unknown) => x),
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
    overwriteTarget: null,
    setOverwriteTarget: vi.fn(),
    onQuickPickSelect: vi.fn(),
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

// Mock OrderDetailsSection to expose the dose field from form context
vi.mock('../../src/features/immunization/components/OrderDetailsSection', async () => {
  const { useFormContext } = await import('react-hook-form');
  return {
    OrderDetailsSection: () => {
      const { watch } = useFormContext();
      const dose = watch('details.dose');
      return <div data-testid="order-details" data-dose={dose != null ? String(dose) : ''} />;
    },
  };
});

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

      expect(screen.getByTestId('order-details')).toHaveAttribute('data-dose', '1.5');
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
      expect(screen.getByTestId('order-details')).toHaveAttribute('data-dose', '1.5');

      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(screen.getByTestId('order-details')).toHaveAttribute('data-dose', '');
    });
  });
});
