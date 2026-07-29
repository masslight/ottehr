import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateInHouseLabStore } from '../../src/state/draft-data.store';

const ENCOUNTER_ID = 'enc-inhouse-test';

// ── mocks (vi.mock is hoisted above all imports by vitest) ──────────────────

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({ id: 'appt-1' }),
    useLocation: () => ({ state: null }),
  };
});

vi.mock('notistack', () => ({ enqueueSnackbar: vi.fn() }));

vi.mock('../../src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehrZambda: {} }),
}));

vi.mock('../../src/features/visits/shared/hooks/useGetAppointmentAccessibility', () => ({
  useGetAppointmentAccessibility: () => ({ visitType: 'in-person', isAppointmentReadOnly: false }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.store', () => ({
  useAppointmentData: () => ({ encounter: { id: 'enc-inhouse-test' } }),
  useChartData: () => ({ chartData: { diagnosis: [] }, setPartialChartData: vi.fn() }),
}));

vi.mock('../../src/features/visits/shared/stores/appointment/appointment.queries', () => ({
  useGetCreateInHouseLabResources: () => ({ data: undefined, isLoading: false }),
  useICD10SearchNew: () => ({ isFetching: false, data: { codes: [] } }),
}));

vi.mock('../../src/features/visits/shared/hooks/useMainEncounterChartData', () => ({
  useMainEncounterChartData: () => ({ data: undefined }),
}));

vi.mock('../../src/features/visits/shared/hooks/useOystehrAPIClient', () => ({
  useOystehrAPIClient: () => ({}),
}));

vi.mock('../../src/features/visits/shared/hooks/usePrintVisitLabel', () => ({
  usePrintVisitLabel: () => ({ printVisitLabel: vi.fn() }),
}));

vi.mock('../../src/shared/hooks/useDebounce', () => ({
  useDebounce: () => ({ debounce: (cb: () => void) => cb() }),
}));

vi.mock('../../src/features/common/DetailPageContainer', () => ({
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/components/ActionsList', () => ({
  ActionsList: () => <div />,
}));

vi.mock('../../src/components/DeleteIconButton', () => ({
  DeleteIconButton: () => <div />,
}));

vi.mock('../../src/features/external-labs/components/LabSets', () => ({
  LabSets: () => <div />,
}));

vi.mock('../../src/components/UnsavedDraftWarning', () => ({
  UnsavedDraftWarning: ({ message }: { message: string }) => <div data-testid="unsaved-draft-warning">{message}</div>,
}));

vi.mock('../../src/features/in-house-labs/components/details/InHouseLabsNotesCard', () => ({
  InHouseLabsNotesCard: ({ notes }: { notes: string }) => <div data-testid="notes-card" data-value={notes ?? ''} />,
}));

vi.mock('../../src/features/in-house-labs/components/create/InHouseSelectedTestTable', () => ({
  InHouseSelectedTestTable: () => <div />,
}));

vi.mock('../../src/features/in-house-labs/components/create/InHouseLabSelect', () => ({
  InHouseLabSelect: () => <div />,
}));

vi.mock('../../src/features/in-house-labs/components/InHouseLabsBreadcrumbs', () => ({
  InHouseLabsBreadcrumbs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../src/api/api', () => ({
  createInHouseLabOrder: vi.fn(),
  getOrCreateVisitLabel: vi.fn(),
}));

// ── component import comes after all vi.mock calls ──────────────────────────
import { InHouseLabOrderCreatePage } from '../../src/features/in-house-labs/pages/InHouseLabOrderCreatePage';

// ── helpers ─────────────────────────────────────────────────────────────────

const renderPage = (): ReturnType<typeof render> => render(<InHouseLabOrderCreatePage />);

// ── tests ───────────────────────────────────────────────────────────────────

describe('InHouseLabOrderCreatePage — draft store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCreateInHouseLabStore.getState().clearDraft(ENCOUNTER_ID);
  });

  // ── banner tests ──────────────────────────────────────────────────────────

  describe('UnsavedDraftWarning banner', () => {
    it('shows the in-progress banner when a draft exists without hasNavigatedAway', () => {
      useCreateInHouseLabStore.getState().setDraft(ENCOUNTER_ID, { notes: 'Run fasting panel' });

      renderPage();

      expect(screen.getByTestId('unsaved-draft-warning')).toBeInTheDocument();
      expect(screen.getByTestId('unsaved-draft-warning')).toHaveTextContent(
        'You have a lab order in progress. Your draft will be saved.'
      );
    });

    it('shows the restored-data banner when draft.hasNavigatedAway is true', () => {
      useCreateInHouseLabStore.getState().setDraft(ENCOUNTER_ID, {
        notes: 'Run fasting panel',
        hasNavigatedAway: true,
      });

      renderPage();

      expect(screen.getByTestId('unsaved-draft-warning')).toBeInTheDocument();
      expect(screen.getByTestId('unsaved-draft-warning')).toHaveTextContent(
        'Your previously entered data has been restored. Click "Clear Form" to start fresh.'
      );
    });

    it('does not show the banner when there is no draft', () => {
      // no draft seeded — store is clean after beforeEach

      renderPage();

      expect(screen.queryByTestId('unsaved-draft-warning')).not.toBeInTheDocument();
    });
  });

  // ── Clear Form button presence ────────────────────────────────────────────

  describe('Clear Form button', () => {
    it('does not render Clear Form when no draft exists', () => {
      renderPage();

      expect(screen.queryByRole('button', { name: /clear form/i })).not.toBeInTheDocument();
    });

    it('renders the Clear Form button when a draft exists', () => {
      useCreateInHouseLabStore.getState().setDraft(ENCOUNTER_ID, { notes: 'Run fasting panel' });

      renderPage();

      expect(screen.getByRole('button', { name: /clear form/i })).toBeInTheDocument();
    });
  });

  // ── form populated from draft ─────────────────────────────────────────────

  describe('draft population', () => {
    it('populates the notes card with the draft notes value', () => {
      useCreateInHouseLabStore.getState().setDraft(ENCOUNTER_ID, { notes: 'Run fasting panel' });

      renderPage();

      const notesCard = screen.getByTestId('notes-card');
      expect(notesCard).toHaveAttribute('data-value', 'Run fasting panel');
    });
  });

  // ── Clear Form behaviour ──────────────────────────────────────────────────

  describe('Clear Form action', () => {
    it('clears the draft store when Clear Form is clicked', async () => {
      useCreateInHouseLabStore.getState().setDraft(ENCOUNTER_ID, { notes: 'Run fasting panel' });
      const user = userEvent.setup();

      renderPage();

      await user.click(screen.getByRole('button', { name: 'Clear Form' }));

      expect(useCreateInHouseLabStore.getState().hasDraft(ENCOUNTER_ID)).toBe(false);
    });

    it('resets the notes card value to empty string when Clear Form is clicked', async () => {
      useCreateInHouseLabStore.getState().setDraft(ENCOUNTER_ID, { notes: 'Run fasting panel' });
      const user = userEvent.setup();

      renderPage();

      // draft value shown before clearing
      expect(screen.getByTestId('notes-card')).toHaveAttribute('data-value', 'Run fasting panel');

      await user.click(screen.getByRole('button', { name: 'Clear Form' }));

      expect(screen.getByTestId('notes-card')).toHaveAttribute('data-value', '');
    });
  });
});
