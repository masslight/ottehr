import { GetChartDataResponse } from '../../types/api/chart-data/get-chart-data.types';
import { VisitNoteResponse } from '../../types/api/chart-data/get-visit-note.types';
import { telemedProgressNoteNoteTypes } from './progress-note-chart-data-requested-fields.helper';

export interface LegacyChartData {
  /** The whole-chart shape: every list of the chart plus the visit's single-valued fields. */
  chartData: GetChartDataResponse;
  /** What the progress-note field set returns (the in-person or the telemed one). */
  additionalChartData: GetChartDataResponse;
}

/**
 * Presents a visit note as the two whole-chart shapes the PDF composers, the discharge summary and
 * the EHR's `useChartData` consumers were written against, so they can switch reads without changing what
 * they render. Goes away once those readers use the sections directly.
 */
export function visitNoteToLegacyChartData(
  note: VisitNoteResponse,
  { module }: { module: 'in-person' | 'telemed' }
): LegacyChartData {
  const { encounterNotes, history, screening, exam, assessment, plan, aiChat } = note;

  const chartData: GetChartDataResponse = {
    patientId: note.patientId,
    conditions: history.conditions,
    // The whole-chart shape lists current medications only.
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
    // The visit's single-valued fields.
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
