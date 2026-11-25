import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, FhirResource, Location, Patient } from 'fhir/r4b';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_WINDOW_DAYS, fetchAppointmentReportResources, fetchReportVisits } from '../src/shared/adhoc-report';

process.env.ADHOC_SYNC_PAGES = '0';

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
const jobs: { resourceType: string; params: Param[] }[] = [];

vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const body = bodyByUrl.get(String(input));
  if (body === undefined) return { ok: false, status: 404, text: async () => 'not found' };
  return { ok: true, status: 200, text: async () => body };
}) as unknown as typeof fetch);

afterAll(() => {
  vi.unstubAllGlobals();
});

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
    search: async ({ resourceType, params }: { resourceType: string; params: Param[] }) => {
      jobs.push({ resourceType, params });
      return { jobId: `job-${jobs.length}`, contentLocation: '', mode: 'bulk' };
    },
    waitForAsyncJob: async (jobId: string) => {
      const { resourceType } = jobs[Number(jobId.replace('job-', '')) - 1];
      const byType = new Map<string, FhirResource[]>();
      for (const r of resourcesFor(resourceType))
        byType.set(r.resourceType, [...(byType.get(r.resourceType) ?? []), r]);
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
    bodyByUrl.clear();
  });

  it('a short range: one window; patients and locations by id, not as _include', async () => {
    const dateRange = { start: '2026-07-01T00:00:00.000Z', end: '2026-07-02T23:59:59.999Z' };
    const resources = await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange });

    const windows = jobs.filter((job) => job.resourceType === 'Appointment');
    expect(windows).toHaveLength(1);
    expect(values(windows[0].params, '_include')).toEqual([]);
    expect(values(windows[0].params, '_revinclude')).toEqual(['Encounter:appointment']);
    expect(values(windows[0].params, '_count')).toEqual(['30000']);

    expect(jobs.some((job) => job.resourceType === 'Patient' && values(job.params, '_id')[0] === 'pat-1')).toBe(true);
    expect(jobs.some((job) => job.resourceType === 'Location' && values(job.params, '_id')[0] === 'loc-1')).toBe(true);

    expect(resources.filter((r) => r.resourceType === 'Appointment')).toHaveLength(1002);
    expect(resources.filter((r) => r.resourceType === 'Encounter')).toHaveLength(1002);
    expect(resources.filter((r) => r.resourceType === 'Patient')).toHaveLength(1);
    expect(resources.filter((r) => r.resourceType === 'Location')).toHaveLength(1);
  });

  it('a long range: one job per window of DEFAULT_WINDOW_DAYS, back to back, each resource once', async () => {
    const dateRange = { start: '2026-01-01T00:00:00.000Z', end: '2026-03-02T00:00:00.000Z' };

    const resources = await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange });

    const windows = jobs.filter((job) => job.resourceType === 'Appointment');
    expect(windows).toHaveLength(Math.ceil(60 / DEFAULT_WINDOW_DAYS));

    const bounds = windows.map((job) => values(job.params, 'date'));
    expect(bounds[0][0]).toBe(`ge${dateRange.start}`);
    expect(bounds.at(-1)?.[1]).toBe(`le${dateRange.end}`);

    expect(resources.filter((r) => r.resourceType === 'Appointment')).toHaveLength(1002);
  });
});

describe('report visits (fetchReportVisits): appointments and encounters searched side by side', () => {
  const visit = (id: string, status = 'fulfilled'): Appointment => ({
    ...appt(id),
    status: status as Appointment['status'],
  });
  const enc = (id: string, apptId?: string, partOf?: string): Encounter => ({
    resourceType: 'Encounter',
    id,
    status: 'finished',
    class: { code: 'AMB' },
    ...(apptId ? { appointment: [{ reference: `Appointment/${apptId}` }] } : {}),
    ...(partOf ? { partOf: { reference: `Encounter/${partOf}` } } : {}),
  });

  const client = (byKind: Record<string, FhirResource[] | 'refuse'>): Oystehr =>
    ({
      fhir: {
        search: async ({ resourceType, params }: { resourceType: string; params: Param[] }) => {
          const kind = params.some((p) => p.name.startsWith('part-of.'))
            ? 'chained'
            : params.some((p) => p.name === 'part-of')
            ? 'byParent'
            : resourceType;
          const answer = byKind[kind] ?? [];
          if (answer === 'refuse') throw Object.assign(new Error('unknown search parameter'), { code: 400 });
          return { unbundle: () => answer, link: [] };
        },
      },
    }) as unknown as Oystehr;

  beforeEach(() => {
    process.env.ADHOC_SYNC_PAGES = '3';
  });
  afterAll(() => {
    process.env.ADHOC_SYNC_PAGES = '0';
  });

  const dateRange = { start: '2026-07-01T00:00:00.000Z', end: '2026-07-02T00:00:00.000Z' };
  const ids = (rs: FhirResource[]): string[] => rs.map((r) => `${r.resourceType}/${r.id}`).sort();

  it('keeps the encounters of the kept appointments and their follow-ups, nothing else', async () => {
    const out = await fetchReportVisits(
      client({
        Appointment: [visit('a1')],
        Encounter: [enc('e1', 'a1'), enc('e2', 'other')],
        chained: [enc('f1', undefined, 'e1'), enc('f2', undefined, 'e2'), enc('f3', undefined, 'f1')],
      }),
      { dateRange }
    );
    expect(ids(out)).toEqual(['Appointment/a1', 'Encounter/e1', 'Encounter/f1', 'Encounter/f3']);
  });

  it('when the chained follow-up search is refused, finds the follow-ups by their parents', async () => {
    const out = await fetchReportVisits(
      client({
        Appointment: [visit('a1')],
        Encounter: [enc('e1', 'a1')],
        chained: 'refuse',
        byParent: [enc('f1', undefined, 'e1')],
      }),
      { dateRange }
    );
    expect(ids(out)).toEqual(['Appointment/a1', 'Encounter/e1', 'Encounter/f1']);
  });
});
