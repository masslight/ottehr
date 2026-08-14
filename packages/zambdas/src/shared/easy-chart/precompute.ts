// Ambient-scribe plan precompute: while the recording pipeline extracts fields from a transcript,
// run the easy-chart planner on the same transcript and cache the resulting plan as an extension
// on the transcript DocumentReference. The EHR client later compares its freshly-built chartState
// against the cached one and, on an exact match, executes the cached steps instead of a live
// planner call. Strictly best-effort: any failure here must never fail the recording pipeline.
import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Extension } from 'fhir/r4b';
import { buildEasyChartNoteContext, buildEasyChartStateSummary } from 'utils/lib/helpers/easy-chart-chart-state';
import { progressNoteChartDataRequestedFields } from 'utils/lib/helpers/visit-note/progress-note-chart-data-requested-fields.helper';
import { Secrets } from 'utils/lib/secrets';
import {
  EASY_CHART_PRECOMPUTED_PLAN_EXTENSION_URL,
  EASY_CHART_PRECOMPUTED_PLAN_VERSION,
  EasyChartPlannerOutput,
  EasyChartPrecomputedPlan,
} from 'utils/lib/types/data/easy-chart-agent.types';
import { getChartData } from '../../ehr/get-chart-data';
import { runEasyChartPlanner } from './planner-core';

// Pure payload → Extension shaping, split out so the cache contract round-trips in unit tests.
export function buildPrecomputedPlanExtension(chartState: string, plan: EasyChartPlannerOutput): Extension {
  const payload: EasyChartPrecomputedPlan = {
    v: EASY_CHART_PRECOMPUTED_PLAN_VERSION,
    chartState,
    steps: plan.steps,
    usage: plan.usage,
  };
  return { url: EASY_CHART_PRECOMPUTED_PLAN_EXTENSION_URL, valueString: JSON.stringify(payload) };
}

// Fetch the encounter's chart, build the same planner input the client would (chartState is the
// cache-equality key, so the fetch mirrors the client's fetchEasyChartData merge exactly), and run
// the planner. Resolves to the cache extension on success, undefined on skip or ANY failure —
// this function never rejects, so the caller can Promise.all it alongside the extraction call.
export async function precomputeEasyChartPlan(
  oystehr: Oystehr,
  m2mToken: string,
  encounterId: string,
  transcript: string,
  secrets: Secrets | null
): Promise<Extension | undefined> {
  try {
    const [noteFields, fullChart] = await Promise.all([
      getChartData(oystehr, m2mToken, encounterId, { ...progressNoteChartDataRequestedFields, vitalsObservations: {} }),
      getChartData(oystehr, m2mToken, encounterId),
    ]);
    const chartData = { ...fullChart.response, ...noteFields.response };
    // An E&M already on the chart means the note has been written: the client would mark this
    // send incremental and never consume a non-incremental cached plan — skip the LLM spend.
    if (chartData.emCode?.code) {
      console.log(`[easy-chart-precompute] skipped for encounter ${encounterId}: E&M code already charted`);
      return undefined;
    }
    // Lab orders live outside chartData (separate zambdas) and are omitted server-side: if the
    // client has orders at generate time its chartState differs and the cache correctly misses.
    const chartState = buildEasyChartStateSummary(chartData, []);
    const noteContext = buildEasyChartNoteContext(chartData);
    const plan = await runEasyChartPlanner(
      { narrative: transcript, noteContext, chartState, encounterId, incremental: false },
      oystehr,
      secrets
    );
    console.log(`[easy-chart-precompute] stored plan (${plan.steps.length} steps) for encounter ${encounterId}`);
    return buildPrecomputedPlanExtension(chartState, plan);
  } catch (e) {
    console.warn(`[easy-chart-precompute] failed for encounter ${encounterId}; proceeding without cached plan:`, e);
    captureException(e);
    return undefined;
  }
}
