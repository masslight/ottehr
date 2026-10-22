import Oystehr from '@oystehr/sdk';
import type { FhirResource } from 'fhir/r4b';
import { FetchMode, isDirectTimeout } from 'utils/lib/types/adhoc/plan/fetch-mode';
import type { RunFetchPlanInput, RunFetchPlanOutput } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { runAdHocFetchPlan } from '../../../api/api';
import { downloadReportData, runAdHocReport } from './dataset-query';

export type FetchedPlanData = RunFetchPlanOutput & { resources: Record<string, FhirResource[]> };

export type FetchPlanRequest = Pick<RunFetchPlanInput, 'plan' | 'dateRange' | 'parameters'>;

/**
 * The resources a plan fetched, through the shared runner on the server — the browser never searches FHIR
 * itself. `direct` is one adhoc-fetch-plan call (fast, but cut at the gateway's ceiling when deployed);
 * `task` is the background report Task, polled like the dataset reports. A direct call cut by the ceiling is
 * sent once more through the Task (`fellBack`, which pins that path on the report).
 */
export async function fetchPlanData(
  oystehr: Oystehr,
  input: FetchPlanRequest,
  mode: FetchMode
): Promise<{ data: FetchedPlanData; fellBack: boolean }> {
  if (mode === 'direct') {
    const startedAt = Date.now();
    try {
      return { data: await withResources(await runAdHocFetchPlan(oystehr, input)), fellBack: false };
    } catch (error) {
      if (!isDirectTimeout(error, Date.now() - startedAt)) throw error;
    }
  }
  return { data: await runAdHocReport<FetchedPlanData>(oystehr, input), fellBack: mode === 'direct' };
}

// A direct answer carries the resources inline, or as a Z3 url when they were too large for one response.
async function withResources(output: RunFetchPlanOutput): Promise<FetchedPlanData> {
  if (output.resources) return output as FetchedPlanData;
  if (!output.downloadUrl) throw new Error('The report returned neither data nor a download url');
  return { ...output, resources: await downloadReportData<Record<string, FhirResource[]>>(output.downloadUrl) };
}
