// How the studio reaches an Ottehr instance: zambdas only, never FHIR directly. Settings hold a
// zambda base url (the local zambda server, e.g. http://localhost:3005/local) and a bearer token the
// user pastes. The local server wraps a zambda's response as { status, output }, as Oystehr does.
import type { FhirResource } from 'fhir/r4b';
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

export async function runFetchPlan(
  plan: FetchPlanInput,
  dateRange: DateRange,
  parameters?: FetchPlanParameters
): Promise<RunFetchPlanOutput & { resources: Record<string, FhirResource[]> }> {
  const output = await executeZambda<RunFetchPlanOutput>('adhoc-fetch-plan', {
    plan,
    dateRange,
    parameters,
    inline: true,
  });
  if (output.resources) return { ...output, resources: output.resources as Record<string, FhirResource[]> };
  if (!output.downloadUrl)
    throw new ZambdaError('adhoc-fetch-plan', 200, 'The fetch returned neither resources nor a download url');
  const file = await fetch(output.downloadUrl);
  if (!file.ok)
    throw new ZambdaError('adhoc-fetch-plan', file.status, `Downloading the fetched data answered ${file.status}`);
  return { ...output, resources: (await file.json()) as Record<string, FhirResource[]> };
}

export const listSavedReports = (): Promise<ListAdHocReportsOutput> =>
  executeZambda<ListAdHocReportsOutput>('list-adhoc-reports', {});
