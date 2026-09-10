/**
 * @vitest-environment jsdom
 */
/**
 * What opening Review & Sign costs in chart reads, measured with the real hooks in the composition the page
 * mounts them in: the layout, header, sidebar and navigation context around the page, the page's summary
 * containers, and the addendum list. The component tree here is synthetic — the real components need every
 * other API mocked — but each chart hook call below is the call the named real component makes, with the same
 * section and options. The API client records every zambda call.
 *
 * The FHIR cost behind each of these calls is measured in packages/zambdas/test/unit/review-and-sign-budget.test.ts.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, waitFor } from '@testing-library/react';
import { FC, ReactNode } from 'react';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ChartSection } from 'utils/lib/types/api/chart-data/chart-sections.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyVisitNote } from '../../../../../tests/component/helpers/emptyVisitNote';
import { invalidateChartSections } from './chartSectionCache';
import { useChartData } from './useChartData';
import { useChartSection } from './useChartSection';
import { useMarkChartStaleOnNavigate } from './useMarkChartStaleOnNavigate';
import { useVisitNote } from './useVisitNote';

const route = vi.hoisted(() => ({ pathname: '/in-person/appointment-123/review-and-sign' }));

vi.mock('react-router-dom', () => ({
  useParams: vi.fn().mockReturnValue({ id: 'appointment-123' }),
  useLocation: () => ({ pathname: route.pathname }),
}));

vi.mock('src/hooks/useEvolveUser', () => ({
  default: vi.fn().mockReturnValue({ id: 'user-123' }),
}));

vi.mock('./useOystehrAPIClient', () => ({
  useOystehrAPIClient: vi.fn(),
}));

vi.mock('../stores/appointment/appointment.store', () => ({
  useAppointmentData: vi.fn().mockReturnValue({ encounter: { id: 'encounter-123' } }),
}));

vi.mock('../../telemed/hooks/useExamObservations', () => ({
  useExamObservations: () => ({ update: vi.fn() }),
}));
vi.mock('./useRosObservations', () => ({
  useRosObservations: () => ({ update: vi.fn() }),
}));

const ENCOUNTER_ID = 'encounter-123';

const apiClient = {
  getVisitNote: vi.fn(),
  getChartSection: vi.fn(),
};

const sectionCalls = (): [ChartSection, unknown][] =>
  apiClient.getChartSection.mock.calls.map((call) => [call[0].section, call[0].params]);

// ── The composition of the in-person visit screens, hook for hook ────────────────────────────────────

/** InPersonLayout, Header and Sidebar: the whole-chart readers around every screen. */
const Layout: FC<{ children: ReactNode }> = ({ children }) => {
  useChartData({ shouldUpdateExams: true }); // InPersonLayout
  useMarkChartStaleOnNavigate(); // InPersonLayout
  useChartSection('aiChat', { enabled: false }); // InPersonLayout: the AI recording poll's refetch handle
  useChartData(); // Header
  useChartData(); // Sidebar
  return <NavigationContext>{children}</NavigationContext>;
};

/** InPersonNavigationContext: the intake-confirmation button labels. */
const NavigationContext: FC<{ children: ReactNode }> = ({ children }) => {
  useChartData();
  useChartSection('history');
  return <>{children}</>;
};

/** One Review & Sign summary reader (MissingCard, ProgressNoteDetails, the eleven note containers, the sign button). */
const NoteReader: FC = () => {
  useVisitNote();
  return null;
};

/** AddendumCard with its GenericNoteList: the list reads its own note type; the four note handlers share the entry. */
const AddendumList: FC = () => {
  useVisitNote(); // AddendumCard: the legacy single-string addendum
  useChartSection('notes', { params: { types: [NOTE_TYPE.ADDENDUM] } }); // useNoteHandlers
  useChartSection('notes', { appointmentId: 'appointment-123', params: { types: [NOTE_TYPE.ADDENDUM] } }); // useSaveNote
  useChartSection('notes', { appointmentId: 'appointment-123', params: { types: [NOTE_TYPE.ADDENDUM] } }); // useEditNote
  useChartSection('notes', { appointmentId: 'appointment-123', params: { types: [NOTE_TYPE.ADDENDUM] } }); // useDeleteNote
  useChartSection('notes', { appointmentId: 'appointment-123', params: { types: [NOTE_TYPE.ADDENDUM] } }); // useSoftDeleteNote
  return null;
};

const REVIEW_AND_SIGN_READERS = 14; // MissingCard, ProgressNoteDetails, 11 containers, ReviewAndSignButton

