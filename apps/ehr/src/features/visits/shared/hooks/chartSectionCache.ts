import { hashKey, QueryClient, QueryKey } from '@tanstack/react-query';
import { CHART_SECTION_QUERY_KEY, QUERY_STALE_TIME, VISIT_NOTE_QUERY_KEY } from 'src/constants';
import { progressNoteNoteTypes } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import {
  CHART_SECTIONS,
  ChartSection,
  ChartSectionData,
  ChartSectionParams,
  FIELD_TO_SECTION,
  GetChartSectionRequest,
  NotesSectionData,
  NotesSectionParams,
} from 'utils/lib/types/api/chart-data/chart-sections.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { OystehrTelemedAPIClient } from '../api/oystehrApi';

/**
 * The chart's client cache has two kinds of entries per encounter:
 *
 *   ['visit-note', encounterId]                       the one read behind the visit (get-visit-note): it
 *                                                     loads every section at once and carries the fields
 *                                                     that are not sections (vitals, labs, radiology, ...);
 *   ['chart-section', encounterId, section, params]   one entry per section and option set (get-chart-section).
 *
 * The section entries are the single source of truth for section data. A visit-note read seeds them; a
 * screen that shows a section refreshes it on its own; a save patches or invalidates the section it changed,
 * after cancelling the reads in flight for it (cancelChartReads), so a read that started before the save
 * cannot land its older rows over the save.
 */

export const visitNoteQueryKey = (encounterId: string | undefined): QueryKey => [VISIT_NOTE_QUERY_KEY, encounterId];

/** Sorted keys and sorted string lists, so equivalent option sets share one cache entry. */
const normalizeParams = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    const items = value.map(normalizeParams);
    return items.every((item) => typeof item === 'string') ? [...(items as string[])].sort() : items;
  }
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce((sorted: Record<string, unknown>, key) => {
        const item = (value as Record<string, unknown>)[key];
        if (item !== undefined) sorted[key] = normalizeParams(item);
        return sorted;
      }, {});
  }
  return value;
};

/** The cache-key form of a section's params; `null` for a section that takes none. */
export const sectionParamsKey = (params: unknown): string | null =>
  params === undefined || params === null ? null : JSON.stringify(normalizeParams(params));

export const chartSectionQueryKey = <S extends ChartSection>(
  encounterId: string | undefined,
  section: S,
  params?: ChartSectionParams<S>
): QueryKey => [CHART_SECTION_QUERY_KEY, encounterId, section, sectionParamsKey(params)];

/** The prefix shared by every variant of a section (or, without a section, by every section of the encounter). */
export const chartSectionsQueryKey = (encounterId: string | undefined, section?: ChartSection): QueryKey =>
  section ? [CHART_SECTION_QUERY_KEY, encounterId, section] : [CHART_SECTION_QUERY_KEY, encounterId];

/** The option set the visit note reads each section with; its notes are the progress-note types. */
export const visitNoteSectionParams = <S extends ChartSection>(section: S): ChartSectionParams<S> =>
  (section === 'notes' ? { types: progressNoteNoteTypes } : undefined) as ChartSectionParams<S>;

export const readChartSectionParams = (queryKey: QueryKey): unknown => {
  const key = queryKey[3];
  return typeof key === 'string' ? JSON.parse(key) : undefined;
};

export async function fetchChartSection<S extends ChartSection>(
  apiClient: OystehrTelemedAPIClient,
  encounterId: string,
  section: S,
  params: ChartSectionParams<S>
): Promise<ChartSectionData<S>> {
  const request = { encounterId, section, params } as GetChartSectionRequest<S>;
  return (await apiClient.getChartSection(request)).data;
}

/**
 * If a visit-note read for the encounter is in flight, waits for it to finish: it seeds every section, so a
 * section read started in the same render must not ask for its data a second time. The initial yield lets the
 * rest of the render's observers subscribe first (children mount before their layout, so a section's fetch
 * would otherwise start before the visit note's).
 */
