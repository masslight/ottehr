// How the studio reaches an Ottehr instance: zambdas only, never FHIR directly. Settings hold a
// zambda base url (the local zambda server, e.g. http://localhost:3005/local) and a bearer token the
// user pastes. The local server wraps a zambda's response as { status, output }, as Oystehr does.
import type { FhirResource } from 'fhir/r4b';
import type { AdHocReportStatus, StartAdHocReportResponse } from 'utils/lib/types/adhoc/generation/report-task';
import type { FetchPlanInput, FetchPlanParameters, RunFetchPlanOutput } from 'utils/lib/types/adhoc/plan/fetch-plan';
import type { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import type { ListAdHocReportsOutput } from 'utils/lib/types/adhoc/saved/saved.types';
import { useStudio } from '../state/store';

export class ZambdaError extends Error {
  constructor(
    public readonly zambda: string,
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ZambdaError';
  }
}

export const zambdaUrl = (base: string, name: string): string => `${base.replace(/\/+$/, '')}/zambda/${name}/execute`;

export async function executeZambda<T>(name: string, body: unknown): Promise<T> {
  const { zambdaBaseUrl, accessToken } = useStudio.getState().settings;
  if (!zambdaBaseUrl) throw new ZambdaError(name, 0, 'No zambda base URL is set (Settings → Instance).');
  if (!accessToken) throw new ZambdaError(name, 0, 'No access token is set (Settings → Instance).');

  let response: Response;
  try {
    response = await fetch(zambdaUrl(zambdaBaseUrl, name), {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new ZambdaError(
      name,
      0,
      `Could not reach ${zambdaUrl(zambdaBaseUrl, name)} (${
        error instanceof Error ? error.message : String(error)
      }). ` + 'Is the local zambda server running on that port?'
    );
  }

  const text = await response.text();
  let parsed: unknown = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    // Not JSON — fall through with the raw text as the message.
  }
  const envelope = parsed as { status?: number; output?: unknown; message?: string } | string;
  const output = typeof envelope === 'object' && envelope !== null && 'output' in envelope ? envelope.output : parsed;

  if (!response.ok) {
    const message =
      (typeof output === 'object' &&
        output !== null &&
        ((output as { message?: string }).message ?? (output as { error?: string }).error)) ||
      (typeof envelope === 'object' && envelope !== null ? envelope.message : undefined) ||
      (typeof output === 'string' ? output : text.slice(0, 500));
    throw new ZambdaError(name, response.status, `${name} answered ${response.status}: ${message}`);
  }
  return output as T;
}

// Same cadence as the EHR builder (ADHOC_POLL_INTERVAL_MS in report-builder/query/dataset-query.ts).
const ADHOC_POLL_INTERVAL_MS = 2000;
const ADHOC_POLL_TIMEOUT_MS = 15 * 60 * 1000;
/** Gzip the Z3 file (measured 2026-10-14; see report-studio-task-path-2026-10-14.md). */
const FETCH_PLAN_GZIP = false;

/**
 * Every fetch runs as a background Task like the EHR builder's reports: `adhoc-report` creates the Task,
 * `sub-adhoc-report` runs the plan (timeout 900 s, not the 27 s http_auth ceiling) and writes a
 * RunFetchPlanOutput file to Z3; we poll for the pre-signed url.
 */
export async function runFetchPlan(
  plan: FetchPlanInput,
  dateRange: DateRange,
  parameters?: FetchPlanParameters
): Promise<RunFetchPlanOutput & { resources: Record<string, FhirResource[]> }> {
  const gzip = FETCH_PLAN_GZIP;
  const { taskId } = await executeZambda<StartAdHocReportResponse>('adhoc-report', {
    plan,
    dateRange,
    parameters,
    gzip,
  });
  const deadline = Date.now() + ADHOC_POLL_TIMEOUT_MS;
  let status: AdHocReportStatus | undefined;
  while (Date.now() < deadline) {
    status = await executeZambda<AdHocReportStatus>('adhoc-report', { taskId });
    if (status.status === 'completed' || status.status === 'failed') break;
    await new Promise((resolve) => setTimeout(resolve, ADHOC_POLL_INTERVAL_MS));
  }
  if (status?.status !== 'completed') {
    throw new ZambdaError('adhoc-report', 200, status?.error ?? 'The fetch timed out while waiting for data');
  }
  if (!status.downloadUrl) throw new ZambdaError('adhoc-report', 200, 'The fetch completed but produced no data file');
  const file = await fetch(status.downloadUrl);
  if (!file.ok)
    throw new ZambdaError('adhoc-report', file.status, `Downloading the fetched data answered ${file.status}`);
  const body = gzip && file.body ? file.body.pipeThrough(new DecompressionStream('gzip')) : file.body;
  return (await new Response(body).json()) as RunFetchPlanOutput & { resources: Record<string, FhirResource[]> };
}

export const listSavedReports = (): Promise<ListAdHocReportsOutput> =>
  executeZambda<ListAdHocReportsOutput>('list-adhoc-reports', {});
