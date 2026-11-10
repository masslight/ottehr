import Oystehr from '@oystehr/sdk';
import { FhirResource, Practitioner } from 'fhir/r4b';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchScopedResources, IDS_PER_ENTRY } from '../src/shared/adhoc-report';

type Param = { name: string; value: string };

const practitioner = (id: string): Practitioner => ({ resourceType: 'Practitioner', id });
const ndjson = (resources: FhirResource[]): string => resources.map((resource) => JSON.stringify(resource)).join('\n');

const bodyByUrl = new Map<string, string>();

vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const body = bodyByUrl.get(String(input));
  if (body === undefined) return { ok: false, status: 404, text: async () => 'not found' };
  return { ok: true, status: 200, text: async () => body };
}) as unknown as typeof fetch);

afterAll(() => {
  vi.unstubAllGlobals();
});

type JobAnswer =
  | { status: 200; resources: FhirResource[]; next?: string; errorFile?: string }
  | { status: number; outcome?: unknown };

/** A fake async-bulk search: `answer` decides each job's result from its parameters. Every job's params are kept. */
function fakeClient(answer: (params: Param[], jobIndex: number) => JobAnswer): {
  oystehr: Oystehr;
  jobs: Param[][];
} {
  const jobs: Param[][] = [];
  const answers = new Map<string, JobAnswer>();

  const oystehr = {
    fhir: {
      search: vi.fn(async ({ params }: { resourceType: string; params: Param[] }, options: { mode?: string }) => {
        expect(options.mode).toBe('async-bulk');
        jobs.push(params);
        const jobId = `job-${jobs.length}`;
        answers.set(jobId, answer(params, jobs.length - 1));
        return { jobId, contentLocation: '', mode: 'bulk' };
      }),
      waitForAsyncJob: async (jobId: string) => {
        const result = answers.get(jobId)!;
        if (result.status !== 200 || !('resources' in result)) {
          return { status: result.status, outcome: 'outcome' in result ? result.outcome : undefined };
        }
        const url = `https://example.test/${jobId}.ndjson`;
        bodyByUrl.set(url, ndjson(result.resources));
        const error = result.errorFile
          ? [{ type: 'OperationOutcome', url: `https://example.test/${jobId}-error` }]
          : [];
        if (result.errorFile) bodyByUrl.set(error[0].url, result.errorFile);
        return {
          status: 200,
          mode: 'bulk',
          manifest: {
            requiresAccessToken: true,
            output: [{ type: 'Practitioner', url }],
            error,
            ...(result.next ? { link: [{ relation: 'next', url: result.next }] } : {}),
          },
        };
      },
    },
  } as unknown as Oystehr;

  return { oystehr, jobs };
}

const values = (params: Param[], name: string): string[] => params.filter((p) => p.name === name).map((p) => p.value);
const idsOf = (params: Param[]): string[] => values(params, '_id')[0]?.split(',') ?? [];
const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `p-${i}`);

