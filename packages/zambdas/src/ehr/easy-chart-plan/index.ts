// easy-chart-plan — narrative → typed actions.
//
// ONE planning endpoint, not two. The first implementation split "single command" from "full
// narrative", and the single-command endpoint returned exactly ONE action. The message
// `patient is 5'8", weighs 130lb` is 30 characters and one sentence, so a length/sentence heuristic
// routed it there and ONE OF THE TWO VITALS WAS SILENTLY DROPPED. One endpoint that always returns a
// list of 1..N actions removes the heuristic and the entire failure class.
//
// PHI: this handler never logs a model response body, a narrative, a transcript, or the contents of
// a FHIR bundle. For this feature the candidates ARE the generated note. Envelope only.

import { APIGatewayProxyResult } from 'aws-lambda';
import { ChartPlanResponse, PlannedAction } from 'utils/lib/easy-chart/api';
import {
  buildChartStateSummary,
  buildNoteContextFromChart,
  chartedExamFindingLabels,
} from 'utils/lib/easy-chart/chart-state';
import { buildPrompt, PromptTailInput } from 'utils/lib/easy-chart/prompt';
import { buildResponseSchema } from 'utils/lib/easy-chart/schema';
import { progressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { authorizeEasyChartRequest } from '../easy-chart-shared/authorize';
import { applyGuards } from '../easy-chart-shared/guards';
import { callModelForJson } from '../easy-chart-shared/model';
import {
  buildNoteContext,
  describeChart,
  readTemplateTitles,
  readVisitContext,
} from '../easy-chart-shared/visit-context';
import { getChartData } from '../get-chart-data';
import { buildHistoryDigest } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'easy-chart-plan';

// Lifted outside the handler so it survives warm invocations.
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  const { secrets, narrative, encounterId } = params;

  await authorizeEasyChartRequest(input, encounterId, secrets, ZAMBDA_NAME);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // Demographics come from the CHART, never from the narrative: an ambient recording contains
  // cross-talk about other patients, and letting the model infer age or sex from it charts the wrong
  // person's data.
  const visit = encounterId ? await readVisitContext(oystehr, encounterId, ZAMBDA_NAME) : undefined;

  // THE CHART IS READ HERE, NOT POSTED FROM THE BROWSER.
  //
  // It used to arrive as a prose summary the client assembled, which meant the prompt could only describe
  // the sections the client's own read layer happened to fetch — ROS, vitals and placed orders were
  // silently absent, so the model re-charted them — and the two sides drifted every time a field was added
  // on one of them. It also put caller-controlled text inside the model's instructions.
  //
  // Two calls, the same pair the visit-note PDF uses (assemble-progress-note-input.ts): the unscoped one
  // for the default set, the scoped one for fields get-chart-data only fetches when named.
  const [chart, templateTitles] = await Promise.all([
    encounterId ? readChart(oystehr, m2mToken, encounterId) : undefined,
    readTemplateTitles(oystehr, ZAMBDA_NAME),
  ]);

  const tail: PromptTailInput = {
    narrative,
    templateTitles: templateTitles ?? params.templateTitles,
    patientLine: visit?.patientLine,
    // The CHART wins. A caller-supplied status is the fallback for the case where there was no encounter
    // to read at all (see CallerPatientStatus) — it must never override what the record says.
    patientStatus: visit?.patientStatus ?? params.patientStatus,
    // Server-read chart first; the caller-supplied fallback is for a request with no encounter to read —
    // the eval harness runs that way on purpose, against an empty chart.
    chartStateSummary: chart
      ? describeChart(buildChartStateSummary(chart), chartedExamFindingLabels(chart))
      : describeChart(params.chartState, params.chartedExamFindings),
    noteContext: buildNoteContext(chart ? buildNoteContextFromChart(chart) : params.noteContext),
    historyDigest: buildHistoryDigest(params.history),
    incremental: params.incremental,
  };
  const prompt = buildPrompt('plan', tail);
  console.log(`[${ZAMBDA_NAME}] prompt ${prompt.length} chars, narrative ${narrative.length} chars`);

  const { parsed, usage, escalation } = await callModelForJson(
    prompt,
    buildResponseSchema('plan'),
    secrets,
    ZAMBDA_NAME,
    (raw) => {
      const actions = (raw as { actions?: unknown })?.actions;
      if (!Array.isArray(actions)) throw new Error('response has no actions array');
      return actions as PlannedAction[];
    }
  );

  const { actions, rejected, triggers } = await applyGuards(parsed, {
    oystehr,
    narrative,
    chartedItems: [...(params.chartedExamFindings ?? []), ...splitChartState(params.chartState)],
    logPrefix: ZAMBDA_NAME,
    // Read by the primary-diagnosis invariant: on an addendum, an existing primary must not be usurped.
    incremental: params.incremental,
    // The planner sees the whole plan, so it is the only surface that can decide "this plan has no primary".
    promoteMissingPrimary: true,
  });

  console.log(
    `[${ZAMBDA_NAME}] planned=${actions.length} rejected=${rejected.length} escalated=${escalation.escalated} ` +
      `attempts=${escalation.attempts} triggers=${triggers
        .map((t) => `${t.trigger}:${t.fired}/${t.complied}`)
        .join(',')}`
  );
  // The SHAPE of the plan, always. Kinds and counts are not clinical content, and they answer most of the
  // questions you actually have when a run looks wrong: did the model emit a diagnosis at all, did it emit
  // three set-vitals or one, did apply-template fire. Reading the displays needs EASY_CHART_LOG_RESPONSE.
  console.log(
    `[${ZAMBDA_NAME}] plan shape: ${
      Object.entries(
        actions.reduce<Record<string, number>>((counts, action) => {
          counts[action.kind] = (counts[action.kind] ?? 0) + 1;
          return counts;
        }, {})
      )
        .map(([kind, count]) => (count > 1 ? `${kind}×${count}` : kind))
        .join(', ') || '(empty)'
    }`
  );
  // Refusals with their reasons. A guard's reason names the code or the field, never the narrative — this
  // is the log that tells you WHY a step the provider expected did not appear.
  for (const refusal of rejected) console.log(`[${ZAMBDA_NAME}] refused ${refusal.kind}: ${refusal.reason}`);

  const response: ChartPlanResponse = { actions, rejected, usage, escalation, triggers };
  return { statusCode: 200, body: JSON.stringify(response) };
});

/** The chart-state summary as individual lines, for the removal guard to match against. */
function splitChartState(chartState?: string): string[] {
  if (!chartState) return [];
  return chartState
    .split('\n')
    .map((line) => line.replace(/^[-•*]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * The chart as get-chart-data returns it: the default set, plus the fields it fetches only when named.
 * Scoped second — it is the authoritative source for every key it carries.
 */
async function readChart(
  oystehr: ReturnType<typeof createClinicalOystehrClient>,
  token: string,
  encounterId: string
): Promise<Awaited<ReturnType<typeof getChartData>>['response']> {
  const [base, scoped] = await Promise.all([
    getChartData(oystehr, token, encounterId),
    getChartData(oystehr, token, encounterId, progressNoteChartDataRequestedFields),
  ]);
  return { ...base.response, ...scoped.response };
}
