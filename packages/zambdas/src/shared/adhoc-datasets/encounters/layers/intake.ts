import { Condition, Observation, QuestionnaireResponse } from 'fhir/r4b';
import { getPaperworkScreeningAnswer } from 'utils/lib/helpers/screening-questions/screening-questions-formatting.helper';
import { patientScreeningQuestionsConfig } from 'utils/lib/ottehr-config/screening-questions';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { ACCIDENT_TYPE_LABELS } from 'utils/lib/types/api/chart-data/chart-data.types';
import { makeAccidentDTOFromFhirResources } from '../../../chart-data';
import { defineEncounterLayer } from '../context';
import { paperworkAnswer, screeningAnswer } from '../helpers';

// Intake: ASQ, birth history, screening answers (chart and paperwork), accident, paperwork details.
export const intakeLayer = defineEncounterLayer<{
  observationsByEncounterId: Map<string, Observation[]>;
  paperworkQrByEncounterId: Map<string, QuestionnaireResponse>;
  encounterConditionsByEncounterId: Map<string, Condition[]>;
}>({
  id: 'intake',
  fetch: async (ctx) => {
    const [observationsByEncounterId, paperworkQrByEncounterId, encounterConditionsByEncounterId] = await Promise.all([
      ctx.shared.observations(),
      ctx.shared.paperwork(),
      ctx.shared.encounterConditions(),
    ]);
    return { observationsByEncounterId, paperworkQrByEncounterId, encounterConditionsByEncounterId };
  },
  map: (input, out) => {
    const { encounter } = input;
    const { observationsByEncounterId, paperworkQrByEncounterId, encounterConditionsByEncounterId } = out;
    const row: Partial<AdHocEncounterRow> = {};
    const obs = encounter.id ? observationsByEncounterId.get(encounter.id) ?? [] : [];
    const asqObs = obs.find((o) => o.meta?.tag?.some((t) => t.code === 'asq'));
    row.asqScreen = asqObs?.valueString || asqObs?.valueCodeableConcept?.coding?.[0]?.code || '';
    const birthHistory: string[] = [];

    for (const o of obs) {
      if (!o.meta?.tag?.some((t) => t.code?.includes('birth'))) continue;
      const label = o.code?.text || o.code?.coding?.[0]?.display;
      if (label) birthHistory.push(label);
    }

    row.birthHistory = birthHistory;
    const screeningAnswers: { question: string; answer: string }[] = [];

    // Newest first, so a re-answered question keeps its latest answer.
    const byNewest = [...obs].sort((a, b) =>
      (b.effectiveDateTime ?? b.meta?.lastUpdated ?? '').localeCompare(a.effectiveDateTime ?? a.meta?.lastUpdated ?? '')
    );

    for (const o of byNewest) {
      if (o.status === 'entered-in-error') continue;
      const entry = screeningAnswer(o);
      if (entry && !screeningAnswers.some((e) => e.question === entry.question)) screeningAnswers.push(entry);
    }
    row.screeningAnswers = screeningAnswers;
    row.screeningQuestions = screeningAnswers.map((e) => e.question);

    // The patient's answers in the intake paperwork, as the chart's patient column reads them.
    const paperwork = encounter.id ? paperworkQrByEncounterId.get(encounter.id) : undefined;

    const patientScreeningAnswers = paperwork
      ? patientScreeningQuestionsConfig.fields
          .filter((field) => field.existsInQuestionnaire)
          .flatMap((field) => {
            const answer = getPaperworkScreeningAnswer(field.fhirField, paperwork);
            return answer ? [{ question: field.question, answer }] : [];
          })
      : [];

    row.patientScreeningAnswers = patientScreeningAnswers;
    row.patientScreeningQuestions = patientScreeningAnswers.map((e) => e.question);

    // The chart's accident record (the latest accident Condition of the visit), labelled as the visit note prints it.
    const accident = makeAccidentDTOFromFhirResources(
      encounter.id ? encounterConditionsByEncounterId.get(encounter.id) ?? [] : []
    );

    row.accidentTypes = (accident?.type ?? []).map((type) => ACCIDENT_TYPE_LABELS[type] ?? type);

    // Kept as it always was: the stored code of the first type ("AA" / "EM" / "OA") — saved reports filter on it.
    row.accidentType = accident?.type[0] ?? '';
    row.accidentDate = accident?.date || null;
    row.accidentState = accident?.state ?? '';

    // Paperwork details the visit shows: the person accompanying a minor (review tab) and the relay phone
    // (telemed footer), read as those components read them.
    const accompanyingFirst = paperworkAnswer(paperwork, 'person-accompanying-minor-first-name');
    const accompanyingLast = paperworkAnswer(paperwork, 'person-accompanying-minor-last-name');
    row.personAccompanyingMinor = [accompanyingFirst, accompanyingLast].filter(Boolean).join(' ');
    row.hearingImpairedRelayPhone = paperworkAnswer(paperwork, 'relay-phone');
    return row;
  },
});