describe('fetch helpers: one async-bulk job per search', () => {
  beforeEach(() => bodyByUrl.clear());

  it('runs one job per id chunk, each asking for _count=30000 with the extra params', async () => {
    const { oystehr, jobs } = fakeClient((params) => ({ status: 200, resources: idsOf(params).map(practitioner) }));

    const all = ids(IDS_PER_ENTRY * 2 + 10);
    const resources = await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', all, [
      { name: '_tag', value: 'a|1' },
      { name: '_elements', value: 'id,name' },
    ]);

    expect(resources.map((r) => r.id).sort()).toEqual([...all].sort());
    expect(jobs).toHaveLength(3);
    for (const params of jobs) {
      expect(values(params, '_count')).toEqual(['30000']);
      expect(values(params, '_tag')).toEqual(['a|1']);
      expect(values(params, '_elements')).toEqual(['id,name']);
      expect(idsOf(params).length).toBeLessThanOrEqual(IDS_PER_ENTRY);
    }
  });

  it('follows the manifest next link with the original query and one _count', async () => {
    const nextLink = (offset: number): string =>
      'https://fhir.example.test/Practitioner?_id=p-1%2Cp-2%2Cp-3&_tag=a%7C1&_tag=b%7C2' +
      `&_elements=id%2Cname&_count=30000&_offset=${offset}`;

    const { oystehr, jobs } = fakeClient((_params, index) =>
      index === 0
        ? { status: 200, resources: [practitioner('p-1')], next: nextLink(30000) }
        : index === 1
        ? { status: 200, resources: [practitioner('p-2')], next: nextLink(60000) }
        : { status: 200, resources: [practitioner('p-3')] }
    );

    const resources = await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ['p-1', 'p-2', 'p-3']);

    expect(resources.map((r) => r.id)).toEqual(['p-1', 'p-2', 'p-3']);
    expect(jobs).toHaveLength(3);
    expect(values(jobs[1], '_id')).toEqual(['p-1,p-2,p-3']);
    expect(values(jobs[1], '_tag')).toEqual(['a|1', 'b|2']);
    expect(values(jobs[1], '_count')).toEqual(['30000']);
    expect(values(jobs[1], '_offset')).toEqual(['30000']);
    expect(values(jobs[2], '_offset')).toEqual(['60000']);
  });

  it('splits a search that fails with Internal Error and returns everything once', async () => {
    const { oystehr, jobs } = fakeClient((params) =>
      idsOf(params).length > 2
        ? { status: 500, outcome: { issue: [{ diagnostics: 'Internal Error' }] } }
        : { status: 200, resources: idsOf(params).map(practitioner) }
    );

    const resources = await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ids(4));

    expect(resources.map((r) => r.id).sort()).toEqual(ids(4).sort());
    expect(jobs.map((params) => idsOf(params).length)).toEqual([4, 2, 2]);
  });

  it('treats an error file as a failure and splits', async () => {
    const { oystehr, jobs } = fakeClient((params) =>
      idsOf(params).length > 1
        ? { status: 200, resources: [], errorFile: '{"resourceType":"OperationOutcome"}' }
        : { status: 200, resources: idsOf(params).map(practitioner) }
    );

    const resources = await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ids(2));

    expect(resources).toHaveLength(2);
    expect(jobs).toHaveLength(3);
  });

  it('splits a capped result (30 000 without a next link) until each part is complete', async () => {
    const { oystehr, jobs } = fakeClient((params) =>
      idsOf(params).length > 2
        ? { status: 200, resources: Array.from({ length: 30000 }, (_, i) => practitioner(`x-${i}`)) }
        : { status: 200, resources: idsOf(params).map(practitioner) }
    );

    const all = ['a', 'b', 'c', 'd', 'e', 'f'];
    const resources = await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', all);

    expect(resources.map((r) => r.id).sort()).toEqual(all);
    // 6 ids → 3 + 3 → (2 + 1) + (2 + 1)
    expect(jobs).toHaveLength(7);
  });

  it('fails the report instead of returning a part of the data when the split runs out', async () => {
    const { oystehr } = fakeClient(() => ({ status: 500, outcome: 'Internal Error' }));

    await expect(fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ids(4))).rejects.toThrow(
      /completely/
    );
  });

  it('splits a job that the server accepted and then failed with 400 (the 30 s database limit)', async () => {
    const { oystehr, jobs } = fakeClient((params) =>
      idsOf(params).length > 2 ? { status: 400 } : { status: 200, resources: idsOf(params).map(practitioner) }
    );

    const resources = await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ids(4));

    expect(resources).toHaveLength(4);
    expect(jobs.map((params) => idsOf(params).length)).toEqual([4, 2, 2]);
  });

  it('does not split a search the server refuses when the job is started (a bad request)', async () => {
    const { oystehr } = fakeClient(() => ({ status: 200, resources: [] }));
    const search = (oystehr.fhir.search as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      Object.assign(new Error('bad parameter'), { code: 400 })
    );

    await expect(fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ids(4))).rejects.toThrow(
      /bad parameter/
    );
    expect(search).toHaveBeenCalledTimes(1);
  });
});
