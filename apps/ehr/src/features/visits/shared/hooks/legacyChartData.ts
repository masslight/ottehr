import { QueryClient } from '@tanstack/react-query';
import { visitNoteToLegacyChartData } from 'utils/lib/helpers/visit-note/visit-note-to-chart-data.helper';
import { AiObservationField } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { MedicationDTO, ProcedureDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  CHART_SECTIONS,
  ChartSection,
  ChartSectionData,
  FIELD_TO_SECTION,
} from 'utils/lib/types/api/chart-data/chart-sections.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { ObservationDTO } from 'utils/lib/types/data/screening-questions/types';
import {
  chartSectionQueryKey,
  patchChartSection,
  sectionParamsKey,
  visitNoteQueryKey,
  visitNoteSectionParams,
} from './chartSectionCache';

/**
 * The bridge between the whole-chart shape `useChartData` consumers read and write (the unscoped
 * get-chart-data response) and the section cache entries that hold the data now. Reads assemble the shape
 * from the caches; writes route each field to its section, with the few fields whose legacy shape differs
 * from the section's handled explicitly.
 */

const AI_OBSERVATION_FIELDS = new Set<string>(Object.values(AiObservationField));
export const isAiObservation = (observation: ObservationDTO): boolean => AI_OBSERVATION_FIELDS.has(observation.field);

/** Fields that live on the visit note itself rather than in a section. */
const NOTE_LEVEL_FIELDS = new Set<keyof GetChartDataResponse>([
  'patientId',
  'patientHasPreviousVisits',
  'practitioners',
  'vitalsObservations',
  'externalLabResults',
  'inHouseLabResults',
  'radiologyOrders',
]);

/** The note as the caches hold it right now, or undefined while any part is missing. */
export function readVisitNoteFromCache(queryClient: QueryClient, encounterId: string): VisitNoteResponse | undefined {
  const note = queryClient.getQueryData<VisitNoteResponse>(visitNoteQueryKey(encounterId));
  if (!note) return undefined;
  const assembled: Record<string, unknown> = { ...note };
  for (const section of CHART_SECTIONS) {
    const data = queryClient.getQueryData<ChartSectionData>(
      chartSectionQueryKey(encounterId, section, visitNoteSectionParams(section))
    );
    if (data === undefined) return undefined;
    assembled[section] = data;
  }
  return assembled as unknown as VisitNoteResponse;
}

export const legacyChartDataFromVisitNote = (note: VisitNoteResponse): GetChartDataResponse =>
  visitNoteToLegacyChartData(note, { module: 'in-person' }).chartData;

export function readLegacyChartData(queryClient: QueryClient, encounterId: string): GetChartDataResponse | undefined {
  const note = readVisitNoteFromCache(queryClient, encounterId);
  return note ? legacyChartDataFromVisitNote(note) : undefined;
}

const isVisitNoteVariant = (section: ChartSection, params: unknown): boolean =>
  sectionParamsKey(params) === sectionParamsKey(visitNoteSectionParams(section));

/**
 * Writes a partial unscoped-shaped chart into the section caches and returns the sections it touched, so
 * the caller can decide whether to refetch them.
 */
export function applyLegacyChartPatch(
  queryClient: QueryClient,
  encounterId: string,
  patch: Partial<GetChartDataResponse>
): ChartSection[] {
  const touched = new Set<ChartSection>();

  (Object.keys(patch) as (keyof GetChartDataResponse)[]).forEach((field) => {
    const value = patch[field];

    if (NOTE_LEVEL_FIELDS.has(field)) {
      queryClient.setQueryData<VisitNoteResponse>(visitNoteQueryKey(encounterId), (previous) =>
        previous ? { ...previous, [field]: value } : previous
      );
      return;
    }

    const section = FIELD_TO_SECTION[field];
    if (!section) return;
    touched.add(section);

    switch (field) {
      case 'medications':
        // The unscoped shape lists current medications only; the section also carries the prescribed ones.
        patchChartSection(queryClient, encounterId, 'history', (previous) => ({
          ...previous,
          medications: [
            ...previous.medications.filter((medication) => medication.type === 'prescribed-medication'),
            ...((value as MedicationDTO[] | undefined) ?? []),
          ],
        }));
        break;
      case 'observations': {
        // The unscoped shape lists screening answers and AI suggestions together.
        const observations = (value as ObservationDTO[] | undefined) ?? [];
        patchChartSection(queryClient, encounterId, 'screening', (previous) => ({
          ...previous,
          observations: observations.filter((observation) => !isAiObservation(observation)),
        }));
        patchChartSection(queryClient, encounterId, 'aiChat', (previous) => ({
          ...previous,
          observations: observations.filter(isAiObservation),
        }));
        touched.add('aiChat');
        break;
      }
      case 'procedures':
        // The unscoped shape leaves procedures undefined when there are none.
        patchChartSection(queryClient, encounterId, 'assessment', (previous) => ({
          ...previous,
          procedures: (value as ProcedureDTO[] | undefined) ?? [],
        }));
        break;
      case 'notes':
        patchChartSection(queryClient, encounterId, 'notes', (previous, params) =>
          isVisitNoteVariant('notes', params)
            ? { ...previous, notes: (value as GetChartDataResponse['notes']) ?? [] }
            : previous
        );
        break;
      default:
        patchChartSection(queryClient, encounterId, section, (previous) => {
          const current = (previous as Record<string, unknown>)[field];
          // List fields are never missing on a section; a cleared list is an empty one.
          return { ...previous, [field]: Array.isArray(current) ? value ?? [] : value };
        });
    }
  });

  return [...touched];
}

/** Replaces the observation of the same field (value and note) or appends it; returns the section written. */
export function upsertObservation(
  queryClient: QueryClient,
  encounterId: string,
  observation: ObservationDTO
): ChartSection {
  const section = isAiObservation(observation) ? 'aiChat' : 'screening';
  patchChartSection(queryClient, encounterId, section, (previous) => {
    const observations = [...previous.observations];
    const index = observations.findIndex((existing) => existing.field === observation.field);
    if (index !== -1 && 'value' in observation) {
      const existing = { ...observations[index] } as ObservationDTO & { note?: string };
      if (!('note' in observation) && 'note' in existing) delete existing.note;
      observations[index] = {
        ...existing,
        value: observation.value,
        ...('note' in observation && { note: observation.note }),
      } as ObservationDTO;
    } else {
      observations.push(observation);
    }
    return { ...previous, observations };
  });
  return section;
}
