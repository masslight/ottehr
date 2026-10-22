import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { runFetchPlan } from '../src/shared/adhoc-fetch-plan';

// A step with no date range of its own cannot be cut by date; past the bulk cap it is cut by _lastUpdated windows,
// halved where a window still fills the cap, and every resource comes back once.
type Params = { name: string; value: string }[];
const DAY_MS = 24 * 60 * 60 * 1000;
const patients: Patient[] = Array.from({ length: 50 }, (_, i) => ({
  resourceType: 'Patient',
  id: `p${i}`,
  // most of them recent, like a real project
  meta: { lastUpdated: new Date(Date.parse('2026-10-01T00:00:00Z') - (i < 40 ? i : i * 30) * DAY_MS).toISOString() },
}));
const inWindow = (params: Params): Patient[] => {
  const ge = params.find((p) => p.name === '_lastUpdated' && p.value.startsWith('ge'))?.value.slice(2);
  const le = params.find((p) => p.name === '_lastUpdated' && p.value.startsWith('le'))?.value.slice(2);
  return patients.filter(
    (p) =>
      (!ge || Date.parse(p.meta!.lastUpdated!) >= Date.parse(ge)) &&
      (!le || Date.parse(p.meta!.lastUpdated!) <= Date.parse(le))
  );
};
const jobs = new Map<string, Params>();
const bulkCalls: Params[] = [];
vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const params = jobs.get(String(input).replace('https://example.test/', ''))!;
  const cap = Number(params.find((p) => p.name === '_count')?.value);
  return {
    ok: true,
    status: 200,
    text: async () =>
      inWindow(params)
        .slice(0, cap)
        .map((r) => JSON.stringify(r))
        .join('\n'),
  };
}) as unknown as typeof fetch);
afterAll(() => vi.unstubAllGlobals());

const oystehr = {
  fhir: {
    search: async ({ params = [] }: { params?: Params }, request?: { mode?: string }) => {
      if (request?.mode === 'async-bulk') {
        const jobId = `job-${jobs.size}`;
        jobs.set(jobId, params);
        bulkCalls.push(params);
        return { jobId, contentLocation: '', mode: 'bulk' };
      }
      if (params.some((p) => p.name === '_summary'))
        return { total: inWindow(params).length, unbundle: () => [], link: [] };
      return { unbundle: () => [], link: [] };
    },
    waitForAsyncJob: async (jobId: string) => ({
      status: 200,
      mode: 'bulk',
      manifest: { requiresAccessToken: true, output: [{ type: 'Patient', url: `https://example.test/${jobId}` }] },
    }),
  },
} as unknown as Oystehr;

describe('an unbounded bulk step', () => {
  it('is cut by _lastUpdated and halved past the cap, returning every resource once', async () => {
    const { resources, stats } = await runFetchPlan(
      oystehr,
      {
        version: 1,
        steps: [
          {
            id: 'p',
            resourceType: 'Patient',
            description: 'all patients',
            mode: 'bulk',
            // a cap of 10 per job stands in for the server's 30,000
            params: [{ name: '_count', value: '10' }],
          },
        ],
      },
      undefined,
      undefined
    );
    expect(stats[0].error).toBeUndefined();
    expect(resources.p).toHaveLength(50);
    expect(new Set(resources.p.map((r) => r.id)).size).toBe(50);
    expect(bulkCalls.every((c) => c.filter((p) => p.name === '_lastUpdated').length === 2)).toBe(true);
    expect(bulkCalls.length).toBeGreaterThan(5); // the recent windows had to be halved
  });
});
