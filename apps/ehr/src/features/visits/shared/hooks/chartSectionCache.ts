import { QueryClient, QueryKey } from '@tanstack/react-query';
import { CHART_SECTION_QUERY_KEY, VISIT_NOTE_QUERY_KEY } from 'src/constants';
import { progressNoteNoteTypes } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import {
  CHART_SECTIONS,
  ChartSection,
  ChartSectionData,
  ChartSectionParams,
  FIELD_TO_SECTION,
  GetChartSectionRequest,
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
 * screen that shows a section refreshes it on its own; a save patches or invalidates the section it changed.
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

/** Applies `update` to every cached variant of a section; the variant's own params are passed along. */
export function patchChartSection<S extends ChartSection>(
  queryClient: QueryClient,
  encounterId: string,
  section: S,
  update: (previous: ChartSectionData<S>, params: ChartSectionParams<S>) => ChartSectionData<S>
): void {
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
