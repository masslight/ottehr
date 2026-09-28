// easy-chart-review: reads the written note back against its narrative and returns suggestion cards,
// each a question for the provider plus the actions that would answer it. It never writes, and it is
// offered a narrower vocabulary than the planner: a corrector, not an author.
//
// PHI: never logs the narrative, the note or the model's answer. Envelope only.

import { APIGatewayProxyResult } from 'aws-lambda';
import { ChartReviewResponse, ReviewSuggestion } from 'utils/lib/easy-chart/api';
import {
  buildChartStateSummary,
  buildNoteContextFromChart,
  chartedExamFindingLabels,
} from 'utils/lib/easy-chart/chart-state';
import { buildPrompt } from 'utils/lib/easy-chart/prompt';
import { buildReviewResponseSchema } from 'utils/lib/easy-chart/schema';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { authorizeEasyChartRequest } from '../easy-chart-shared/authorize';
import { applyGuards, buildTriggerReports } from '../easy-chart-shared/guards';
import { createTerminologyIcdSearch } from '../easy-chart-shared/icd-search';
import { callModelForJson } from '../easy-chart-shared/model';
import { ModelSuggestionSchema, ReviewModelResponseSchema } from '../easy-chart-shared/model-output';
import {
  buildNoteContext,
  describeChart,
  readChart,
  readVisitContext,
  splitChartState,
} from '../easy-chart-shared/visit-context';
import {
  buildDispositionInstruction,
  carrySwapPrimaryFromChartState,
  dropOrphanedRemovals,
  rosActionIsVerbatim,
  swapCancelsItself,
} from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'easy-chart-review';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const params = validateRequestParameters(input);
  const { secrets, narrative, encounterId } = params;

  await authorizeEasyChartRequest(input, encounterId, secrets, ZAMBDA_NAME);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // Same reads as the planner. The caller's chart fields are used only when there is no encounter.
  const [visit, chart] = await Promise.all([
    encounterId ? readVisitContext(oystehr, encounterId, ZAMBDA_NAME) : undefined,
    encounterId ? readChart(oystehr, m2mToken, encounterId) : undefined,
  ]);
  const chartStateText = chart ? buildChartStateSummary(chart) : params.chartState;
  const examFindings = chart ? chartedExamFindingLabels(chart) : params.chartedExamFindings;
  const noteContext = buildNoteContext(chart ? buildNoteContextFromChart(chart) : params.noteContext);
  const mustAddress = buildDispositionInstruction(narrative, chartStateText);

  const prompt = buildPrompt('review', {
    narrative,
    patientLine: visit?.patientLine,
    patientStatus: visit?.patientStatus ?? params.patientStatus,
    chartStateSummary: describeChart(chartStateText, examFindings),
    noteContext,
    mustAddress,
  });
  console.log(`[${ZAMBDA_NAME}] prompt ${prompt.length} chars, narrative ${narrative.length} chars`);

  const { parsed, usage, escalation } = await callModelForJson({
    prompt,
    wireSchema: buildReviewResponseSchema(),
    responseSchema: ReviewModelResponseSchema,
    secrets,
    logPrefix: ZAMBDA_NAME,
  });

  const suggestions = parsed.suggestions.flatMap((item) => {
    const card = ModelSuggestionSchema.safeParse(item);
    return card.success ? [card.data] : [];
  });
  if (suggestions.length < parsed.suggestions.length) {
    console.log(`[${ZAMBDA_NAME}] dropped ${parsed.suggestions.length - suggestions.length} malformed suggestions`);
  }

  const chartedItems = [...(examFindings ?? []), ...splitChartState(chartStateText)];
  // One search function for the whole call: it carries the terminology cache the cards share.
  const icdSearch = createTerminologyIcdSearch(oystehr);
  const etiologyEvidenceBase = [narrative, chartStateText ?? '', noteContext ?? ''].join(' ');

  const rejected: ChartReviewResponse['rejected'] = [];
  const results = await Promise.all(
    suggestions.map(async (suggestion) => {
      const result = await applyGuards(suggestion.actions, {
        oystehr,
        surface: 'review',
        icdSearch,
        narrative,
        etiologyEvidence: `${etiologyEvidenceBase} ${suggestion.rationale ?? ''}`,
        chartedItems,
        logPrefix: ZAMBDA_NAME,
      });
      // The prompt asks for a verbatim quote behind a ROS negative, and the model still fabricates the
      // classic negatives for the complaint.
      const quoted = result.actions.filter((action) => {
        if (rosActionIsVerbatim(action, narrative)) return true;
        rejected.push({
          kind: action.kind,
          display: action.display,
          reason: `"${action.display}" is not something the dictation says, so it was not charted`,
        });
        return false;
      });
      carrySwapPrimaryFromChartState(quoted, chartStateText);
      return { suggestion, result, quoted };
    })
  );

  const guarded: ReviewSuggestion[] = [];
  for (const { suggestion, result, quoted } of results) {
    rejected.push(...result.rejected);
    const actions = dropOrphanedRemovals(suggestion.actions, quoted, rejected);
    // A card whose every action was refused has nothing left to offer.
    if (actions.length === 0) continue;
    if (swapCancelsItself(actions)) {
      rejected.push({
        kind: 'add-diagnosis',
        display: suggestion.question,
        reason: 'the replacement diagnosis resolved to the same code it would replace, so nothing changed',
      });
      continue;
    }
    guarded.push({ ...suggestion, actions });
  }

  // Compliance is a property of the whole response, so the triggers are computed over every card.
  const triggers = buildTriggerReports(
    narrative,
    guarded.flatMap((suggestion) => suggestion.actions)
  );
  const disposition = triggers.find((trigger) => trigger.trigger === 'disposition-language-without-disposition');
  if (disposition) {
    // On review the trigger only fires when nothing is charted yet (see buildDispositionInstruction); a
    // disposition card a guard dropped still answered it.
    disposition.fired = !!mustAddress;
    if (suggestions.some((suggestion) => suggestion.category === 'disposition')) disposition.complied = true;
  }

  console.log(
    `[${ZAMBDA_NAME}] suggestions=${guarded.length}/${parsed.suggestions.length} rejected=${rejected.length} ` +
      `escalated=${escalation.escalated} attempts=${escalation.attempts}`
  );

  const response: ChartReviewResponse = { suggestions: guarded, rejected, usage, escalation, triggers };
  return { statusCode: 200, body: JSON.stringify(response) };
});
