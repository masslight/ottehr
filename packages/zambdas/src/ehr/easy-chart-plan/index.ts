// easy-chart-plan: a narrative in, guarded typed actions out. The model never writes; the client runs
// the actions through the regular chart endpoints.
//
// PHI: never logs the narrative, the chart or the model's answer. Envelope only.

import { APIGatewayProxyResult } from 'aws-lambda';
import { ChartPlanResponse, PlannedAction } from 'utils/lib/easy-chart/api';
import {
  buildChartStateSummary,
  buildNoteContextFromChart,
  chartedExamFindingLabels,
} from 'utils/lib/easy-chart/chart-state';
import { buildPrompt } from 'utils/lib/easy-chart/prompt';
import { buildResponseSchema } from 'utils/lib/easy-chart/schema';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { authorizeEasyChartRequest } from '../easy-chart-shared/authorize';
import { applyGuards } from '../easy-chart-shared/guards';
import { callModelForJson } from '../easy-chart-shared/model';
import { PlanModelResponseSchema } from '../easy-chart-shared/model-output';
import {
  buildNoteContext,
  describeChart,
  readChart,
  readEmCodes,
  readTemplates,
  readVisitContext,
} from '../easy-chart-shared/visit-context';
import { resolveSuggestedTemplate } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'easy-chart-plan';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, narrative, encounterId, providerEdits, dictation, patientStatus } = validateRequestParameters(input);

  await authorizeEasyChartRequest(input, encounterId, secrets, ZAMBDA_NAME);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  // The chart is read here rather than posted by the client, so the prompt sees every section and no
  // caller-controlled text reaches the model's instructions.
  const [visit, chart, practiceTemplates, emCodes] = await Promise.all([
    encounterId ? readVisitContext(oystehr, encounterId, ZAMBDA_NAME) : undefined,
    encounterId ? readChart(oystehr, m2mToken, encounterId) : undefined,
    readTemplates(oystehr, ZAMBDA_NAME),
    readEmCodes(oystehr, ZAMBDA_NAME),
  ]);
  const chartStateSummary = describeChart(buildChartStateSummary(chart), chartedExamFindingLabels(chart));
  const noteContext = buildNoteContext(buildNoteContextFromChart(chart));

  const prompt = buildPrompt({
    narrative,
    providerEdits,
    templates: practiceTemplates,
    patientLine: visit?.patientLine,
    // The chart wins; the caller's status only fills in when there is no encounter to read.
    patientStatus: visit?.patientStatus ?? patientStatus,
    chartStateSummary,
    noteContext,
  });
  console.log(
    `[${ZAMBDA_NAME}] prompt ${prompt.length} chars, narrative ${narrative.length} chars, ` +
      `edited narrative ${providerEdits?.edited.length ?? 0} chars`
  );

  const { parsed, usage, escalation } = await callModelForJson({
    prompt,
    wireSchema: buildResponseSchema(),
    responseSchema: PlanModelResponseSchema,
    secrets,
    logPrefix: ZAMBDA_NAME,
  });

  const {
    actions: guarded,
    rejected,
    triggers,
  } = await applyGuards(parsed.actions, {
    oystehr,
    narrative,
    editedNarrative: providerEdits?.edited,
    dictation,
    emCodes,
    chartStateText: chartStateSummary,
    // A resulted test on the chart ("Rapid strep — Positive") supports "streptococcal" as much as the
    // narrative does.
    etiologyEvidence: [narrative, chartStateSummary, noteContext, providerEdits?.edited].filter(Boolean).join(' '),
    logPrefix: ZAMBDA_NAME,
  });

  // A template is only suggested: the title is resolved to one of the practice's templates so the UI can
  // offer it, and a title that matches none is refused.
  const actions: PlannedAction[] = [];
  for (const action of guarded) {
    if (action.kind !== 'apply-template') {
      actions.push(action);
      continue;
    }
    const template = practiceTemplates ? resolveSuggestedTemplate(practiceTemplates, action) : undefined;
    if (!template) {
      rejected.push({
        kind: action.kind,
        display: action.display,
        reason: practiceTemplates
          ? `no template in this practice is titled like "${action.display ?? ''}"`
          : 'the practice template list could not be read, so no template could be suggested',
      });
      continue;
    }
    actions.push({ ...action, display: template.title, templateId: template.id });
  }

  console.log(
    `[${ZAMBDA_NAME}] planned=${actions.length} rejected=${rejected.length} escalated=${escalation.escalated} ` +
      `attempts=${escalation.attempts} triggers=${triggers
        .map((t) => `${t.trigger}:${t.fired}/${t.complied}`)
        .join(',')}`
  );
  console.log(`[${ZAMBDA_NAME}] plan shape: ${countByKind(actions)} | refused: ${countByKind(rejected)}`);

  const response: ChartPlanResponse = { actions, rejected, usage, escalation, triggers };
  return { statusCode: 200, body: JSON.stringify(response) };
});

/** `add-diagnosis×2, set-em-code`: kinds are not clinical content, so this is safe to log. */
function countByKind(items: { kind: string }[]): string {
  const counts = new Map<string, number>();
  for (const { kind } of items) counts.set(kind, (counts.get(kind) ?? 0) + 1);
  return [...counts].map(([kind, count]) => (count > 1 ? `${kind}×${count}` : kind)).join(', ') || '(none)';
}
