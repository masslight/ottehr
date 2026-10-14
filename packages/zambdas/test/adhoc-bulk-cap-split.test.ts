import Oystehr from '@oystehr/sdk';
import { Appointment, FhirResource, Observation, Patient } from 'fhir/r4b';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ASYNC_BULK_MAX,
  fetchAppointmentReportResources,
  fetchScopedResources,
  halveList,
  halveWindow,
  searchAsyncBulk,
} from '../src/shared/adhoc-report';

// An async-bulk job returns at most `_count` primary resources and drops the rest silently (Oystehr clamps
// `_count` itself at 30,000). The fake below honours whatever `_count` the search sends, so the tests cap at 5.
const CAP = 5;

type Params = { name: string; value: string }[];

const DAY_MS = 24 * 60 * 60 * 1000;
const RANGE_START = Date.parse('2026-03-01T00:00:00.000Z');

/** Appointments spread evenly over the days of the range: `perDay` of them each day, around noon. */
const appointments = (days: number, perDay: number): Appointment[] =>
  Array.from({ length: days * perDay }, (_, i) => ({
    resourceType: 'Appointment',
    id: `appt-${i}`,
    status: 'fulfilled',
    participant: [],
    start: new Date(RANGE_START + Math.floor(i / perDay) * DAY_MS + DAY_MS / 2 + (i % perDay) * 60_000).toISOString(),
  }));

/** `perEncounter` observations for each encounter id. */
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

// An _include that rides along with every job: it must be reported once however many jobs ran.
const sharedPatient: Patient = { resourceType: 'Patient', id: 'pat-shared' };

let data: FhirResource[] = [];
const jobs = new Map<string, Params>();
const searchCalls: Params[] = [];

const matches = (params: Params): FhirResource[] => {
  const count = Number(params.find((p) => p.name === '_count')?.value ?? ASYNC_BULK_MAX);
  const ge = params.find((p) => p.name === 'date' && p.value.startsWith('ge'))?.value.slice(2);
  const le = params.find((p) => p.name === 'date' && p.value.startsWith('le'))?.value.slice(2);
  const ids = params.find((p) => p.name === 'encounter')?.value.split(',');
  const primary = data.filter((r) => {
    if (r.resourceType === 'Appointment' && ge && le) {
      const start = Date.parse((r as Appointment).start!);
      return start >= Date.parse(ge) && start <= Date.parse(le);
    }
    if (r.resourceType === 'Observation' && ids) {
      return ids.includes((r as Observation).encounter!.reference!.replace('Encounter/', ''));
    }
    return false;
  });
  return [...primary.slice(0, count), sharedPatient];
};

vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const jobId = String(input).replace('https://example.test/', '');
  const params = jobs.get(jobId);
  if (!params) return { ok: false, status: 404, text: async () => 'not found' };
  return {
    ok: true,
    status: 200,
    text: async () =>
      matches(params)
        .map((r) => JSON.stringify(r))
        .join('\n'),
  };
}) as unknown as typeof fetch);

afterAll(() => {
  vi.unstubAllGlobals();
});

const fakeOystehr = {
  fhir: {
    search: async ({ params }: { resourceType: string; params?: Params }) => {
      const jobId = `job-${jobs.size}`;
      jobs.set(jobId, params ?? []);
      searchCalls.push(params ?? []);
      return { jobId, contentLocation: '', mode: 'bulk' };
    },
    waitForAsyncJob: async (jobId: string) => ({
      status: 200,
      mode: 'bulk',
      manifest: { requiresAccessToken: true, output: [{ type: 'mixed', url: `https://example.test/${jobId}` }] },
    }),
  },
} as unknown as Oystehr;

const cap: Params = [{ name: '_count', value: String(CAP) }];

