import { ClinicalImpression, Communication, Condition, DocumentReference, Procedure } from 'fhir/r4b';
import { AdHocEncounterRow, CHART_NOTE_TYPE_VALUES } from 'utils/lib/types/adhoc/datasets/encounters';
import { IN_PERSON_NOTE_ID, NOTE_TYPE } from 'utils/lib/types/api/chart-data/chart-data.types';
import {
  DISCHARGE_SUMMARY_CODE,
  PATIENT_EDUCATION_DOC_TYPE_CODE,
} from 'utils/lib/types/data/paperwork/paperwork.constants';
import { fetchScopedResources } from '../../../adhoc-report';
import { mapChartResources } from '../../../chart-sections/map';
import { defineEncounterLayer } from '../context';
import { ChartNoteType, hasDocRefTypeCode, indexByEncounter, noteRecordBase, stripEnc } from '../helpers';

// The visit's chart text: chief complaint, HPI, MDM, instructions, notes and addenda.
export const chartingLayer = defineEncounterLayer<{
  encounterConditionsByEncounterId: Map<string, Condition[]>;
  clinicalImpressionsByEncounterId: Map<string, ClinicalImpression[]>;
  communicationsByEncounterId: Map<string, Communication[]>;
  surgicalHistoryNotesByEncounterId: Map<string, Procedure[]>;
  docRefsByEncounterId: Map<string, DocumentReference[]>;
}>({
  id: 'charting',
  fetch: async (ctx) => {
    // The visit's Communications: patient instructions and the chart's provider notes (every NOTE_TYPE, addenda
    // included — the css-note tag), plus the surgical history note Procedure, as the chart sections read them.
    const [encounterConditionsByEncounterId, docRefsByEncounterId, clinicalImpressions, communications, surgicalNotes] =
      await Promise.all([
        ctx.shared.encounterConditions(),
        ctx.shared.docRefs(),
        fetchScopedResources<ClinicalImpression>(ctx.oystehr, 'ClinicalImpression', 'encounter', ctx.encRefs),
        fetchScopedResources<Communication>(ctx.oystehr, 'Communication', 'encounter', ctx.encRefs, [
          { name: '_tag', value: `patient-instruction,${IN_PERSON_NOTE_ID}` },
        ]),
        fetchScopedResources<Procedure>(ctx.oystehr, 'Procedure', 'encounter', ctx.encRefs, [
          { name: '_tag', value: 'surgical-history-note' },
        ]),
      ]);

    return {
      encounterConditionsByEncounterId,
      docRefsByEncounterId,
      clinicalImpressionsByEncounterId: indexByEncounter(clinicalImpressions, (c) => stripEnc(c.encounter?.reference)),
      communicationsByEncounterId: indexByEncounter(communications, (c) => stripEnc(c.encounter?.reference)),
      surgicalHistoryNotesByEncounterId: indexByEncounter(surgicalNotes, (p) => stripEnc(p.encounter?.reference)),
    };
  },
  map: (input, out) => {
    const { encounter } = input;
    const {
      encounterConditionsByEncounterId,
      clinicalImpressionsByEncounterId,
      communicationsByEncounterId,
      surgicalHistoryNotesByEncounterId,
      docRefsByEncounterId,
    } = out;
    if (!encounter.id) return {};
    const row: Partial<AdHocEncounterRow> = {};
    const chart = mapChartResources(
      encounter,
      [
        ...(encounterConditionsByEncounterId.get(encounter.id) ?? []),
        ...(clinicalImpressionsByEncounterId.get(encounter.id) ?? []),
        ...(communicationsByEncounterId.get(encounter.id) ?? []),
        ...(surgicalHistoryNotesByEncounterId.get(encounter.id) ?? []),
      ],
      encounter.id,
      { instructions: [], notes: [] }
    );

    const docs = docRefsByEncounterId.get(encounter.id) ?? [];
    row.chiefComplaint = chart.chiefComplaint?.text ?? '';
    row.historyOfPresentIllness = chart.historyOfPresentIllness?.text ?? '';

    // Read as the encounter-notes chart section reads it.
    row.chartReasonForVisit = encounter.extension?.find((e) => e.url === 'reason-for-visit')?.valueString ?? '';

    row.mechanismOfInjury = chart.mechanismOfInjury?.text ?? '';
    row.rosNote = chart.ros?.text ?? '';
    row.medicalDecision = chart.medicalDecision?.text ?? '';
    row.patientInstructions = (chart.instructions ?? []).map((i) => i.text ?? '').filter(Boolean);
    row.surgicalHistoryNote = chart.surgicalHistoryNote?.text ?? '';
    row.patientInfoConfirmed = chart.patientInfoConfirmed?.value === true;
    row.addendumNote = chart.addendumNote?.text ?? '';

    // Oldest first, as the chart lists notes.
    const notes = [...(chart.notes ?? [])].sort((a, b) => (a.lastUpdated ?? '').localeCompare(b.lastUpdated ?? ''));

    row.addenda = notes
      .filter((note) => note.type === NOTE_TYPE.ADDENDUM)
      .map((note) => ({ ...noteRecordBase(note), edited: !!note.edited, deleted: !!note.deleted }));

    row.addendumCount = row.addenda.filter((note) => !note.deleted).length;

    row.chartNotes = notes
      .filter(
        (note) =>
          !note.deleted &&
          note.type !== NOTE_TYPE.ADDENDUM &&
          (CHART_NOTE_TYPE_VALUES as readonly string[]).includes(note.type)
      )
      .map((note) => ({ type: note.type as ChartNoteType, ...noteRecordBase(note) }));

    row.chartNoteCount = row.chartNotes.length;
    row.dischargeSummaryCreated = docs.some((d) => hasDocRefTypeCode(d, DISCHARGE_SUMMARY_CODE));
    row.patientEducationCount = docs.filter((d) => hasDocRefTypeCode(d, PATIENT_EDUCATION_DOC_TYPE_CODE)).length;
    return row;
  },
});
