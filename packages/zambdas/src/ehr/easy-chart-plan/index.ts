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
import { buildPrompt, PromptTailInput } from 'utils/lib/easy-chart/prompt';
import { buildResponseSchema } from 'utils/lib/easy-chart/schema';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { authorizeEasyChartRequest } from '../easy-chart-shared/authorize';
import { applyGuards } from '../easy-chart-shared/guards';
import { callModelForJson } from '../easy-chart-shared/model';
import { buildChartStateSummary, buildNoteContext, readVisitContext } from '../easy-chart-shared/visit-context';
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

  const tail: PromptTailInput = {
    narrative,
    templateTitles: params.templateTitles,
    patientLine: visit?.patientLine,
    // The CHART wins. A caller-supplied status is the fallback for the case where there was no encounter
    // to read at all (see CallerPatientStatus) — it must never override what the record says.
    patientStatus: visit?.patientStatus ?? params.patientStatus,
    chartStateSummary: buildChartStateSummary(params.chartState, params.chartedExamFindings),
    noteContext: buildNoteContext(params.noteContext),
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
  });

  console.log(
    `[${ZAMBDA_NAME}] planned=${actions.length} rejected=${rejected.length} escalated=${escalation.escalated} ` +
      `attempts=${escalation.attempts} triggers=${triggers
        .map((t) => `${t.trigger}:${t.fired}/${t.complied}`)
        .join(',')}`
  );

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
