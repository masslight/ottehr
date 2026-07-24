import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EditableMedicationCard } from '../../src/features/visits/in-person/components/medication-administration/medication-editable-card/EditableMedicationCard';
import { useInHouseMedicationOrderStore } from '../../src/state/draft-data.store';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'appointment-1' }),
  };
});

vi.mock('../../src/features/visits/shared/components/QuickPicksButton', () => ({
  QuickPicksButton: ({ loading }: { loading?: boolean }) => (
    <div data-testid="quick-picks-button">{String(Boolean(loading))}</div>
  ),
}));

vi.mock('../../src/features/visits/in-person/components/RoundedButton', () => ({
  ButtonRounded: ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
    <button onClick={onClick}>{children}</button>
  ),
}));

vi.mock(
  '../../src/features/visits/in-person/components/medication-administration/statuses/MedicationStatusChip',
  () => ({
    MedicationStatusChip: () => <div />,
  })
);

vi.mock(
  '../../src/features/visits/in-person/components/medication-administration/medication-editable-card/MedicationCardField',
  () => ({
    MedicationCardField: ({ field, value }: { field?: string; value?: unknown }) => (
      <div data-testid={`field-${field}`} data-value={value != null ? String(value) : ''} />
    ),
  })
);

vi.mock(
  '../../src/features/visits/in-person/components/medication-administration/medication-editable-card/MedicationCptCodes',
  () => ({
    MedicationCptCodes: () => <div />,
  })
);

vi.mock('../../src/features/visits/shared/components/Loader', () => ({
  Loader: () => <div />,
}));

vi.mock('../../src/components/dialogs/DeleteDialog', () => ({
  default: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/InPersonModal', () => ({
  InPersonModal: () => <div />,
}));

vi.mock('../../src/features/visits/in-person/components/medication-administration/InteractionAlertsDialog', () => ({
  InteractionAlertsDialog: () => <div />,
}));

vi.mock('../../src/features/visits/shared/components/ERX', () => ({
  ERX: () => <div />,
  ERXStatus: {
    LOADING: 'loading',
    READY: 'ready',
    COMPLETE: 'complete',
  },
}));

vi.mock('../../src/features/visits/shared/components/ERXInteractionsReadiness', () => ({
  ERXInteractionsReadiness: () => null,
}));

vi.mock('../../src/features/visits/in-person/hooks/useMedicationHistory', () => ({
  useMedicationHistory: () => ({
    isLoading: false,
    medicationHistory: [],
    refetchHistory: vi.fn(),
  }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({
    mappedData: {},
    resources: { encounter: { id: 'enc-med-test' } },
  }),
}));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({
    oystehr: {},
    oystehrZambda: {},
  }),
}));

vi.mock('../../src/hooks/useCommandPaletteSource', () => ({
  useCommandPaletteSource: vi.fn(),
}));

vi.mock('../../src/hooks/useEvolveUser', () => ({
  default: () => ({ hasRole: () => false }),
}));

