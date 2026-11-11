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

const isGzip = (bytes: Uint8Array): boolean => bytes.length > 1 && bytes[0] === 0x1f && bytes[1] === 0x8b;

/** The report data file: gzip from the report workers (inflated here), or plain JSON from an older Task. */
export async function readReportDataBytes(bytes: Uint8Array): Promise<string> {
  if (!isGzip(bytes)) return new TextDecoder().decode(bytes);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}

export async function downloadReportData<T>(downloadUrl: string): Promise<T> {
  const response = await fetch(downloadUrl);
  if (!response.ok) {
    throw new Error(`Report data download failed: ${response.status}`);
  }
  return JSON.parse(await readReportDataBytes(new Uint8Array(await response.arrayBuffer()))) as T;
}

// Every 2 s, the first check 2 s after the start (a Task is never done sooner). Each check is a zambda call; polling
// every second would double them for ~0.5 s of average wait on reports that take 8–40 s.
const ADHOC_POLL_INTERVAL_MS = 2000;
const ADHOC_TASK_WORKER_TIMEOUT_MS = 900 * 1000;
const ADHOC_POLL_TIMEOUT_MS = ADHOC_TASK_WORKER_TIMEOUT_MS + 2 * 60 * 1000;

/** Polls an ad-hoc Task (data fetch or report generation) until it completes; throws when it fails or times out. */
export async function pollAdHocTask<S extends { status: string; error?: string }>(
  getStatus: () => Promise<S>,
  { failedMessage, timeoutMessage }: { failedMessage: string; timeoutMessage: string }
): Promise<S> {
  const deadline = Date.now() + ADHOC_POLL_TIMEOUT_MS;

  await new Promise((resolve) => setTimeout(resolve, ADHOC_POLL_INTERVAL_MS));

  while (Date.now() < deadline) {
    const status = await getStatus();

    if (status.status === 'completed') return status;

    if (status.status === 'failed') throw new Error(status.error || failedMessage);

    await new Promise((resolve) => setTimeout(resolve, ADHOC_POLL_INTERVAL_MS));
  }

  throw new Error(timeoutMessage);
}

export async function runAdHocReport<T>(oystehr: Oystehr, input: StartAdHocReportInput, zambdaId?: string): Promise<T> {
  const { taskId } = await startAdHocReport(oystehr, input, zambdaId);

  const status = await pollAdHocTask(() => getAdHocReportStatus(oystehr, taskId, zambdaId), {
    failedMessage: 'Report generation failed',
    timeoutMessage: 'Report timed out while waiting for data',
  });

  if (!status.downloadUrl) throw new Error('Report completed but produced no data file');

  return downloadReportData<T>(status.downloadUrl);
}
