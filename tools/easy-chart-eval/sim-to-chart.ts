// The simulated chart, rendered back into the shape the endpoints read.
//
// WHY THIS EXISTS. The plan and review zambdas describe "what is already on the chart" to the model with
// `buildChartStateSummary` / `chartedExamFindingLabels` / `buildNoteContextFromChart` — pure functions over
// a `GetChartDataResponse`. The harness has no persisted chart to hand them: its writer is a fake, so what
// the plan produced lives only in a `SimFinalState`. So it built its own summary by hand instead, and that
// copy had already drifted in the way copies do — it rendered seven section kinds and omitted exam
// findings, ROS, vitals, procedures, radiology, labs, instructions, surgical history and hospitalizations,
// where production renders all of them.
//
// Two things followed from that, and both made the eval measure the harness rather than the model:
//
//   - the review pass was told about a chart with no exam or ROS on it, so it could not name a finding to
//     correct even when the plan had charted a wrong one;
//   - `chartedExamFindings` was never sent at all, which leaves the server's `chartedItems` list EMPTY —
//     and `guardRemoval` refuses every removal against an empty chart with "the chart is empty, so there
//     was nothing to remove". Every `remove-*` the model proposed was rejected before it reached the
//     client. Reconciliation is removals, so none of it was measurable.
//
// Rendering to `GetChartDataResponse` and reusing the production functions is what stops that recurring:
// there is one description of a chart, and the harness cannot describe one differently from the endpoint.
//
// FIDELITY, HONESTLY. This is a projection, not a chart. Fields the simulator does not model are absent
// rather than invented, and `resourceId`s are synthetic — nothing here is read back by id. Removed items
// are dropped, because the point of the summary is what EXISTS now.

import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { SimFinalState } from './score-harvested';

/** Sim items carry a `removed` flag; the chart carries only what is still there. */
const live = <T extends { removed?: boolean }>(items: T[]): T[] => items.filter((item) => !item.removed);

let nextId = 1;
const id = (): string => `sim-${nextId++}`;

/**
 * Project the simulated state onto a chart-data response.
 *
 * Keys are chosen to match what `buildChartStateSummary` reads, section by section — a key it does not
 * read is a section the model will not be told about, which is exactly the failure this replaces.
 *
 * NOTE the CC↔HPI storage swap: `noteText` is keyed by the CLINICAL names the model uses, while chart data
 * stores the chief complaint under `historyOfPresentIllness` and the HPI under `chiefComplaint`. The
 * mapping is applied here so `buildNoteContextFromChart` — which undoes it — hands the model the same text
 * it would see in production, rather than the two fields swapped.
 */
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

    // Exam and ROS are the two the hand-rolled version omitted, and the two the summary most needs: a
    // reconciliation step names a charted normal back in order to remove it.
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

  // E&M is a scalar and the LAST `set` wins, mirroring how the chart holds one code.
  const em = [...state.emEvents].reverse().find((event) => event.type === 'set');
  if (em?.code) chart.emCode = { resourceId: id(), code: em.code, display: em.display ?? '' };

  if (state.disposition?.type || state.disposition?.text) {
    chart.disposition = { type: state.disposition.type, note: state.disposition.text };
  }

  // THE SWAP. `historyOfPresentIllness` in chart data holds the CHIEF COMPLAINT and vice versa — see the
  // note above, and note-fields.ts for the four independent confirmations of it.
  const note = state.noteText;
  if (note.chiefComplaint?.text) chart.historyOfPresentIllness = { resourceId: id(), text: note.chiefComplaint.text };
  if (note.historyOfPresentIllness?.text)
    chart.chiefComplaint = { resourceId: id(), text: note.historyOfPresentIllness.text };
  if (note.mechanismOfInjury?.text) chart.mechanismOfInjury = { resourceId: id(), text: note.mechanismOfInjury.text };
  if (note.medicalDecision?.text) chart.medicalDecision = { resourceId: id(), text: note.medicalDecision.text };

  return chart as unknown as GetChartDataResponse;
}
