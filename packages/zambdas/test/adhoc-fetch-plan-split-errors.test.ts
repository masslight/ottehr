import Oystehr from '@oystehr/sdk';
import { Appointment, FhirResource, Observation } from 'fhir/r4b';
import { FetchPlanSchema } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { beforeEach, describe, expect, it } from 'vitest';
import { runFetchPlan } from '../src/shared/adhoc-fetch-plan';
import { isSearchTooHeavyError, MAX_ERROR_SPLITS, searchAsyncBulk } from '../src/shared/adhoc-report';

// The plan runner splits a search the server could not finish — cut off at 14 s (504) or over 6 MiB (413 / 4130) —
// the way it splits a bulk job that fills the cap: a date window in half, an id batch in half, and retries, a bounded
// number of times. The fake server below fails any window wider than `maxWindowDays` and any batch of more than
// `maxIds` ids with the error the SDK would throw (an Error carrying the server's `code`).
type Params = { name: string; value: string }[];

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_START = Date.parse('2026-05-01T00:00:00.000Z');
const range = (days: number): { start: string; end: string } => ({
  start: new Date(RANGE_START).toISOString(),
  end: new Date(RANGE_START + days * DAY_MS - 1).toISOString(),
});

const serverError = (code: number, message: string): Error => Object.assign(new Error(message), { code });

const appointments = (days: number, perDay: number): Appointment[] =>
  Array.from({ length: days * perDay }, (_, i) => ({
    resourceType: 'Appointment',
    id: `appt-${i}`,
    status: 'fulfilled',
    participant: [],
    start: new Date(RANGE_START + Math.floor(i / perDay) * DAY_MS + DAY_MS / 2 + (i % perDay) * 60_000).toISOString(),
  }));

const observations = (encounterIds: string[], perEncounter: number): Observation[] =>
  encounterIds.flatMap((encounterId) =>
    Array.from({ length: perEncounter }, (_, i) => ({
      resourceType: 'Observation' as const,
      id: `${encounterId}-obs-${i}`,
      status: 'final' as const,
      code: {},
      encounter: { reference: `Encounter/${encounterId}` },
    }))
  );

let data: FhirResource[] = [];
let maxWindowDays = Infinity;
let maxIds = Infinity;
const calls: Params[] = [];

const fakeOystehr = {
  fhir: {
    search: async ({ params = [] }: { resourceType: string; params?: Params }) => {
      calls.push(params);
      const ge = params.find((p) => p.name === 'date' && p.value.startsWith('ge'))?.value.slice(2);
      const le = params.find((p) => p.name === 'date' && p.value.startsWith('le'))?.value.slice(2);
      const ids = params.find((p) => p.name === 'encounter')?.value.split(',');
      const matched = data.filter((r) => {
        if (ids) return r.resourceType === 'Observation' && ids.includes((r as Observation).encounter!.reference!);
        if (ge && le) {
          if (r.resourceType !== 'Appointment') return false;
          const start = Date.parse((r as Appointment).start!);
          return start >= Date.parse(ge) && start <= Date.parse(le);
        }
        return r.resourceType === 'Encounter';
      });
      // The row-less count a first run starts with is cheap and answers.
      if (params.some((p) => p.name === '_count' && p.value === '0')) {
        return { total: matched.length, unbundle: () => [], link: [] };
      }
      if (ge && le && Date.parse(le) - Date.parse(ge) > maxWindowDays * DAY_MS) {
        throw serverError(504, 'Gateway timeout');
      }
      // 413 rather than 4130: the paged search's own page-size retry (withResponseSizeRetry) handles 4130 first.
      if (ids && ids.length > maxIds) throw serverError(413, 'Response too large');
      return { unbundle: () => matched, link: [] };
    },
  },
} as unknown as Oystehr;

const datedPlan = FetchPlanSchema.parse({
  version: 1,
  steps: [
    {
      id: 'visits',
      resourceType: 'Appointment',
      mode: 'normal',
      params: [
        { name: 'date', value: 'ge{{start}}' },
        { name: 'date', value: 'le{{end}}' },
      ],
    },
  ],
});

const scopedPlan = FetchPlanSchema.parse({
  version: 1,
  steps: [
    { id: 'encounters', resourceType: 'Encounter', params: [{ name: 'status', value: 'finished' }] },
    {
      id: 'vitals',
      resourceType: 'Observation',
      from: { step: 'encounters', path: 'id', param: 'encounter', keepType: 'Encounter' },
    },
  ],
});

const windowDays = (params: Params): number => {
  const [ge, le] = params.filter((p) => p.name === 'date').map((p) => Date.parse(p.value.slice(2)));
  return (le - ge) / DAY_MS;
};

