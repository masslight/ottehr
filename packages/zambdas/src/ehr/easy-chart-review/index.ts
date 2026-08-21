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
import {
  buildChartStateSummary,
  buildNoteContextFromChart,
  chartedExamFindingLabels,
} from 'utils/lib/easy-chart/chart-state';
import { buildPrompt, PromptTailInput } from 'utils/lib/easy-chart/prompt';
import { buildReviewResponseSchema } from 'utils/lib/easy-chart/schema';
import { detectDispositionLanguage } from 'utils/lib/easy-chart/sniffers';
import { progressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { authorizeEasyChartRequest } from '../easy-chart-shared/authorize';
import { applyGuards } from '../easy-chart-shared/guards';
import { callModelForJson } from '../easy-chart-shared/model';
import { carrySwapPrimaryFromChartState } from '../easy-chart-shared/swap-primary';
import {
  buildNoteContext,
  describeChart,
  readTemplateTitles,
  readVisitContext,
} from '../easy-chart-shared/visit-context';
import { getChartData } from '../get-chart-data';
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

  // Read the chart here, not from the caller — same reason and same two calls as the planner. It matters
  // more on this surface: review's whole job is to compare the note AS WRITTEN against the narrative, so a
  // summary that omits a section is a section it cannot review.
  const [chart, templateTitles] = await Promise.all([
    encounterId ? readChart(oystehr, m2mToken, encounterId) : undefined,
    readTemplateTitles(oystehr, ZAMBDA_NAME),
  ]);
  // The block the removal guard and the primary carry-over match against. Server-read when there is an
  // encounter; the caller's string only when there is not.
  const chartStateText = chart ? buildChartStateSummary(chart) : params.chartState;
  const examFindings = chart ? chartedExamFindingLabels(chart) : params.chartedExamFindings;

  const tail: PromptTailInput = {
    narrative,
    templateTitles: templateTitles ?? params.templateTitles,
    patientLine: visit?.patientLine,
    patientStatus: visit?.patientStatus ?? params.patientStatus,
    chartStateSummary: describeChart(chartStateText, examFindings),
    noteContext: buildNoteContext(chart ? buildNoteContextFromChart(chart) : params.noteContext),
    // Deterministic disposition trigger. Left to the model's own judgement the check fired very
    // inconsistently — same corpus, no code change, coverage swung 53% → 36% → 35% — so the narrative is
    // scanned here and a hit with nothing charted becomes a must-address instruction. The model still
    // owns extraction and is told to decline when the match is not a disposition for THIS visit.
    mustAddress: buildDispositionInstruction(narrative, chartStateText),
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
  const chartedItems = [...(examFindings ?? []), ...splitChartState(chartStateText)];
  const guarded: ReviewSuggestion[] = [];
  const rejected: ChartReviewResponse['rejected'] = [];
  const triggers: ChartReviewResponse['triggers'] = [];

  for (const suggestion of parsed) {
    // A "diagnosis"/"coherence" card pairs remove-diagnosis with add-diagnosis, and the prompt requires the
    // add to restate the removed diagnosis's isPrimary. The model reliably omits it, and a missing flag
    // charts as SECONDARY — leaving the note with no primary whenever the swap replaced the primary one.
    carrySwapPrimaryFromChartState((suggestion.actions ?? []) as PlannedAction[], chartStateText);
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

/**
 * The forced disposition instruction, or undefined when there is nothing to force. Only fires when the
 * narrative states a disposition AND the chart state carries none — a hit on an already-charted
 * disposition would push the model to propose a duplicate.
 */
function buildDispositionInstruction(narrative: string, chartState: string | undefined): string | undefined {
  if (chartState && /^\s*-?\s*disposition\b/im.test(chartState)) return undefined;
  const match = detectDispositionLanguage(narrative);
  if (!match) return undefined;
  return (
    `The dictation states a disposition or follow-up plan ("${match.excerpt.trim()}") and none is charted. ` +
    'Address check 7 explicitly: either propose the set-disposition it supports, or say nothing about ' +
    'disposition if that phrase is not a plan for THIS visit.'
  );
}

/** Same pair the planner and the visit-note PDF use: default set, then the fields fetched only when named. */
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
