// easy-chart-review — the automatic second look.
//
// Reads the note as WRITTEN back against the narrative it came from and returns SUGGESTIONS: each one a
// provider-facing question plus the actions that would answer it. It never writes. Requirements section 8
// governs what it checks; the checks themselves live in the shared prompt so the plan and review surfaces
// cannot drift apart in how an action is shaped.
//
// Why a separate endpoint from easy-chart-plan, when planning is deliberately ONE endpoint: this is not
// another way to chart a visit. Its input is a finished note, its output is proposals rather than a plan
// to execute, and it is offered a narrower slice of the vocabulary — a corrector, not an author.
//
// PHI: never logs a model response body, the narrative, or the note. Envelope only.

import { APIGatewayProxyResult } from 'aws-lambda';
import { ChartReviewResponse, PlannedAction, ReviewSuggestion } from 'utils/lib/easy-chart/api';
import { buildPrompt, PromptTailInput } from 'utils/lib/easy-chart/prompt';
import { buildReviewResponseSchema } from 'utils/lib/easy-chart/schema';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { authorizeEasyChartRequest } from '../easy-chart-shared/authorize';
import { applyGuards } from '../easy-chart-shared/guards';
import { callModelForJson } from '../easy-chart-shared/model';
import { buildChartStateSummary, buildNoteContext, readVisitContext } from '../easy-chart-shared/visit-context';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'easy-chart-review';

// Lifted outside the handler so it survives warm invocations.
let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  const { secrets, narrative, encounterId } = params;

  await authorizeEasyChartRequest(input, encounterId, secrets, ZAMBDA_NAME);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // The SAME patient block the planner gets. Without it the tail renders "PATIENT STATUS: unknown", the
  // prompt's documented fallback picks the established E&M family, and review overwrites a correct
  // new-patient code from the plan — measurably, in 7 of 11 harvested cases. The chart wins over the
  // caller for the same reason it does in the planner.
  const visit = encounterId ? await readVisitContext(oystehr, encounterId, ZAMBDA_NAME) : undefined;

  const tail: PromptTailInput = {
    narrative,
    templateTitles: params.templateTitles,
    patientLine: visit?.patientLine,
    patientStatus: visit?.patientStatus ?? params.patientStatus,
    chartStateSummary: buildChartStateSummary(params.chartState, params.chartedExamFindings),
    noteContext: buildNoteContext(params.noteContext),
  };
  const prompt = buildPrompt('review', tail);
  console.log(`[${ZAMBDA_NAME}] prompt ${prompt.length} chars, narrative ${narrative.length} chars`);

  const { parsed, usage, escalation } = await callModelForJson(
    prompt,
    // The SUGGESTION-CARD shape, not the bare action list: buildResponseSchema('review') returns
    // `{actions}`, which would tell the model to answer in a shape this handler does not parse.
    buildReviewResponseSchema(),
    secrets,
    ZAMBDA_NAME,
    (raw) => {
      const suggestions = (raw as { suggestions?: unknown })?.suggestions;
      if (!Array.isArray(suggestions)) throw new Error('response has no suggestions array');
      return suggestions as ReviewSuggestion[];
    }
  );

  // Every suggestion's actions go through the SAME guards the plan surface uses. A review that proposes a
  // hallucinated code or a removal targeting something not on the chart must be refused here, not trusted
  // because it came from the "corrector". Guarding per suggestion keeps each rejection attached to the
  // suggestion it belongs to.
  const chartedItems = [...(params.chartedExamFindings ?? []), ...splitChartState(params.chartState)];
  const guarded: ReviewSuggestion[] = [];
  const rejected: ChartReviewResponse['rejected'] = [];
  const triggers: ChartReviewResponse['triggers'] = [];

  for (const suggestion of parsed) {
    const result = await applyGuards((suggestion.actions ?? []) as PlannedAction[], {
      oystehr,
      narrative,
      chartedItems,
      logPrefix: ZAMBDA_NAME,
    });
    rejected.push(...result.rejected);
    // A suggestion whose every action was refused has nothing left to offer, so it is dropped rather than
    // shown as a question the provider cannot act on. The refusals still surface in `rejected`.
    if (result.actions.length > 0) {
      guarded.push({ ...suggestion, actions: result.actions });
    }
    // Triggers are computed per call against the same narrative; keep the first set only.
    if (triggers.length === 0) triggers.push(...result.triggers);
  }

  console.log(
    `[${ZAMBDA_NAME}] suggestions=${guarded.length}/${parsed.length} rejected=${rejected.length} ` +
      `escalated=${escalation.escalated} attempts=${escalation.attempts}`
  );

  const response: ChartReviewResponse = { suggestions: guarded, rejected, usage, escalation, triggers };
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
