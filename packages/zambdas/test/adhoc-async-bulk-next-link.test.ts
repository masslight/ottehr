import Oystehr from '@oystehr/sdk';
import { FhirResource, Practitioner } from 'fhir/r4b';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchScopedResources, IDS_PER_ENTRY } from '../src/shared/adhoc-report';
import { parseBatchEntryUrl } from './helpers/adhoc-batch-fake';

type Param = { name: string; value: string };
type Request = { method: string; url: string };

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

/**
 * A fake batch-job API: `answer` decides each job's result from its entries. Every job's requests are kept.
 */
function fakeClient(answer: (entries: { resourceType: string; params: Param[] }[], jobIndex: number) => JobAnswer): {
  oystehr: Oystehr;
  jobs: { resourceType: string; params: Param[] }[][];
} {
  const jobs: { resourceType: string; params: Param[] }[][] = [];
  const answers = new Map<string, JobAnswer>();

  const oystehr = {
    fhir: {
      batch: vi.fn(async ({ requests }: { requests: Request[] }, options: { mode?: string }) => {
        expect(options.mode).toBe('async-bulk');
        const entries = requests.map((r) => {
          expect(r.method).toBe('GET');
          return parseBatchEntryUrl(r.url);
        });
        jobs.push(entries);
        const jobId = `job-${jobs.length}`;
        answers.set(jobId, answer(entries, jobs.length - 1));
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
          ? [{ type: 'OperationOutcome', url: `https://example.test/${jobId}-error.ndjson` }]
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
const idsOf = (entry: { params: Param[] }): string[] => values(entry.params, '_id')[0]?.split(',') ?? [];
const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => `p-${i}`);

describe('fetch helpers: one async batch job per search set', () => {
  beforeEach(() => bodyByUrl.clear());

  it('puts every id chunk into one job, each entry with its own _count and the extra params', async () => {
    const { oystehr, jobs } = fakeClient((entries) => ({
      status: 200,
      resources: entries.flatMap((e) => idsOf(e).map(practitioner)),
    }));

    const all = ids(IDS_PER_ENTRY * 2 + 10);
    const resources = await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', all, [
      { name: '_tag', value: 'a|1' },
      { name: '_elements', value: 'id,name' },
    ]);

    expect(resources.map((r) => r.id).sort()).toEqual([...all].sort());
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toHaveLength(3);
    for (const entry of jobs[0]) {
      expect(entry.resourceType).toBe('Practitioner');
      expect(values(entry.params, '_count')).toEqual(['30000']);
      expect(values(entry.params, '_tag')).toEqual(['a|1']);
      expect(values(entry.params, '_elements')).toEqual(['id,name']);
      expect(idsOf(entry).length).toBeLessThanOrEqual(IDS_PER_ENTRY);
    }
  });

  it('follows the manifest next link with the original query and one _count', async () => {
    const nextLink = (offset: number): string =>
      'https://fhir.example.test/Practitioner?_id=p-1%2Cp-2%2Cp-3&_tag=a%7C1&_tag=b%7C2' +
      `&_elements=id%2Cname&_count=30000&_offset=${offset}`;

    const { oystehr, jobs } = fakeClient((_entries, index) =>
      index === 0
        ? { status: 200, resources: [practitioner('p-1')], next: nextLink(30000) }
        : index === 1
        ? { status: 200, resources: [practitioner('p-2')], next: nextLink(60000) }
        : { status: 200, resources: [practitioner('p-3')] }
    );

    const resources = await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ['p-1', 'p-2', 'p-3']);

    expect(resources.map((r) => r.id)).toEqual(['p-1', 'p-2', 'p-3']);
    expect(jobs).toHaveLength(3);
    const followed = jobs[1][0].params;
    expect(values(followed, '_id')).toEqual(['p-1,p-2,p-3']);
    expect(values(followed, '_tag')).toEqual(['a|1', 'b|2']);
    expect(values(followed, '_count')).toEqual(['30000']);
    expect(values(followed, '_offset')).toEqual(['30000']);
    expect(values(jobs[2][0].params, '_offset')).toEqual(['60000']);
  });

  it('splits a job that fails with Internal Error into two jobs and returns everything once', async () => {
    const { oystehr, jobs } = fakeClient((entries) =>
      entries.length > 1
        ? { status: 500, outcome: { issue: [{ diagnostics: 'Internal Error' }] } }
        : { status: 200, resources: idsOf(entries[0]).map(practitioner) }
    );

    const all = ids(IDS_PER_ENTRY * 2);
    const resources = await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', all);

    expect(resources).toHaveLength(all.length);
    expect(jobs.map((job) => job.length)).toEqual([2, 1, 1]);
  });

  it('treats an error file as a failure and splits', async () => {
    const { oystehr, jobs } = fakeClient((entries) =>
      entries.length > 1
        ? { status: 200, resources: [], errorFile: '{"resourceType":"OperationOutcome"}' }
        : { status: 200, resources: idsOf(entries[0]).map(practitioner) }
    );

    const resources = await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ids(IDS_PER_ENTRY + 1));

    expect(resources).toHaveLength(IDS_PER_ENTRY + 1);
    expect(jobs.map((job) => job.length)).toEqual([2, 1, 1]);
  });

  it('splits a capped result (30 000 without a next link) down to the id list of one entry', async () => {
    const { oystehr, jobs } = fakeClient((entries) => {
      const entryIds = entries.flatMap(idsOf);
      // Pretend each id has 10 000 matches: more than one id per job hits the cap.
      return entryIds.length > 2
        ? { status: 200, resources: Array.from({ length: 30000 }, (_, i) => practitioner(`x-${i}`)) }
        : { status: 200, resources: entryIds.map(practitioner) };
    });

    const resources = await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', [
      'a',
      'b',
      'c',
      'd',
      'e',
      'f',
    ]);

    expect(resources.map((r) => r.id).sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    // One job of one entry (6 ids) → its halves (3 + 3) → their halves (2 + 1, 2 + 1).
    expect(jobs.length).toBe(7);
  });

  it('halves a job of many entries as often as needed without counting it against the split limit', async () => {
    // Every entry alone is small, but more than 3 entries together reach 30 000: 40 entries need 4 halvings.
    const { oystehr, jobs } = fakeClient((entries) =>
      entries.length > 3
        ? { status: 200, resources: Array.from({ length: 30000 }, (_, i) => practitioner(`x-${i}`)) }
        : { status: 200, resources: entries.flatMap((e) => idsOf(e).map(practitioner)) }
    );

    const all = ids(IDS_PER_ENTRY * 40);
    const resources = await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', all);

    expect(resources).toHaveLength(all.length);
    expect(jobs[0]).toHaveLength(40);
    expect(Math.max(...jobs.slice(1).map((job) => job.length))).toBeLessThanOrEqual(20);
  });

  it('asks for fewer entries per job when the caller says the entries are heavy', async () => {
    const { oystehr, jobs } = fakeClient((entries) => ({
      status: 200,
      resources: entries.flatMap((e) => idsOf(e).map(practitioner)),
    }));

    await fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ids(IDS_PER_ENTRY * 5), [], {
      entriesPerJob: 2,
    });

    expect(jobs.map((job) => job.length)).toEqual([2, 2, 1]);
  });

  it('fails the report instead of returning a part of the data when the split runs out', async () => {
    const { oystehr } = fakeClient(() => ({ status: 500, outcome: 'Internal Error' }));

    await expect(fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ids(4))).rejects.toThrow(
      /completely/
    );
  });

  it('does not split on a client error', async () => {
    const { oystehr, jobs } = fakeClient(() => ({ status: 400, outcome: 'bad parameter' }));

    await expect(
      fetchScopedResources<Practitioner>(oystehr, 'Practitioner', '_id', ids(IDS_PER_ENTRY * 2))
    ).rejects.toThrow(/status 400/);
    expect(jobs).toHaveLength(1);
  });
});
