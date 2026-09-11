import {
  ChartSection,
  ChartSectionData,
  ChartSectionParams,
} from 'utils/lib/types/api/chart-data/chart-sections.types';
import { fetchChartResources } from './fetch';
import { aiChatSection } from './sections/ai-chat';
import { assessmentSection } from './sections/assessment';
import { encounterNotesSection } from './sections/encounter-notes';
import { examSection } from './sections/exam';
import { historySection } from './sections/history';
import { notesSection } from './sections/notes';
import { planSection } from './sections/plan';
import { screeningSection } from './sections/screening';
import { ChartClient, ChartSectionDefinition } from './types';

export const CHART_SECTION_DEFINITIONS: { [S in ChartSection]: ChartSectionDefinition<S> } = {
  encounterNotes: encounterNotesSection,
  history: historySection,
  screening: screeningSection,
  exam: examSection,
  assessment: assessmentSection,
  plan: planSection,
  notes: notesSection,
  aiChat: aiChatSection,
};

/** Reads one chart section: its searches in one wave, then its DTO mapping. */
export async function buildChartSection<S extends ChartSection>(
  client: ChartClient,
  encounterId: string,
  section: S,
  params: ChartSectionParams<S>
): Promise<ChartSectionData<S>> {
  const definition = CHART_SECTION_DEFINITIONS[section] as ChartSectionDefinition<S>;
  const fetched = await fetchChartResources(
    client.oystehr,
    encounterId,
    definition.requests(encounterId, params).map((request) => ({ owner: section, request })),
    [section]
  );
  return definition.build(
    { ...client, encounterId, patientId: fetched.patientId, encounter: fetched.encounter },
    fetched.byOwner[section],
    params
  );
}
