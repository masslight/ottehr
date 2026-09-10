/**
 * @vitest-environment jsdom
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import { MedicationDTO, NOTE_TYPE, NoteDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ChartSection } from 'utils/lib/types/api/chart-data/chart-sections.types';
import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { emptyVisitNote } from '../../../../../tests/component/helpers/emptyVisitNote';
import {
  chartSectionQueryKey,
  invalidateChart,
  markChartStale,
  seedChartSectionsFromVisitNote,
  visitNoteQueryKey,
} from './chartSectionCache';
import { applyLegacyChartPatch, readLegacyChartData, upsertObservation } from './legacyChartData';
import { useChartData } from './useChartData';
import { useChartSection } from './useChartSection';
import { useVisitNote } from './useVisitNote';

vi.mock('react-router-dom', () => ({
  useParams: vi.fn().mockReturnValue({ id: 'appointment-123' }),
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

// The exam and ROS stores are hydrated from the exam section by the compat hook; they are not under test.
vi.mock('../../telemed/hooks/useExamObservations', () => ({
  useExamObservations: () => ({ update: vi.fn() }),
}));
vi.mock('./useRosObservations', () => ({
  useRosObservations: () => ({ update: vi.fn() }),
}));

const ENCOUNTER_ID = 'encounter-123';

const covid = { resourceId: 'obs-covid', field: 'covid-symptoms', value: true };
const aiHpi = { resourceId: 'obs-ai', field: 'ai-history-of-present-illness', value: 'Sore throat.' };
const current: MedicationDTO = {
  resourceId: 'ms-1',
  id: 'm1',
  name: 'Albuterol',
  type: 'as-needed',
  status: 'active',
  intakeInfo: {},
};
const prescribed: MedicationDTO = {
  resourceId: 'ms-2',
  id: 'm2',
  name: 'Cetirizine',
  type: 'prescribed-medication',
  status: 'active',
  intakeInfo: {},
};
const intakeNote: NoteDTO = {
  resourceId: 'note-intake',
  type: NOTE_TYPE.INTAKE,
  text: 'intake',
  authorId: 'a',
  authorName: 'A',
  patientId: 'patient-1',
  encounterId: ENCOUNTER_ID,
};

const goldenNote = (): VisitNoteResponse =>
  emptyVisitNote({
    history: {
      allergies: [{ resourceId: 'allergy-1', name: 'Penicillin', current: true }],
      conditions: [],
      medications: [current, prescribed],
      inhouseMedications: [],
      surgicalHistory: [],
      episodeOfCare: [],
      birthHistory: [],
      practitioners: [],
    },
    screening: { observations: [covid] },
    aiChat: { aiChat: { documents: [], providers: [] }, observations: [aiHpi] },
    notes: { notes: [intakeNote] },
  } as unknown as Partial<VisitNoteResponse>);

const apiClient = {
  getVisitNote: vi.fn(),
  getChartSection: vi.fn(),
};

const createQueryClient = (): QueryClient =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

const wrapperFor =
  (queryClient: QueryClient) =>
  ({ children }: { children: ReactNode }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

const sectionCalls = (): ChartSection[] => apiClient.getChartSection.mock.calls.map((call) => call[0].section);

describe('the chart caches', () => {
  let note: VisitNoteResponse;
  let queryClient: QueryClient;

  beforeEach(async () => {
    vi.clearAllMocks();
    note = goldenNote();
    queryClient = createQueryClient();
    const { useOystehrAPIClient } = await import('./useOystehrAPIClient');
    vi.mocked(useOystehrAPIClient).mockReturnValue(apiClient as any);
    apiClient.getVisitNote.mockImplementation(async () => note);
    apiClient.getChartSection.mockImplementation(async ({ section }: { section: ChartSection }) => ({
      section,
      data: note[section],
    }));
  });

  it('reads the visit note once and serves every section mounted alongside it from that read', async () => {
    const { result } = renderHook(
      () => ({ visitNote: useVisitNote(), history: useChartSection('history'), exam: useChartSection('exam') }),
      { wrapper: wrapperFor(queryClient) }
    );

    await waitFor(() => expect(result.current.visitNote.data).toBeDefined());
    await waitFor(() => expect(result.current.history.data).toBeDefined());
    expect(result.current.history.data).toEqual(note.history);
    expect(result.current.exam.data).toEqual(note.exam);
    expect(result.current.visitNote.data?.history).toEqual(note.history);
    expect(apiClient.getVisitNote).toHaveBeenCalledTimes(1);
    expect(apiClient.getChartSection).not.toHaveBeenCalled();
  });

  it('reads a section on its own when no visit note is being read', async () => {
    const { result } = renderHook(() => useChartSection('notes', { params: { types: [NOTE_TYPE.INTAKE] } }), {
      wrapper: wrapperFor(queryClient),
    });

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(apiClient.getVisitNote).not.toHaveBeenCalled();
    expect(apiClient.getChartSection).toHaveBeenCalledTimes(1);
    expect(apiClient.getChartSection).toHaveBeenCalledWith({
      encounterId: ENCOUNTER_ID,
      section: 'notes',
      params: { types: [NOTE_TYPE.INTAKE] },
    });
  });

  it('presents the chart to useChartData in the legacy whole-chart shape', async () => {
    const { result } = renderHook(() => useChartData(), { wrapper: wrapperFor(queryClient) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const chartData = result.current.chartData!;
    expect(chartData.allergies).toEqual(note.history.allergies);
    // current medications only; prescriptions are the plan's
    expect(chartData.medications).toEqual([current]);
    // screening answers and AI suggestions in one list, as before
    expect(chartData.observations).toEqual([covid, aiHpi]);
    // no procedures reads as undefined, as before
    expect(chartData.procedures).toBeUndefined();
    expect(chartData.patientHasPreviousVisits).toBe(false);
  });

  it('routes a useChartData write to the section the field lives in, and refetches it only when asked', async () => {
    const { result } = renderHook(() => ({ chart: useChartData(), history: useChartSection('history') }), {
      wrapper: wrapperFor(queryClient),
    });
    await waitFor(() => expect(result.current.chart.chartData).toBeDefined());
    const added = { resourceId: 'allergy-2', name: 'Latex', current: true };

    act(() => {
      result.current.chart.setPartialChartData(
        { allergies: [...note.history.allergies, added] },
        { invalidateQueries: false }
      );
    });
    await waitFor(() => expect(result.current.history.data?.allergies).toEqual([...note.history.allergies, added]));
    expect(result.current.chart.chartData?.allergies).toEqual([...note.history.allergies, added]);
    // the prescription the unscoped shape never listed is kept
    act(() => {
      result.current.chart.setPartialChartData({ medications: [] }, { invalidateQueries: false });
    });
    await waitFor(() => expect(result.current.history.data?.medications).toEqual([prescribed]));
    expect(apiClient.getChartSection).not.toHaveBeenCalled();

    act(() => {
      result.current.chart.setPartialChartData({ allergies: [] });
    });
    await waitFor(() => expect(sectionCalls()).toEqual(['history']));
    expect(apiClient.getVisitNote).toHaveBeenCalledTimes(1);
  });

  it('writes a section from a screen into every reader of that section', async () => {
    const { result } = renderHook(
      () => ({
        chart: useChartData(),
        intakeNotes: useChartSection('notes', { params: { types: [NOTE_TYPE.INTAKE] } }),
      }),
      { wrapper: wrapperFor(queryClient) }
    );
    await waitFor(() => expect(result.current.intakeNotes.data).toBeDefined());
    // The intake list is its own option set, read on its own once the visit note has landed.
    expect(sectionCalls()).toEqual(['notes']);
    const saved = { ...intakeNote, resourceId: 'note-intake-2', text: 'second' };

    act(() => {
      result.current.intakeNotes.setSectionData((previous) => ({ notes: [saved, ...previous.notes] }));
    });
    await waitFor(() =>
      expect(result.current.intakeNotes.data?.notes.map((n) => n.resourceId)).toEqual(['note-intake-2', 'note-intake'])
    );
    // The visit note's own notes variant is a different option set: it is re-read rather than guessed at.
    await waitFor(() => expect(sectionCalls()).toEqual(['notes', 'notes']));
    expect(apiClient.getChartSection.mock.calls[1][0].params.types).toContain(NOTE_TYPE.INTAKE);
    expect(apiClient.getChartSection.mock.calls[1][0].params.types.length).toBeGreaterThan(1);
  });

  it('re-reads the whole chart in one call when asked to', async () => {
    const { result } = renderHook(() => ({ chart: useChartData(), history: useChartSection('history') }), {
      wrapper: wrapperFor(queryClient),
    });
    await waitFor(() => expect(result.current.chart.chartData).toBeDefined());
    note = { ...note, history: { ...note.history, allergies: [] } };

    await act(async () => {
      await invalidateChart(queryClient, ENCOUNTER_ID);
    });

    await waitFor(() => expect(result.current.history.data?.allergies).toEqual([]));
    expect(result.current.chart.chartData?.allergies).toEqual([]);
    expect(apiClient.getVisitNote).toHaveBeenCalledTimes(2);
    expect(apiClient.getChartSection).not.toHaveBeenCalled();
  });

  it('after a screen change, re-reads only the sections the next screen shows', async () => {
    const first = renderHook(() => useChartData(), { wrapper: wrapperFor(queryClient) });
    await waitFor(() => expect(first.result.current.chartData).toBeDefined());

    await act(async () => {
      await markChartStale(queryClient, ENCOUNTER_ID);
    });
    expect(apiClient.getVisitNote).toHaveBeenCalledTimes(1);
    expect(apiClient.getChartSection).not.toHaveBeenCalled();

    const next = renderHook(() => useChartSection('exam'), { wrapper: wrapperFor(queryClient) });
    await waitFor(() => expect(sectionCalls()).toEqual(['exam']));
    await waitFor(() => expect(next.result.current.isFetching).toBe(false));
    expect(apiClient.getVisitNote).toHaveBeenCalledTimes(1);
  });
});

describe('the legacy chart shape over the section caches', () => {
  const seed = (): QueryClient => {
    const queryClient = createQueryClient();
    queryClient.setQueryData(visitNoteQueryKey(ENCOUNTER_ID), goldenNote());
    seedChartSectionsFromVisitNote(queryClient, ENCOUNTER_ID, goldenNote());
    return queryClient;
  };

  it('splits a merged observations list back into screening answers and AI suggestions', () => {
    const queryClient = seed();
    const travel = { resourceId: 'obs-travel', field: 'travel-usa', value: 'No' };
    const touched = applyLegacyChartPatch(queryClient, ENCOUNTER_ID, { observations: [covid, travel, aiHpi] });
    expect(touched.sort()).toEqual(['aiChat', 'screening']);
    expect(queryClient.getQueryData(chartSectionQueryKey(ENCOUNTER_ID, 'screening'))).toEqual({
      observations: [covid, travel],
    });
    expect(queryClient.getQueryData(chartSectionQueryKey(ENCOUNTER_ID, 'aiChat'))).toMatchObject({
      observations: [aiHpi],
    });
    expect(readLegacyChartData(queryClient, ENCOUNTER_ID)?.observations).toEqual([covid, travel, aiHpi]);
  });

  it('keeps prescriptions when the current medications are replaced, and reads them back current-only', () => {
    const queryClient = seed();
    const replacement = { ...current, resourceId: 'ms-3', name: 'Salbutamol' };
    expect(applyLegacyChartPatch(queryClient, ENCOUNTER_ID, { medications: [replacement] })).toEqual(['history']);
    expect(queryClient.getQueryData(chartSectionQueryKey(ENCOUNTER_ID, 'history'))).toMatchObject({
      medications: [prescribed, replacement],
    });
    expect(readLegacyChartData(queryClient, ENCOUNTER_ID)?.medications).toEqual([replacement]);
  });

  it('turns a cleared list into an empty one and an absent procedures list into none', () => {
    const queryClient = seed();
    applyLegacyChartPatch(queryClient, ENCOUNTER_ID, { allergies: undefined, procedures: undefined });
    expect(queryClient.getQueryData(chartSectionQueryKey(ENCOUNTER_ID, 'history'))).toMatchObject({ allergies: [] });
    expect(queryClient.getQueryData(chartSectionQueryKey(ENCOUNTER_ID, 'assessment'))).toMatchObject({
      procedures: [],
    });
    expect(readLegacyChartData(queryClient, ENCOUNTER_ID)?.procedures).toBeUndefined();
  });

  it('writes note-level fields onto the visit note itself', () => {
    const queryClient = seed();
    expect(applyLegacyChartPatch(queryClient, ENCOUNTER_ID, { patientHasPreviousVisits: true })).toEqual([]);
    expect(queryClient.getQueryData<VisitNoteResponse>(visitNoteQueryKey(ENCOUNTER_ID))?.patientHasPreviousVisits).toBe(
      true
    );
    expect(readLegacyChartData(queryClient, ENCOUNTER_ID)?.patientHasPreviousVisits).toBe(true);
  });

  it('upserts an observation by field, replacing its value and note', () => {
    const queryClient = seed();
    expect(upsertObservation(queryClient, ENCOUNTER_ID, { ...covid, value: false, note: 'resolved' } as any)).toBe(
      'screening'
    );
    expect(
      upsertObservation(queryClient, ENCOUNTER_ID, { resourceId: 'obs-new', field: 'travel-usa', value: 'No' })
    ).toBe('screening');
    expect(queryClient.getQueryData(chartSectionQueryKey(ENCOUNTER_ID, 'screening'))).toEqual({
      observations: [
        { ...covid, value: false, note: 'resolved' },
        { resourceId: 'obs-new', field: 'travel-usa', value: 'No' },
      ],
    });
    expect(upsertObservation(queryClient, ENCOUNTER_ID, { ...aiHpi, value: 'Updated.' })).toBe('aiChat');
  });
});
