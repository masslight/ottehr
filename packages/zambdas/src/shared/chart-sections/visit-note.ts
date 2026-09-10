import { Practitioner } from 'fhir/r4b';
import {
  progressNoteNoteTypes,
  vitalsObservationsRequest,
} from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  CHART_SECTIONS,
  ChartSection,
  ChartSectionData,
  ChartSectionParams,
} from 'utils/lib/types/api/chart-data/chart-sections.types';
import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { configLabRequestsForGetChartData, makeEncounterLabResults } from '../../ehr/lab/shared/labs';
import { encounterScopedSearch } from '../chart-data/search-requests';
import { fetchChartResources, OwnedRequest } from './fetch';
import { mapChartResources } from './map';
import { CHART_SECTION_DEFINITIONS } from './registry';
import { ChartClient, ChartSectionDefinition } from './types';

type ExtraOwner = 'vitals' | 'labs' | 'radiology' | 'practitioners' | 'appointments';
type VisitNoteOwner = ChartSection | ExtraOwner;
const EXTRA_OWNERS: readonly ExtraOwner[] = ['vitals', 'labs', 'radiology', 'practitioners', 'appointments'];

export interface BuildVisitNoteOptions {
  /** Which note types the note shows; defaults to the in-person visit note's. */
  noteTypes?: NOTE_TYPE[];
}

const sectionParams = <S extends ChartSection>(section: S, noteTypes: NOTE_TYPE[]): ChartSectionParams<S> =>
  (section === 'notes' ? { types: noteTypes } : undefined) as ChartSectionParams<S>;

/**
 * Everything the visit note shows, read in one wave of concurrent batches: every chart section plus the
 * vitals, lab results, radiology orders, encounter practitioners and the patient's appointment count. This is
 * the one read behind Review & Sign, the follow-up note, the visit note PDF and the discharge summary.
 */
export async function buildVisitNote(
  client: ChartClient,
  encounterId: string,
  options: BuildVisitNoteOptions = {}
): Promise<VisitNoteResponse> {
  const noteTypes = options.noteTypes ?? progressNoteNoteTypes;

  const requests: OwnedRequest<VisitNoteOwner>[] = [
    ...CHART_SECTIONS.flatMap((section) =>
      (CHART_SECTION_DEFINITIONS[section] as ChartSectionDefinition<typeof section>)
        .requests(encounterId, sectionParams(section, noteTypes))
        .map((request) => ({ owner: section as VisitNoteOwner, request }))
    ),
    {
      owner: 'vitals',
      request: encounterScopedSearch('Observation', encounterId, vitalsObservationsRequest),
    },
    ...configLabRequestsForGetChartData(encounterId).map((request) => ({ owner: 'labs' as const, request })),
    {
      owner: 'radiology',
      // DocumentReference:related pulls in external orders' uploaded result files (they have no DiagnosticReport).
      request: encounterScopedSearch('ServiceRequest', encounterId, {
        _tag: 'radiology',
        _revinclude: ['DiagnosticReport:based-on', 'DocumentReference:related'],
      }),
    },
    {
      owner: 'practitioners',
      request: { method: 'GET', url: `/Practitioner?_has:Encounter:participant:_id=${encounterId}` },
    },
    {
      // How many appointments the patient has; more than one means they have been seen before.
      owner: 'appointments',
      request: {
        method: 'GET',
        url: `/Appointment?patient:Patient._has:Encounter:subject:_id=${encounterId}&_summary=count`,
      },
    },
  ];

  const fetched = await fetchChartResources(client.oystehr, encounterId, requests, [
    ...CHART_SECTIONS,
    ...EXTRA_OWNERS,
  ]);
  const { encounter, patientId, byOwner, totals } = fetched;
  const practitioners = byOwner.practitioners.filter((r): r is Practitioner => r.resourceType === 'Practitioner');
  const context = { ...client, encounterId, patientId, encounter, knownPractitioners: practitioners };

  const buildSection = <S extends ChartSection>(section: S): Promise<ChartSectionData<S>> =>
    (CHART_SECTION_DEFINITIONS[section] as ChartSectionDefinition<S>).build(
      context,
      byOwner[section],
      sectionParams(section, noteTypes)
    );

  const [encounterNotes, history, screening, exam, assessment, plan, notes, aiChat, labResults] = await Promise.all([
    buildSection('encounterNotes'),
    buildSection('history'),
    buildSection('screening'),
    buildSection('exam'),
    buildSection('assessment'),
    buildSection('plan'),
    buildSection('notes'),
    buildSection('aiChat'),
    makeEncounterLabResults([encounter, ...byOwner.labs], client.m2mToken, client.oystehr),
  ]);

  return {
    patientId,
    encounterNotes,
    history,
    screening,
    exam,
    assessment,
    plan,
    notes,
    aiChat,
    vitalsObservations:
      mapChartResources(encounter, byOwner.vitals, encounterId, { vitalsObservations: [] }).vitalsObservations ?? [],
    externalLabResults: labResults.externalLabResultConfig,
    inHouseLabResults: labResults.inHouseLabResultConfig,
    radiologyOrders:
      mapChartResources(encounter, byOwner.radiology, encounterId, { radiologyOrders: [] }).radiologyOrders ?? [],
    practitioners,
    // More than one appointment means the patient has previous visits (the current appointment is one of them)
    patientHasPreviousVisits: totals.appointments > 1,
  };
}
