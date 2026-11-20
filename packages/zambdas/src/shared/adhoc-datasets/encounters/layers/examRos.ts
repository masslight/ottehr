import { Observation } from 'fhir/r4b';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { mapResourceToChartDataResponse } from '../../../chart-data';
import { parseExamFieldsFromExamObservations } from '../../../pdf/sections/visit-note/examination';
import { defineEncounterLayer } from '../context';

// Review of systems and the examination, as the visit note reads them.
export const examRosLayer = defineEncounterLayer<{ observationsByEncounterId: Map<string, Observation[]> }>({
  id: 'examRos',
  fetch: async (ctx) => ({ observationsByEncounterId: await ctx.shared.observations() }),
  map: (input, out) => {
    const { encounter } = input;
    const { observationsByEncounterId } = out;
    const row: Partial<AdHocEncounterRow> = {};
    const obs = encounter.id ? observationsByEncounterId.get(encounter.id) ?? [] : [];

    const tagOf = (o: Observation, sys: string): string | undefined =>
      o.meta?.tag?.find((t) => t.system?.includes(sys))?.code;

    const rosFindings: string[] = [];
    const examSystems: string[] = [];
    const examFindings: string[] = [];

    for (const o of obs) {
      const rosTag = tagOf(o, 'ros-observation-field');
      if (rosTag && o.valueBoolean) {
        const state = rosTag.endsWith('-denies') ? 'Denies' : rosTag.endsWith('-reports') ? 'Reports' : '';
        const name = o.code?.text || o.code?.coding?.[0]?.display || rosTag;
        rosFindings.push(`${state} ${name}`.trim());
        continue;
      }
      // Mirror the ROS guard: a negated top-level exam statement (valueBoolean: false) is not a
      // charted finding and must not count. Observations without a top-level valueBoolean (the
      // component-carrying ones — makeExamObservationResource only sets it when the DTO value is
      // a boolean) still pass; their components are already filtered to positives at write time.
      if (tagOf(o, 'exam-observation-field') && o.valueBoolean !== false) {
        if (o.code?.text) examSystems.push(o.code.text);

        for (const c of o.component ?? []) {
          const code = c.code?.coding?.[0]?.code || c.code?.text;
          if (code) examFindings.push(code);
        }
      }
    }
    row.rosFindings = rosFindings;
    row.examSystems = Array.from(new Set(examSystems));
    row.examFindings = examFindings;

    // The visit note's examination section: findings per exam section with their abnormal flag, and
    // the provider's per-section comments.
    let examChart: GetChartDataResponse = { patientId: '', examObservations: [] };

    for (const o of obs) examChart = mapResourceToChartDataResponse(examChart, o, encounter.id ?? '').chartDataResponse;

    const examSections = Object.values(parseExamFieldsFromExamObservations(examChart).examination);

    row.examFindingDetails = examSections.flatMap((section) =>
      (section.items ?? []).map((item) => ({
        system: section.groupLabel,
        finding: item.label,
        abnormal: item.abnormal,
      }))
    );

    row.examAbnormalSystems = examSections
      .filter((section) => section.items?.some((item) => item.abnormal))
      .map((section) => section.groupLabel);

    row.examAbnormalFindingCount = row.examFindingDetails.filter((finding) => finding.abnormal).length;

    row.examComments = examSections
      .filter((section) => !!section.comment)
      .map((section) => ({ system: section.groupLabel, comment: section.comment ?? '' }));
    return row;
  },
});