/** The ProgressNote page. */
const ReviewAndSign: FC = () => {
  useChartData();
  return (
    <>
      {Array.from({ length: REVIEW_AND_SIGN_READERS }, (_, index) => (
        <NoteReader key={index} />
      ))}
      <AddendumList />
    </>
  );
};

/** The Allergies screen: the history list plus its allergy notes list. */
const Allergies: FC = () => {
  useChartSection('history'); // useChartDataArrayValue('allergies')
  useChartSection('notes', { params: { types: [NOTE_TYPE.ALLERGY] } }); // AllergiesNotes → useNoteHandlers
  return null;
};

const App: FC<{ screen: 'review-and-sign' | 'allergies' }> = ({ screen }) => (
  <Layout>{screen === 'review-and-sign' ? <ReviewAndSign /> : <Allergies />}</Layout>
);

describe('Review & Sign load', () => {
  let queryClient: QueryClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    route.pathname = '/in-person/appointment-123/review-and-sign';
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
    const { useOystehrAPIClient } = await import('./useOystehrAPIClient');
    vi.mocked(useOystehrAPIClient).mockReturnValue(apiClient as any);
    const note = emptyVisitNote();
    apiClient.getVisitNote.mockImplementation(async () => note);
    apiClient.getChartSection.mockImplementation(async ({ section }: { section: ChartSection }) => ({
      section,
      data: note[section],
    }));
  });

  const settle = async (): Promise<void> => {
    // Section reads yield a macrotask before deciding; give every pending decision time to land.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  };

  const renderApp = (screen: 'review-and-sign' | 'allergies'): ReturnType<typeof render> =>
    render(
      <QueryClientProvider client={queryClient}>
        <App screen={screen} />
      </QueryClientProvider>
    );

  it('opening the visit on Review & Sign costs one visit-note read and one read for the addendum list', async () => {
    renderApp('review-and-sign');
    await waitFor(() => expect(apiClient.getVisitNote).toHaveBeenCalledTimes(1));
    await settle();

    expect(apiClient.getVisitNote).toHaveBeenCalledTimes(1);
    // The addendum list's note type is not part of the visit note's set, so it is the one section read.
    expect(sectionCalls()).toEqual([['notes', { types: [NOTE_TYPE.ADDENDUM] }]]);
  });

  it('coming back to Review & Sign from another screen re-reads the note and the addendum list, nothing else', async () => {
    const { rerender } = renderApp('review-and-sign');
    await waitFor(() => expect(apiClient.getVisitNote).toHaveBeenCalledTimes(1));
    await settle();
    apiClient.getVisitNote.mockClear();
    apiClient.getChartSection.mockClear();

    // The Allergies screen re-reads only what it shows: its history list (stale since the screen change) and
    // its own notes list. The whole-chart readers around it do not re-read the note.
    route.pathname = '/in-person/appointment-123/allergies';
    rerender(
      <QueryClientProvider client={queryClient}>
        <App screen="allergies" />
      </QueryClientProvider>
    );
    await settle();
    expect(apiClient.getVisitNote).not.toHaveBeenCalled();
    expect(sectionCalls().sort()).toEqual([
      ['history', undefined],
      ['notes', { types: [NOTE_TYPE.ALLERGY] }],
    ]);
    apiClient.getChartSection.mockClear();

    route.pathname = '/in-person/appointment-123/review-and-sign';
    rerender(
      <QueryClientProvider client={queryClient}>
        <App screen="review-and-sign" />
      </QueryClientProvider>
    );
    await waitFor(() => expect(apiClient.getVisitNote).toHaveBeenCalledTimes(1));
    await settle();
    expect(apiClient.getVisitNote).toHaveBeenCalledTimes(1);
    expect(sectionCalls()).toEqual([['notes', { types: [NOTE_TYPE.ADDENDUM] }]]);
  });

  it('a save on Review & Sign re-reads the one section it changed', async () => {
    renderApp('review-and-sign');
    await waitFor(() => expect(apiClient.getVisitNote).toHaveBeenCalledTimes(1));
    await settle();
    apiClient.getVisitNote.mockClear();
    apiClient.getChartSection.mockClear();

    // What saving the medical decision does after patching the cache with the server's answer.
    await act(async () => {
      await invalidateChartSections(queryClient, ENCOUNTER_ID, ['encounterNotes']);
    });
    await settle();
    expect(apiClient.getVisitNote).not.toHaveBeenCalled();
    expect(sectionCalls()).toEqual([['encounterNotes', undefined]]);
  });
});
