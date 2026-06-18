import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EditableMedicationCard } from '../../src/features/visits/in-person/components/medication-administration/medication-editable-card/EditableMedicationCard';

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
  ButtonRounded: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
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
    MedicationCardField: () => <div />,
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
    COMPLETE: 'complete',
  },
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
    resources: {},
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
});
