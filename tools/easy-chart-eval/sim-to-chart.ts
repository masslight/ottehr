// Renders the simulated state as a `GetChartDataResponse`, so the harness describes the chart to the endpoints
// with the production functions (`buildChartStateSummary` and related helpers) instead of its own copy. Fields the
// simulator does not model are absent, `resourceId`s are synthetic, and removed items are dropped.

import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { SimFinalState } from './score-harvested';

const live = <T extends { removed?: boolean }>(items: T[]): T[] => items.filter((item) => !item.removed);

let nextId = 1;
const id = (): string => `sim-${nextId++}`;

/** Keys must match what `buildChartStateSummary` reads: a key it does not read is a section the model never sees. */
export function simStateToChartData(state: SimFinalState): GetChartDataResponse {
  const chart: Record<string, unknown> = {
    patientId: 'sim-patient',

    diagnosis: live(state.diagnoses).map((dx) => ({
      resourceId: id(),
      code: dx.code ?? '',
      display: dx.display,
      isPrimary: dx.isPrimary === true,
    })),

    allergies: live(state.allergies).map((item) => ({ resourceId: id(), name: item.display })),
    conditions: live(state.conditions).map((item) => ({ resourceId: id(), display: item.display })),
    medications: live(state.medications).map((item) => ({ resourceId: id(), name: item.display })),
    surgicalHistory: live(state.surgicalHistory).map((item) => ({ resourceId: id(), display: item.display })),
    episodeOfCare: live(state.hospitalizations).map((item) => ({ resourceId: id(), display: item.display })),

    cptCodes: live(state.cptCodes).map((cpt) => ({ resourceId: id(), code: cpt.code ?? '', display: cpt.display })),

    // The summary needs exam and ROS most: a reconciliation step names a charted normal back to remove it.
    examObservations: live(state.examObservations).map((obs) => ({
      resourceId: id(),
      field: obs.field,
      label: obs.label,
      value: true,
      ...(obs.components?.length
        ? { components: live(obs.components).map((c) => ({ code: c.code, label: c.label, value: true })) }
        : {}),
    })),
    rosObservations: live(state.rosObservations).map((obs) => ({
      resourceId: id(),
      field: obs.field,
      label: obs.label,
      value: true,
    })),

    instructions: state.instructions.map((text) => ({ resourceId: id(), text })),
    radiologyOrders: state.radiology.map((studyType) => ({ resourceId: id(), studyType })),
    procedures: state.procedures.map((procedureType) => ({ resourceId: id(), procedureType })),
    vitalsObservations: state.vitals.map((vital) => ({ resourceId: id(), field: vital.field, value: vital.display })),
  };

  // The chart holds one E&M code, so the last `set` wins.
  const em = [...state.emEvents].reverse().find((event) => event.type === 'set');
  if (em?.code) chart.emCode = { resourceId: id(), code: em.code, display: em.display ?? '' };

  if (state.disposition?.type || state.disposition?.text) {
    chart.disposition = { type: state.disposition.type, note: state.disposition.text };
  }

  // `noteText` uses the clinical names, but chart data stores the chief complaint under `historyOfPresentIllness`
  // and the HPI under `chiefComplaint` (see note-fields.ts); `buildNoteContextFromChart` swaps them back.
  const note = state.noteText;
  if (note.chiefComplaint?.text) chart.historyOfPresentIllness = { resourceId: id(), text: note.chiefComplaint.text };
  if (note.historyOfPresentIllness?.text)
    chart.chiefComplaint = { resourceId: id(), text: note.historyOfPresentIllness.text };
  if (note.mechanismOfInjury?.text) chart.mechanismOfInjury = { resourceId: id(), text: note.mechanismOfInjury.text };
  if (note.medicalDecision?.text) chart.medicalDecision = { resourceId: id(), text: note.medicalDecision.text };

  return chart as unknown as GetChartDataResponse;
}
