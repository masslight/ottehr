import { BillingClaimsExportStatusResponse } from 'utils';

export const EXPORT_POLL_INTERVAL_MS = 2000;

export const EXPORT_POLL_TIMEOUT_MS = 15 * 60 * 1000;

const TERMINAL_STATUSES: BillingClaimsExportStatusResponse['status'][] = ['completed', 'failed'];

export async function pollExportTask({
  checkStatus,
  intervalMs = EXPORT_POLL_INTERVAL_MS,
  timeoutMs = EXPORT_POLL_TIMEOUT_MS,
}: {
  checkStatus: () => Promise<BillingClaimsExportStatusResponse>;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<BillingClaimsExportStatusResponse> {
  const attempts = Math.ceil(timeoutMs / intervalMs);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const status = await checkStatus();
    // Anything this build doesn't recognize counts as still running, so an unknown Task status
    // waits for the timeout rather than being reported as an outcome.
    if (TERMINAL_STATUSES.includes(status.status)) return status;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error('Export timed out');
}