async function waitForVisitNoteInFlight(queryClient: QueryClient, encounterId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const cache = queryClient.getQueryCache();
  const visitNote = cache.find({ queryKey: visitNoteQueryKey(encounterId), exact: true });
  if (visitNote?.state.fetchStatus !== 'fetching') return;
  await new Promise<void>((resolve) => {
    const unsubscribe = cache.subscribe((event) => {
      if (event.query === visitNote && visitNote.state.fetchStatus !== 'fetching') {
        unsubscribe();
        resolve();
      }
    });
  });
}

/**
 * Reads one section entry: the seed a visit-note read in flight leaves in it when there is one, a fresh wider
 * notes list when the section allows it (deriveChartSectionFromCache), otherwise get-chart-section. Every
 * section observer reads through this, so a visit-note read and the section observers mounted around it cost
 * one request between them.
 */
export async function readChartSection<S extends ChartSection>(
  queryClient: QueryClient,
  apiClient: OystehrTelemedAPIClient,
  encounterId: string,
  section: S,
  params: ChartSectionParams<S>
): Promise<ChartSectionData<S>> {
  const queryKey = chartSectionQueryKey(encounterId, section, params);
  // A visit-note read that lands while this read is starting seeds this very entry; take that seed.
  const before = queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0;
  await waitForVisitNoteInFlight(queryClient, encounterId);
  const seeded = queryClient.getQueryState<ChartSectionData<S>>(queryKey);
  if (seeded?.data !== undefined && seeded.dataUpdatedAt > before) return seeded.data;
  // A notes list is a subset of a wider fresh list (the visit note's, on its pages): no read needed.
  const derived = deriveChartSectionFromCache(queryClient, encounterId, section, params);
  if (derived !== undefined) return derived;
  return fetchChartSection(apiClient, encounterId, section, params);
}

/** Writes each section of a freshly read visit note into its section entry, all stamped with the same time. */
export function seedChartSectionsFromVisitNote(
  queryClient: QueryClient,
  encounterId: string,
  note: VisitNoteResponse
): void {
  const updatedAt = Date.now();
  CHART_SECTIONS.forEach((section) => {
    queryClient.setQueryData(
      chartSectionQueryKey(encounterId, section, visitNoteSectionParams(section)),
      note[section],
      {
        updatedAt,
      }
    );
  });
}

/**
 * Cancels the reads in flight for a section's entries and for the encounter's visit note, whose seed writes
 * the same entries. Called before a write: a read that started before the save carries the rows the save
 * changed, and react-query would write them over the save when the read landed. Cancelling reverts each
 * entry to its state from before its read started, before this returns, so the write that follows lands on
 * that state; the cancelled visit-note read sees its abort signal and skips its seed.
 */
export function cancelChartReads(queryClient: QueryClient, encounterId: string, section: ChartSection): void {
  void queryClient.cancelQueries({ queryKey: chartSectionsQueryKey(encounterId, section) });
  void queryClient.cancelQueries({ queryKey: visitNoteQueryKey(encounterId), exact: true });
}

/**
 * Applies `update` to every cached variant of a section; the variant's own params are passed along. Reads in
 * flight for the section are cancelled first (cancelChartReads).
 */
export function patchChartSection<S extends ChartSection>(
  queryClient: QueryClient,
  encounterId: string,
  section: S,
  update: (previous: ChartSectionData<S>, params: ChartSectionParams<S>) => ChartSectionData<S>
): void {
  cancelChartReads(queryClient, encounterId, section);
  queryClient
    .getQueryCache()
    .findAll({ queryKey: chartSectionsQueryKey(encounterId, section) })
    .forEach((query) => {
      const previous = query.state.data as ChartSectionData<S> | undefined;
      if (previous === undefined) return;
      queryClient.setQueryData(
        query.queryKey,
        update(previous, readChartSectionParams(query.queryKey) as ChartSectionParams<S>)
      );
    });
}

/**
 * Refetches the given sections where they are shown and marks the visit note stale, so the next visit-note
 * page entry re-reads it. This is what a save or delete calls for the section(s) it changed.
 */
