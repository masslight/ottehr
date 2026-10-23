import Oystehr from '@oystehr/sdk';
import { FhirResource, Practitioner } from 'fhir/r4b';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { fetchScopedResources } from '../src/shared/adhoc-report';

type Param = { name: string; value: string };

const practitioner = (id: string): Practitioner => ({ resourceType: 'Practitioner', id });
const ndjson = (resources: FhirResource[]): string => resources.map((resource) => JSON.stringify(resource)).join('\n');

const PAGE_1_URL = 'https://example.test/page-1.ndjson';
const PAGE_2_URL = 'https://example.test/page-2.ndjson';
const PAGE_3_URL = 'https://example.test/page-3.ndjson';

const bodyByUrl = new Map<string, string>([
  [PAGE_1_URL, ndjson([practitioner('p-1'), practitioner('p-2')])],
  [PAGE_2_URL, ndjson([practitioner('p-3')])],
  [PAGE_3_URL, ndjson([practitioner('p-4')])],
]);

vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const body = bodyByUrl.get(String(input));
  if (body === undefined) return { ok: false, status: 404, text: async () => 'not found' };
  return { ok: true, status: 200, text: async () => body };
}) as unknown as typeof fetch);

afterAll(() => {
  vi.unstubAllGlobals();
});

// The next link carries the original query: an encoded comma list, a repeated parameter, an encoded
// `|`, the job's own _count and the offset of the next page.
const nextLink = (offset: number): string =>
  'https://fhir.example.test/Practitioner?_id=p-1%2Cp-2%2Cp-3%2Cp-4&_tag=a%7C1&_tag=b%7C2' +
  `&_elements=id%2Cname&_count=30000&_offset=${offset}`;

const manifests = [
  { output: [{ type: 'Practitioner', url: PAGE_1_URL }], link: [{ relation: 'next', url: nextLink(30000) }] },
  { output: [{ type: 'Practitioner', url: PAGE_2_URL }], link: [{ relation: 'next', url: nextLink(60000) }] },
  { output: [{ type: 'Practitioner', url: PAGE_3_URL }] },
];

const searchCalls: Param[][] = [];

const fakeOystehr = {
  fhir: {
    search: async ({ params }: { resourceType: string; params?: Param[] }) => {
      searchCalls.push(params ?? []);
      return { jobId: `job-${searchCalls.length}`, contentLocation: '', mode: 'bulk' };
    },
    waitForAsyncJob: async (jobId: string) => ({
      status: 200,
      mode: 'bulk',
      manifest: { requiresAccessToken: true, ...manifests[Number(jobId.replace('job-', '')) - 1] },
    }),
  },
} as unknown as Oystehr;

const values = (params: Param[], name: string): string[] => params.filter((p) => p.name === name).map((p) => p.value);

describe('async-bulk search following the manifest next link', () => {
  it('returns the resources of every page, asking each page with the original query and one _count', async () => {
    const resources = await fetchScopedResources<Practitioner>(
      fakeOystehr,
      'Practitioner',
      '_id',
      ['p-1', 'p-2', 'p-3', 'p-4'],
      [
        { name: '_tag', value: 'a|1' },
        { name: '_tag', value: 'b|2' },
        { name: '_elements', value: 'id,name' },
      ]
    );

    expect(resources.map((r) => r.id)).toEqual(['p-1', 'p-2', 'p-3', 'p-4']);
    expect(searchCalls).toHaveLength(3);

    for (const [index, params] of searchCalls.entries()) {
      expect(values(params, '_id')).toEqual(['p-1,p-2,p-3,p-4']);
      expect(values(params, '_tag')).toEqual(['a|1', 'b|2']);
      expect(values(params, '_elements')).toEqual(['id,name']);
      // The next link's own _count is dropped and the maximum asked for again — never two of them.
      expect(values(params, '_count')).toEqual(['30000']);
      expect(values(params, '_offset')).toEqual(index === 0 ? [] : [String(index * 30000)]);
    }
  });
});