vi.mock('../../src/hooks/useMergedQuickPicks', () => ({
  sortQuickPicks: (a: any, b: any) => (a.name ?? '').localeCompare(b.name ?? ''),
  useMergedInHouseMedicationQuickPicks: () => ({
    quickPicks: [],
    loading: true,
    refetch: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/usePendingQuickPick', () => ({
  usePendingQuickPick: vi.fn(),
}));

vi.mock('../../src/features/visits/shared/hooks/useReactNavigationBlocker', () => ({
  useReactNavigationBlocker: () => ({
    ConfirmationModal: () => <div />,
  }),
}));

vi.mock('../../src/features/visits/in-person/hooks/useGetFieldOptions', () => ({
  useFieldsSelectsOptions: () =>
    new Proxy(
      {
        medicationId: {
          options: [],
          ndcToMedicationId: {},
          medispanCodeToMedicationId: {},
          defaultOption: undefined,
        },
        route: { options: [], defaultOption: undefined },
        providerId: { options: [], defaultOption: undefined },
      },
      {
        get: (target, prop) =>
          prop in target
            ? (target as Record<string | symbol, unknown>)[prop]
            : { options: [], defaultOption: undefined },
      }
    ),
}));

vi.mock('../../src/features/visits/in-person/hooks/useMedicationManagement', () => ({
  useMedicationManagement: () => ({
    updateMedication: vi.fn(),
    getMedicationFieldValue: vi.fn(() => ''),
    getIsMedicationEditable: vi.fn(() => false),
    deleteMedication: vi.fn(),
  }),
}));

describe('EditableMedicationCard', () => {
  it('passes the FHIR quick pick loading state through to QuickPicksButton', () => {
    render(<EditableMedicationCard type="dispense" />);

    expect(screen.getByTestId('quick-picks-button')).toHaveTextContent('true');
  });

  describe('draft behavior — order-new type', () => {
    const ENCOUNTER_ID = 'enc-med-test';

    beforeEach(() => {
      useInHouseMedicationOrderStore.setState({ draftsByEncounterId: {} });
      vi.clearAllMocks();
    });

    it('does not show the banner when the draft store is empty', () => {
      render(<EditableMedicationCard type="order-new" />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('shows the in-progress banner when a draft exists', () => {
      useInHouseMedicationOrderStore.getState().setDraft(ENCOUNTER_ID, { medicationId: 'med-1' });

      render(<EditableMedicationCard type="order-new" />);

      expect(screen.getByRole('alert')).toHaveTextContent('medication order in progress');
    });

    it('shows the restored banner when hasNavigatedAway is true', () => {
      useInHouseMedicationOrderStore.getState().setDraft(ENCOUNTER_ID, {
        medicationId: 'med-1',
        hasNavigatedAway: true,
      });

      render(<EditableMedicationCard type="order-new" />);

      expect(screen.getByRole('alert')).toHaveTextContent('previously entered data has been restored');
    });

    it('does not show the banner for dispense type even when a draft exists', () => {
      useInHouseMedicationOrderStore.getState().setDraft(ENCOUNTER_ID, { medicationId: 'med-1' });

      render(<EditableMedicationCard type="dispense" />);

      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('renders a Clear Form button when type is order-new and a draft exists', () => {
      useInHouseMedicationOrderStore.getState().setDraft(ENCOUNTER_ID, { medicationId: 'med-1' });

      render(<EditableMedicationCard type="order-new" />);

      expect(screen.getByRole('button', { name: /clear form/i })).toBeInTheDocument();
    });

    it('does not render a Clear Form button when no draft exists', () => {
      render(<EditableMedicationCard type="order-new" />);

      expect(screen.queryByRole('button', { name: /clear form/i })).not.toBeInTheDocument();
    });

    it('clicking Clear Form clears the draft store', async () => {
      useInHouseMedicationOrderStore.getState().setDraft(ENCOUNTER_ID, { medicationId: 'med-1' });
      const user = userEvent.setup();

      render(<EditableMedicationCard type="order-new" />);
      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(useInHouseMedicationOrderStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
    });

    it('clicking Back when type is order-new clears the draft store', async () => {
      useInHouseMedicationOrderStore.getState().setDraft(ENCOUNTER_ID, { medicationId: 'med-1' });
      const user = userEvent.setup();

      render(<EditableMedicationCard type="order-new" />);
      await user.click(screen.getByRole('button', { name: /back/i }));

      expect(useInHouseMedicationOrderStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
    });

    it('populates form fields from the draft on mount', () => {
      useInHouseMedicationOrderStore.getState().setDraft(ENCOUNTER_ID, { medicationId: 'med-1' });

      render(<EditableMedicationCard type="order-new" />);

      expect(screen.getByTestId('field-medicationId')).toHaveAttribute('data-value', 'med-1');
    });

    it('clicking Clear Form resets form fields to empty', async () => {
      useInHouseMedicationOrderStore.getState().setDraft(ENCOUNTER_ID, { medicationId: 'med-1' });
      const user = userEvent.setup();

      render(<EditableMedicationCard type="order-new" />);
      expect(screen.getByTestId('field-medicationId')).toHaveAttribute('data-value', 'med-1');

      await user.click(screen.getByRole('button', { name: /clear form/i }));

      expect(screen.getByTestId('field-medicationId')).toHaveAttribute('data-value', '');
    });

    it('shows the interaction checking banner when the draft contains a medicationId', () => {
      useInHouseMedicationOrderStore.getState().setDraft(ENCOUNTER_ID, { medicationId: 'med-draft-1' });

      render(<EditableMedicationCard type="order-new" />);

      // erxEnabled is seeded true from the draft, so the component enters the
      // eRx loading state. The banner shows "checking..." rather than a stale "not found".
      expect(screen.getByText(/checking\.\.\./)).toBeInTheDocument();
    });
  });
});
