import Oystehr from '@oystehr/sdk';

type Param = { name: string; value: string };
type Manifest = {
  output?: { type: string; url: string }[];
  error?: { type: string; url: string }[];
  link?: { relation?: string; url?: string }[];
  requiresAccessToken?: boolean;
};
type JobStatus = { status: number; mode?: string; manifest?: Manifest; [key: string]: unknown };

/** The resource type and parameters of one batch entry url (`Type?name=value&…`, values raw). */
export function parseBatchEntryUrl(url: string): { resourceType: string; params: Param[] } {
  const [resourceType, query = ''] = url.split('?');
  const params = query
    .split('&')
    .filter(Boolean)
    .map((pair) => {
      const at = pair.indexOf('=');
      return { name: pair.slice(0, at), value: pair.slice(at + 1) };
    });
  return { resourceType, params };
}

/**
 * Gives a fake client whose `fhir.search(…, { mode: 'async-bulk' })` + `waitForAsyncJob` emulate one search
 * per job the batch-job API the ad-hoc fetch helpers use: a batch job runs each of its entries as the
 * fake's own async search (so `search` mocks still see every entry's parameters), and its manifest is the
 * entries' manifests joined.
 */
export function withAsyncBatch<T extends Oystehr>(fake: T): T {
  const fhir = (fake as unknown as { fhir: Record<string, unknown> }).fhir as {
    search: (
      params: { resourceType: string; params: Param[] },
      options?: { mode?: string }
    ) => Promise<{ jobId: string }>;
    waitForAsyncJob: (jobId: string, options?: unknown) => Promise<JobStatus>;
    batch?: unknown;
  };
  const singleWait = fhir.waitForAsyncJob.bind(fhir);
  const batches = new Map<string, string[]>();
  let next = 0;

  fhir.batch = async ({ requests }: { requests: { method: string; url: string }[] }) => {
    const jobIds: string[] = [];
    for (const request of requests) {
      const { resourceType, params } = parseBatchEntryUrl(request.url);
      jobIds.push((await fhir.search({ resourceType, params }, { mode: 'async-bulk' })).jobId);
    }
    const jobId = `batch-${++next}`;
    batches.set(jobId, jobIds);
    return { jobId, contentLocation: '', mode: 'bulk' };
  };

  fhir.waitForAsyncJob = async (jobId: string, options?: unknown): Promise<JobStatus> => {
    const entryJobs = batches.get(jobId);
    if (!entryJobs) return singleWait(jobId, options);

    const statuses = await Promise.all(entryJobs.map((id) => singleWait(id, options)));
    const failed = statuses.find((s) => s.status !== 200 || s.mode !== 'bulk');
    if (failed) return failed;

    const manifests = statuses.map((s) => s.manifest ?? {});
    return {
      status: 200,
      mode: 'bulk',
      manifest: {
        requiresAccessToken: true,
        output: manifests.flatMap((m) => m.output ?? []),
        error: manifests.flatMap((m) => m.error ?? []),
        link: manifests
          .flatMap((m) => m.link ?? [])
          .filter((l) => l.relation === 'next')
          .slice(0, 1),
      },
    };
  };

  return fake;
}