export async function invalidateChartSections(
  queryClient: QueryClient,
  encounterId: string | undefined,
  sections: readonly ChartSection[]
): Promise<void> {
  if (!encounterId || sections.length === 0) return;
  await Promise.all([
    ...[...new Set(sections)].map((section) =>
      queryClient.invalidateQueries({ queryKey: chartSectionsQueryKey(encounterId, section) })
    ),
    queryClient.invalidateQueries({ queryKey: visitNoteQueryKey(encounterId), refetchType: 'none' }),
  ]);
}

/** The sections the given chart fields live in (save-chart-data and delete-chart-data bodies are keyed by field). */
export const sectionsForChartFields = (fields: readonly (keyof GetChartDataResponse)[]): ChartSection[] => [
  ...new Set(fields.map((field) => FIELD_TO_SECTION[field]).filter((section): section is ChartSection => !!section)),
];

/**
 * Re-reads the whole chart of an encounter: the visit note is refetched where it is shown (re-seeding every
 * section), and every section entry is marked stale for the screens that read them directly.
 */
export async function invalidateChart(queryClient: QueryClient, encounterId: string | undefined): Promise<void> {
  if (!encounterId) return;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: chartSectionsQueryKey(encounterId), refetchType: 'none' }),
    queryClient.invalidateQueries({ queryKey: visitNoteQueryKey(encounterId) }),
  ]);
}

/** Marks the whole chart of an encounter stale without refetching anything (a screen change). */
export async function markChartStale(queryClient: QueryClient, encounterId: string | undefined): Promise<void> {
  if (!encounterId) return;
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: chartSectionsQueryKey(encounterId), refetchType: 'none' }),
    queryClient.invalidateQueries({ queryKey: visitNoteQueryKey(encounterId), refetchType: 'none' }),
  ]);
}

/**
 * The notes section is the one section whose option set selects a subset of its data: the server scopes each
 * note type on its own, so a list of some types is exactly the matching rows of a list of more types. That
 * lets a notes variant be served from a fresh superset (the visit note's list holds every progress-note type)
 * and lets a write to a subset be applied to its supersets too.
 */
export const notesVariantCovers = (superset: unknown, subset: unknown): boolean => {
  const wide = (superset as NotesSectionParams | undefined)?.types;
  const narrow = (subset as NotesSectionParams | undefined)?.types;
  return Array.isArray(wide) && Array.isArray(narrow) && narrow.every((type) => wide.includes(type));
};

const isFresh = (state: { dataUpdatedAt: number; isInvalidated: boolean; data?: unknown }): boolean =>
  state.data !== undefined && !state.isInvalidated && Date.now() - state.dataUpdatedAt < QUERY_STALE_TIME;

/**
 * A section variant's data derived from another, fresh cache entry when the section allows it (see
 * notesVariantCovers), or undefined when it has to be read.
 */
export function deriveChartSectionFromCache<S extends ChartSection>(
  queryClient: QueryClient,
  encounterId: string,
  section: S,
  params: ChartSectionParams<S>
): ChartSectionData<S> | undefined {
  if (section !== 'notes') return undefined;
  const types = (params as NotesSectionParams | undefined)?.types;
  if (!types) return undefined;
  const own = hashKey(chartSectionQueryKey(encounterId, section, params));
  // The most recently written fresh list of more types, never this variant's own entry.
  const superset = queryClient
    .getQueryCache()
    .findAll({ queryKey: chartSectionsQueryKey(encounterId, 'notes') })
    .filter(
      (query) =>
        hashKey(query.queryKey) !== own &&
        isFresh(query.state) &&
        notesVariantCovers(readChartSectionParams(query.queryKey), params)
    )
    .sort((a, b) => b.state.dataUpdatedAt - a.state.dataUpdatedAt)[0];
  if (!superset) return undefined;
  const data = superset.state.data as NotesSectionData;
  return { notes: data.notes.filter((note) => types.includes(note.type)) } as ChartSectionData<S>;
}