describe('a paged date-range search the server cannot finish is halved and retried', () => {
  beforeEach(() => {
    data = [];
    calls.length = 0;
    maxWindowDays = Infinity;
    maxIds = Infinity;
  });

  it('halves the range until the windows fit and returns every resource once', async () => {
    data = appointments(10, 2);
    maxWindowDays = 3;
    const { resources, stats } = await runFetchPlan(fakeOystehr, datedPlan, range(10), undefined);
    expect(resources.visits).toHaveLength(20);
    expect(new Set(resources.visits.map((r) => r.id)).size).toBe(20);
    // The count, then 10 days (fails) → 5 + 5 (fail) → four windows of 2.5 days (fit).
    expect(calls.map(windowDays).map((d) => Math.round(d * 10) / 10)).toEqual([10, 10, 5, 5, 2.5, 2.5, 2.5, 2.5]);
    expect(stats[0]).toMatchObject({ mode: 'normal', count: 20, requests: 5 });
    expect(stats[0].error).toBeUndefined();
  });

  it('fails clearly when a single day still fails', async () => {
    maxWindowDays = 0;
    const { stats } = await runFetchPlan(fakeOystehr, datedPlan, range(1), undefined);
    expect(stats[0].error).toBe(
      'a single day of Appointment still fails (Gateway timeout); the search is probably too broad — check its filters and _include'
    );
    expect(calls).toHaveLength(2);
  });

  it(`gives up after ${MAX_ERROR_SPLITS} levels of splitting`, async () => {
    maxWindowDays = 0;
    const { stats } = await runFetchPlan(fakeOystehr, datedPlan, range(64), undefined);
    expect(stats[0].error).toBe(
      `Appointment still fails after splitting ${MAX_ERROR_SPLITS} times (Gateway timeout); the search is probably too broad — check its filters and _include`
    );
    // The count, then 64 → 32 + 32 → 4 × 16 → 8 × 8: the eighths fail and are not split again.
    expect(calls).toHaveLength(1 + 1 + 2 + 4 + 8);
  });

  it('leaves another error alone', async () => {
    const failing = {
      fhir: {
        search: async () => {
          throw serverError(400, 'unknown search parameter');
        },
      },
    } as unknown as Oystehr;
    const { stats } = await runFetchPlan(failing, datedPlan, range(10), undefined);
    expect(stats[0].error).toBe('unknown search parameter');
  });
});

describe('a scoped batch the server cannot finish is halved and retried', () => {
  beforeEach(() => {
    calls.length = 0;
    maxWindowDays = Infinity;
    maxIds = Infinity;
  });

  it('halves the id list until the batches fit', async () => {
    const ids = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7'];
    data = [
      ...ids.map((id) => ({ resourceType: 'Encounter' as const, id, status: 'finished' as const, class: {} })),
      ...observations(ids, 2),
    ];
    maxIds = 2;
    const { resources, stats } = await runFetchPlan(fakeOystehr, scopedPlan, undefined, undefined);
    expect(resources.vitals).toHaveLength(14);
    expect(stats[1]).toMatchObject({ mode: 'normal', count: 14, scopedValues: 7 });
    expect(stats[1].error).toBeUndefined();
    const batches = calls
      .map((params) => params.find((p) => p.name === 'encounter')?.value.split(',').length)
      .filter((n): n is number => n !== undefined);
    // 7 (fails) → 4 + 3 (fail) → 2 + 2 + 2 + 1.
    expect(batches).toEqual([7, 4, 3, 2, 2, 2, 1]);
  });

  it('fails clearly when a single id still fails', async () => {
    data = [{ resourceType: 'Encounter', id: 'e1', status: 'finished', class: {} }];
    maxIds = 0;
    const { stats } = await runFetchPlan(fakeOystehr, scopedPlan, undefined, undefined);
    expect(stats[1].error).toBe(
      'a single id of Observation still fails (Response too large); the search is probably too broad — check its filters and _include'
    );
  });
});

describe('isSearchTooHeavyError', () => {
  it('is a 504, a 413 or the 4130 response-size code, by code or message', () => {
    expect(isSearchTooHeavyError(serverError(504, 'Gateway timeout'))).toBe(true);
    expect(isSearchTooHeavyError(serverError(413, 'too large'))).toBe(true);
    expect(isSearchTooHeavyError(serverError(4130, 'too large'))).toBe(true);
    expect(isSearchTooHeavyError({ code: '504' })).toBe(true);
    expect(isSearchTooHeavyError(new Error('Response exceeds the maximum allowed size'))).toBe(true);
    expect(isSearchTooHeavyError(serverError(400, 'bad request'))).toBe(false);
    expect(isSearchTooHeavyError(new Error('anything else'))).toBe(false);
  });

  it('sees the code of a failed bulk job through its wrapped error', async () => {
    const failing = {
      fhir: {
        search: async () => {
          throw serverError(504, 'Gateway timeout');
        },
        getAsyncJob: async () => ({}),
      },
    } as unknown as Oystehr;
    const error = await searchAsyncBulk(failing, 'Appointment', []).catch((e) => e);
    expect(error.message).toContain('Gateway timeout');
    expect(isSearchTooHeavyError(error)).toBe(true);
  });
});
