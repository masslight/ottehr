import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource, Location, Patient } from 'fhir/r4b';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WINDOW_DAYS, fetchAppointmentReportResources, RECORDS_PER_WINDOW } from '../src/shared/adhoc-report';
import { parseBatchEntryUrl } from './helpers/adhoc-batch-fake';

type Param = { name: string; value: string };

const appt = (id: string): Appointment => ({
  resourceType: 'Appointment',
  id,
  status: 'fulfilled',
  participant: [
    { actor: { reference: 'Patient/pat-1' }, status: 'accepted' },
    { actor: { reference: 'Location/loc-1' }, status: 'accepted' },
  ],
});
const encounter = (id: string): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'finished',
  class: { code: 'AMB' },
  appointment: [{ reference: `Appointment/${id}` }],
});
const patient: Patient = { resourceType: 'Patient', id: 'pat-1' };
const location: Location = { resourceType: 'Location', id: 'loc-1' };

const ndjson = (resources: FhirResource[]): string => resources.map((resource) => JSON.stringify(resource)).join('\n');

const bodyByUrl = new Map<string, string>();
const jobs: { resourceType: string; params: Param[] }[][] = [];
const countSearches: Param[][] = [];
let countTotal = 0;

vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const body = bodyByUrl.get(String(input));
  if (body === undefined) return { ok: false, status: 404, text: async () => 'not found' };
  return { ok: true, status: 200, text: async () => body };
}) as unknown as typeof fetch);

afterAll(() => {
  vi.unstubAllGlobals();
});

// Every Appointment window answers the same 1 002 appointments with their encounters; Patient / Location by id.
const resourcesFor = (resourceType: string): FhirResource[] => {
  if (resourceType === 'Appointment') {
    const appointments = Array.from({ length: 1002 }, (_, i) => appt(`appt-${i}`));
    return [...appointments, ...appointments.map((a) => encounter(a.id!))];
  }
  if (resourceType === 'Patient') return [patient];
  if (resourceType === 'Location') return [location];
  return [];
};

const fakeOystehr = {
  fhir: {
    search: async ({ params }: { resourceType: string; params?: Param[] }) => {
      countSearches.push(params ?? []);
      return { total: countTotal, entry: [], unbundle: () => [] };
    },
    batch: async ({ requests }: { requests: { method: string; url: string }[] }) => {
      jobs.push(requests.map((r) => parseBatchEntryUrl(r.url)));
      return { jobId: `job-${jobs.length}`, contentLocation: '', mode: 'bulk' };
    },
    waitForAsyncJob: async (jobId: string) => {
      const entries = jobs[Number(jobId.replace('job-', '')) - 1];
      const byType = new Map<string, FhirResource[]>();
      for (const r of entries.flatMap((e) => resourcesFor(e.resourceType))) {
        byType.set(r.resourceType, [...(byType.get(r.resourceType) ?? []), r]);
      }
      const output = Array.from(byType.entries()).map(([type, resources]) => {
        const url = `https://example.test/${jobId}/${type}.ndjson`;
        bodyByUrl.set(url, ndjson(resources));
        return { type, url };
      });
      return { status: 200, mode: 'bulk', manifest: { requiresAccessToken: true, output, error: [] } };
    },
  },
} as unknown as Oystehr;

const values = (params: Param[], name: string): string[] => params.filter((p) => p.name === name).map((p) => p.value);

describe('report root (fetchAppointmentReportResources)', () => {
  beforeEach(() => {
    jobs.length = 0;
    countSearches.length = 0;
    bodyByUrl.clear();
    countTotal = 0;
  });

  it('a short range: no count, one window in one job; patients and locations by id, not as _include', async () => {
    const dateRange = { start: '2026-07-01T00:00:00.000Z', end: '2026-07-02T23:59:59.999Z' };
    const resources = await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange });

    expect(countSearches).toHaveLength(0);
    const appointmentJobs = jobs.filter((job) => job[0].resourceType === 'Appointment');
    expect(appointmentJobs).toHaveLength(1);
    expect(appointmentJobs[0]).toHaveLength(1);
    const params = appointmentJobs[0][0].params;
    expect(values(params, '_include')).toEqual([]);
    expect(values(params, '_revinclude')).toEqual(['Encounter:appointment']);

    expect(jobs.some((job) => job[0].resourceType === 'Patient' && values(job[0].params, '_id')[0] === 'pat-1')).toBe(
      true
    );
    expect(jobs.some((job) => job[0].resourceType === 'Location' && values(job[0].params, '_id')[0] === 'loc-1')).toBe(
      true
    );

    expect(resources.filter((r) => r.resourceType === 'Appointment')).toHaveLength(1002);
    expect(resources.filter((r) => r.resourceType === 'Encounter')).toHaveLength(1002);
    expect(resources.filter((r) => r.resourceType === 'Patient')).toHaveLength(1);
    expect(resources.filter((r) => r.resourceType === 'Location')).toHaveLength(1);
  });

  it('a long range: windows sized from one count, all in one job, each resource once', async () => {
    const dateRange = { start: '2026-01-01T00:00:00.000Z', end: '2026-07-01T00:00:00.000Z' };
    countTotal = RECORDS_PER_WINDOW * 4;

    const resources = await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange });

    expect(countSearches).toHaveLength(1);
    expect(values(countSearches[0], '_summary')).toEqual(['count']);
    expect(values(countSearches[0], '_total')).toEqual(['accurate']);

    const appointmentJobs = jobs.filter((job) => job[0].resourceType === 'Appointment');
    expect(appointmentJobs).toHaveLength(1);
    // 4 × RECORDS_PER_WINDOW appointments → about 4 windows (the last one may be a sliver).
    expect(appointmentJobs[0].length).toBeGreaterThanOrEqual(4);
    expect(appointmentJobs[0].length).toBeLessThanOrEqual(5);

    const bounds = appointmentJobs[0].map((entry) => values(entry.params, 'date'));
    expect(bounds[0][0]).toBe(`ge${dateRange.start}`);
    expect(bounds.at(-1)?.[1]).toBe(`le${dateRange.end}`);

    // The same ids from every window are reported once.
    expect(resources.filter((r) => r.resourceType === 'Appointment')).toHaveLength(1002);
  });

  it('a long range whose count fails: windows of the default size', async () => {
    const dateRange = { start: '2026-01-01T00:00:00.000Z', end: '2026-03-02T00:00:00.000Z' };
    countTotal = 0;

    await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange });

    const appointmentJobs = jobs.filter((job) => job[0].resourceType === 'Appointment');
    expect(appointmentJobs[0]).toHaveLength(Math.ceil(60 / DEFAULT_WINDOW_DAYS));
  });
});
