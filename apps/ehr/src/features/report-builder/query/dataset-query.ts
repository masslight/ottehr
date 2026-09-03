import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { StartAdHocReportInput } from 'utils/lib/types/adhoc/generation/report-task';
import { getAdHocReportStatus, startAdHocReport } from '../../../api/api';

export const toLocalYmd = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso);
  return dt.isValid ? dt.toFormat('yyyy-MM-dd') : null;
};

export const ADHOC_QUERY_STALE_MS = 5 * 60 * 1000;

export async function downloadReportData<T>(downloadUrl: string): Promise<T> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Report data download failed: ${response.status}`);
  }
  return (await response.json()) as T;
}

const ADHOC_POLL_INTERVAL_MS = 2000;
const ADHOC_POLL_TIMEOUT_MS = 15 * 60 * 1000;

export async function runAdHocReport<T>(oystehr: Oystehr, input: StartAdHocReportInput): Promise<T> {
  const { taskId } = await startAdHocReport(oystehr, input);
  const deadline = Date.now() + ADHOC_POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const status = await getAdHocReportStatus(oystehr, taskId);
    if (status.status === 'completed') {
      if (!status.downloadUrl) throw new Error('Report completed but produced no data file');
      return downloadReportData<T>(status.downloadUrl);
    }
    if (status.status === 'failed') throw new Error(status.error || 'Report generation failed');
    await new Promise((resolve) => setTimeout(resolve, ADHOC_POLL_INTERVAL_MS));
  }
  throw new Error('Report timed out while waiting for data');
}
