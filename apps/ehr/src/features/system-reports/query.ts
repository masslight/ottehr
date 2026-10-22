import Oystehr from '@oystehr/sdk';
import { isDirectTimeout } from 'utils/lib/types/adhoc/plan/fetch-mode';
import type { RunSystemReportInput, RunSystemReportOutput } from 'utils/lib/types/adhoc/system/system-report';
import { getAdHocReportStatus, runSystemReport } from '../../api/api';
import { downloadReportData, pollAdHocTask } from '../report-builder/query/dataset-query';
import { FetchedPlanData, withResources } from '../report-builder/query/plan-query';

/**
 * The resources a system report's plan fetched. `run-system-report` answers inline (or with a Z3 url) when it
 * ran the plan directly, or with the Task it created for a long report, which is polled like the builder's
 * reports. A direct call cut by the gateway's time ceiling is sent once more: the zambda recorded the run's
 * timing on the report, so the retry goes through the Task.
 */
export async function fetchSystemReportData(oystehr: Oystehr, input: RunSystemReportInput): Promise<FetchedPlanData> {
  const startedAt = Date.now();
  let output: RunSystemReportOutput;
  try {
    output = await runSystemReport(oystehr, input);
  } catch (error) {
    if (!isDirectTimeout(error, Date.now() - startedAt)) throw error;
    output = await runSystemReport(oystehr, input);
  }

  if ('taskId' in output) {
    const status = await pollAdHocTask(() => getAdHocReportStatus(oystehr, output.taskId), {
      failedMessage: 'The report failed while fetching its data',
      timeoutMessage: 'The report timed out while waiting for data',
    });
    if (!status.downloadUrl) throw new Error('The report completed but produced no data file');
    return downloadReportData<FetchedPlanData>(status.downloadUrl);
  }
  return withResources(output);
}
