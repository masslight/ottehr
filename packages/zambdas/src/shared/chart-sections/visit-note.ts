import { Practitioner } from 'fhir/r4b';
import {
  progressNoteNoteTypes,
  telemedProgressNoteNoteTypes,
  vitalsObservationsRequest,
} from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  CHART_SECTIONS,
  ChartSection,
  ChartSectionData,
  ChartSectionParams,
} from 'utils/lib/types/api/chart-data/chart-sections.types';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { VisitNoteResponse } from 'utils/lib/types/api/chart-data/get-visit-note.types';
import { configLabRequestsForGetChartData, makeEncounterLabResults } from '../../ehr/lab/shared/labs';
import { encounterScopedSearch } from '../chart-data/search-requests';
import { fetchChartResources, fetchPatientAppointmentCount, OwnedRequest } from './fetch';
import { mapChartResources } from './map';
import { CHART_SECTION_DEFINITIONS } from './registry';
import { ChartClient, ChartSectionDefinition } from './types';

type ExtraOwner = 'vitals' | 'labs' | 'radiology' | 'practitioners';
type VisitNoteOwner = ChartSection | ExtraOwner;
const EXTRA_OWNERS: readonly ExtraOwner[] = ['vitals', 'labs', 'radiology', 'practitioners'];

export interface BuildVisitNoteOptions {
  /** Which note types the note shows; defaults to the in-person visit note's. */
  noteTypes?: NOTE_TYPE[];
}

const sectionParams = <S extends ChartSection>(section: S, noteTypes: NOTE_TYPE[]): ChartSectionParams<S> =>
  (section === 'notes' ? { types: noteTypes } : undefined) as ChartSectionParams<S>;

/**
 * Everything the visit note shows, read in one wave of concurrent batches: every chart section plus the
 * vitals, lab results, radiology orders and encounter practitioners. This is the one read behind
 * Review & Sign, the follow-up note, the visit note PDF and the discharge summary.
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
      request: encounterScopedSearch('Observation', encounterId, {
        _count: vitalsObservationsRequest._count as number,
        _sort: vitalsObservationsRequest._sort as string,
        _tag: vitalsObservationsRequest._tag as string,
      }),
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
  ];

  const [fetched, appointmentCount] = await Promise.all([
    fetchChartResources(client.oystehr, encounterId, requests, [...CHART_SECTIONS, ...EXTRA_OWNERS]),
    fetchPatientAppointmentCount(client.oystehr, encounterId),
  ]);
  const { encounter, patientId, byOwner } = fetched;
  const context = { ...client, encounterId, patientId, encounter };

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
    practitioners: byOwner.practitioners.filter((r): r is Practitioner => r.resourceType === 'Practitioner'),
    // More than one appointment means the patient has previous visits (the current appointment is one of them)
    patientHasPreviousVisits: appointmentCount > 1,
  };
}

export interface LegacyChartData {
  /** What the unscoped get-chart-data call returns. */
  chartData: GetChartDataResponse;
  /** What the progress-note field set returns (the in-person or the telemed one). */
  additionalChartData: GetChartDataResponse;
}

/**
 * Presents a visit note as the two get-chart-data responses the PDF and discharge-summary code was written
 * against, so the composers can switch reads without changing what they render. Goes away once those
 * composers read the visit note directly.
 */
export function visitNoteToLegacyChartData(
  note: VisitNoteResponse,
  { module }: { module: 'in-person' | 'telemed' }
): LegacyChartData {
  const { encounterNotes, history, screening, exam, assessment, plan, aiChat } = note;

  const chartData: GetChartDataResponse = {
    patientId: note.patientId,
    conditions: history.conditions,
    // The unscoped call searches current-medication only.
    medications: history.medications.filter((medication) => medication.type !== 'prescribed-medication'),
    allergies: history.allergies,
    surgicalHistory: history.surgicalHistory,
    examObservations: exam.examObservations,
    rosObservations: exam.rosObservations,
    cptCodes: assessment.cptCodes,
    instructions: plan.instructions,
    diagnosis: assessment.diagnosis,
    schoolWorkNotes: plan.schoolWorkNotes,
    observations: [...screening.observations, ...aiChat.observations],
    practitioners: [],
    aiChat: aiChat.aiChat,
    // Scalars the unscoped call picks up from its unfiltered Condition and Procedure searches.
    chiefComplaint: encounterNotes.chiefComplaint,
    historyOfPresentIllness: encounterNotes.historyOfPresentIllness,
    mechanismOfInjury: encounterNotes.mechanismOfInjury,
    ros: encounterNotes.ros,
    surgicalHistoryNote: encounterNotes.surgicalHistoryNote,
    emCode: assessment.emCode,
    procedures: assessment.procedures.length > 0 ? assessment.procedures : undefined,
    accident: encounterNotes.accident,
    patientInfoConfirmed: encounterNotes.patientInfoConfirmed,
    addToVisitNote: encounterNotes.addToVisitNote,
    addendumNote: encounterNotes.addendumNote,
    disposition: undefined,
    patientHasPreviousVisits: note.patientHasPreviousVisits,
  };

  const additionalChartData: GetChartDataResponse =
    module === 'in-person'
      ? {
          patientId: note.patientId,
          practitioners: note.practitioners,
          chiefComplaint: encounterNotes.chiefComplaint,
          reasonForVisit: encounterNotes.reasonForVisit,
          mechanismOfInjury: encounterNotes.mechanismOfInjury,
          historyOfPresentIllness: encounterNotes.historyOfPresentIllness,
          ros: encounterNotes.ros,
          accident: encounterNotes.accident,
          surgicalHistoryNote: encounterNotes.surgicalHistoryNote,
          medicalDecision: encounterNotes.medicalDecision,
          patientInfoConfirmed: encounterNotes.patientInfoConfirmed,
          addToVisitNote: encounterNotes.addToVisitNote,
          addendumNote: encounterNotes.addendumNote,
          episodeOfCare: history.episodeOfCare,
          prescribedMedications: plan.prescribedMedications,
          disposition: plan.disposition,
          notes: note.notes.notes,
          vitalsObservations: note.vitalsObservations,
          externalLabResults: note.externalLabResults,
          inHouseLabResults: note.inHouseLabResults,
          radiologyOrders: note.radiologyOrders,
          procedures: undefined,
        }
      : {
          patientId: note.patientId,
          practitioners: [],
          chiefComplaint: encounterNotes.chiefComplaint,
          ros: encounterNotes.ros,
          prescribedMedications: plan.prescribedMedications,
          disposition: plan.disposition,
          medicalDecision: encounterNotes.medicalDecision,
          surgicalHistoryNote: encounterNotes.surgicalHistoryNote,
          notes: note.notes.notes.filter((n) => telemedProgressNoteNoteTypes.includes(n.type)),
          vitalsObservations: note.vitalsObservations,
          patientInfoConfirmed: encounterNotes.patientInfoConfirmed,
          addToVisitNote: encounterNotes.addToVisitNote,
          addendumNote: encounterNotes.addendumNote,
          accident: undefined,
          procedures: undefined,
        };

  return { chartData, additionalChartData };
}