describe('searchAsyncBulk and the bulk cap', () => {
  beforeEach(() => {
    jobs.clear();
    searchCalls.length = 0;
  });

  it('asks for the server maximum when the caller sets no _count', async () => {
    data = appointments(1, 2);
    await searchAsyncBulk(fakeOystehr, 'Appointment', [{ name: 'status', value: 'fulfilled' }]);
    expect(searchCalls[0]).toContainEqual({ name: '_count', value: '30000' });
  });

  it('keeps a smaller _count the caller set', async () => {
    data = appointments(1, 2);
    await searchAsyncBulk(fakeOystehr, 'Appointment', cap);
    expect(searchCalls[0].filter((p) => p.name === '_count')).toEqual(cap);
  });

  it('refuses a result that fills the cap instead of returning it cut', async () => {
    data = appointments(1, CAP + 2);
    await expect(
      searchAsyncBulk(fakeOystehr, 'Appointment', [
        { name: 'date', value: 'ge2026-03-01T00:00:00.000Z' },
        { name: 'date', value: 'le2026-03-01T23:59:59.999Z' },
        ...cap,
      ])
    ).rejects.toThrow(/5 Appointment matched/);
  });
});

describe('date-windowed searches split on the cap', () => {
  beforeEach(() => {
    jobs.clear();
    searchCalls.length = 0;
  });

  it('halves a window whose job fills the cap and returns every resource once', async () => {
    // Two a day over eight days: a 3-day window holds 6 > 5, each half (1.5 days) holds 3.
    data = appointments(8, 2);
    const dateRange = {
      start: new Date(RANGE_START).toISOString(),
      end: new Date(RANGE_START + 8 * DAY_MS - 1).toISOString(),
    };
    const resources = await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange, extraParams: cap });

    const appts = resources.filter((r) => r.resourceType === 'Appointment');
    expect(appts).toHaveLength(16);
    expect(new Set(appts.map((a) => a.id)).size).toBe(16);
    // The included patient came back from every job but is reported once.
    expect(resources.filter((r) => r.resourceType === 'Patient')).toHaveLength(1);
    // Two 3-day windows (6 each: capped, then two halves of 3) and the 2-day tail (4, fine): 3 + 3 + 1 jobs.
    expect(searchCalls).toHaveLength(7);
  });

  it('fails clearly when a single day still fills the cap', async () => {
    data = appointments(1, CAP + 1);
    const dateRange = {
      start: new Date(RANGE_START).toISOString(),
      end: new Date(RANGE_START + DAY_MS - 1).toISOString(),
    };
    await expect(
      fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange, extraParams: cap })
    ).rejects.toThrow(/cannot be split any further/);
    expect(searchCalls).toHaveLength(1);
  });

  it('halveWindow splits at the midpoint without overlap and stops at a day', () => {
    const [a, b] = halveWindow({ start: '2026-03-01T00:00:00.000Z', end: '2026-03-03T00:00:00.000Z' })!;
    expect(a).toEqual({ start: '2026-03-01T00:00:00.000Z', end: '2026-03-02T00:00:00.000Z' });
    expect(b).toEqual({ start: '2026-03-02T00:00:00.001Z', end: '2026-03-03T00:00:00.000Z' });
    expect(halveWindow({ start: '2026-03-01T00:00:00.000Z', end: '2026-03-02T00:00:00.000Z' })).toBeUndefined();
  });
});

describe('id-scoped searches split on the cap', () => {
  beforeEach(() => {
    jobs.clear();
    searchCalls.length = 0;
  });

  it('halves the id list whose job fills the cap and returns every resource once', async () => {
    const ids = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7'];
    data = observations(ids, 1);
    const resources = await fetchScopedResources<FhirResource>(fakeOystehr, 'Observation', 'encounter', ids, cap);

    expect(resources.filter((r) => r.resourceType === 'Observation')).toHaveLength(7);
    expect(resources.filter((r) => r.resourceType === 'Patient')).toHaveLength(1);
    // One batch of 7 (capped), then 4 + 3.
    expect(searchCalls.map((params) => params.find((p) => p.name === 'encounter')?.value)).toEqual([
      ids.join(','),
      'e1,e2,e3,e4',
      'e5,e6,e7',
    ]);
  });

  it('fails clearly when a single id still fills the cap', async () => {
    data = observations(['e1'], CAP);
    await expect(
      fetchScopedResources<FhirResource>(fakeOystehr, 'Observation', 'encounter', ['e1'], cap)
    ).rejects.toThrow(/cannot be split any further/);
  });

  it('halveList splits in two and stops at one', () => {
    expect(halveList([1, 2, 3])).toEqual([[1, 2], [3]]);
    expect(halveList([1])).toBeUndefined();
  });
});
