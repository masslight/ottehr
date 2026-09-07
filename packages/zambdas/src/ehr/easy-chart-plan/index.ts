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
import { Surface } from 'utils/lib/easy-chart/actions';
import { ChartPlanResponse, PlannedAction } from 'utils/lib/easy-chart/api';
import {
  buildChartStateSummary,
  buildNoteContextFromChart,
  chartedExamFindingLabels,
} from 'utils/lib/easy-chart/chart-state';
import { buildPrompt, PromptTailInput } from 'utils/lib/easy-chart/prompt';
import { capabilitiesForSurface } from 'utils/lib/easy-chart/registry';
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
import { buildHistoryDigest, TEMPLATE_RECONCILE_INSTRUCTION } from './helpers';
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
  //
  // THE TEMPLATE LIST GOES ONLY WHERE apply-template EXISTS. The prompt tail's empty-list branch already
  // says "none. Do NOT emit apply-template", so withholding the list is a HARDER constraint than telling
  // the model not to use one — there is no title left to name. Derived from the SURFACE rather than
  // hand-listed, so a stage that gains the capability gains the list with it and one that never had it
  // never sees the practice's 57 titles. Before this every stage got them, including `coding` and
  // `orders`, which cannot apply a template at all: the largest block in the tail, eight times a visit,
  // on calls that could do nothing with it.
  const surface: Surface = params.stage ?? 'plan';
  const templatesUsable = !params.reconcileTemplate && capabilitiesForSurface(surface).includes('apply-template');
  // Read ONCE, and only when something needs it — either to offer the list, or to check the applied title
  // against it. Reading it twice in separate branches added a serial round trip to exactly the stage
  // calls that withholding the list was meant to make cheaper.
  const [chart, practiceTitles] = await Promise.all([
    encounterId ? readChart(oystehr, m2mToken, encounterId) : undefined,
    templatesUsable || params.appliedTemplate ? readTemplateTitles(oystehr, ZAMBDA_NAME) : undefined,
  ]);
  const templateTitles = templatesUsable ? practiceTitles : undefined;
  // Named to the model only when the practice really has it: a caller-supplied string is not trusted into
  // the prompt, a title matched against the server's own list is.
  const appliedTemplate =
    params.appliedTemplate && (practiceTitles ?? []).includes(params.appliedTemplate)
      ? params.appliedTemplate
      : undefined;

  const tail: PromptTailInput = {
    narrative,
    // The caller-supplied fallback is dropped wherever the list is withheld, or the client could put back
    // exactly what the server just decided not to send.
    templateTitles: templatesUsable ? templateTitles ?? params.templateTitles : undefined,
    appliedTemplate,
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
    // Force-included rather than left to the model, for the same reason the review's disposition check is:
    // `incremental` tells it to chart only what is NEW, and reconciliation is the opposite instruction.
    // Composed here from the chart THIS zambda read — nothing caller-supplied reaches the prompt.
    mustAddress: params.reconcileTemplate ? TEMPLATE_RECONCILE_INSTRUCTION : undefined,
  };
  // The stage IS the surface: the vocabulary, the response schema and the action-shape prose all come
  // from the registry keyed on it, so a stage costs a preamble and its own rules and nothing else.
  const prompt = buildPrompt(surface, tail);
  console.log(`[${ZAMBDA_NAME}] prompt ${prompt.length} chars, narrative ${narrative.length} chars`);

  const { parsed, usage, escalation } = await callModelForJson(
    prompt,
    buildResponseSchema(surface),
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
    // ONLY where diagnoses are in the vocabulary. It is a whole-plan invariant — "the planner sees the
    // whole plan, so it is the only surface that can decide this plan has no primary" — and a stage that
    // cannot emit a diagnosis has no plan to judge. Asked of `findings` or `coding` it reasons about an
    // empty set; asked of `diagnoses`, which owns every diagnosis in the visit, it means what it always
    // meant.
    promoteMissingPrimary: capabilitiesForSurface(surface).includes('add-diagnosis'),
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
