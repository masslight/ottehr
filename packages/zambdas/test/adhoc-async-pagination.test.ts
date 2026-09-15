import Oystehr from '@oystehr/sdk';
import { Appointment, FhirResource, Patient } from 'fhir/r4b';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchAppointmentReportResources } from '../src/shared/adhoc-report';

const appt = (id: string): Appointment => ({ resourceType: 'Appointment', id, status: 'fulfilled', participant: [] });
const patient = (id: string): Patient => ({ resourceType: 'Patient', id });

const APPOINTMENT_URL = 'https://example.test/Appointment.ndjson';
const PATIENT_URL = 'https://example.test/Patient.ndjson';

const ndjson = (resources: FhirResource[]): string => resources.map((resource) => JSON.stringify(resource)).join('\n');

const bodyByUrl = new Map<string, string>([
  [APPOINTMENT_URL, ndjson(Array.from({ length: 1002 }, (_, i) => appt(`appt-${i}`)))],
  // An _include lands in its own file rather than inside the matched resources.
  [PATIENT_URL, ndjson([patient('pat-1'), patient('pat-2')])],
]);

const requestedUrls: string[] = [];
const searchCalls: { name: string; value: string }[][] = [];

// Stubbed rather than assigned, so vitest restores the real fetch even if a test throws — a leaked
// stub would silently change the behaviour of whatever file runs next in this worker.
vi.stubGlobal('fetch', (async (input: RequestInfo | URL) => {
  const url = String(input);
  requestedUrls.push(url);
  const body = bodyByUrl.get(url);
  if (body === undefined) return { ok: false, status: 404, text: async () => 'not found' };
  return { ok: true, status: 200, text: async () => body };
}) as unknown as typeof fetch);

afterAll(() => {
  vi.unstubAllGlobals();
});

// The manifest asks for a token: the SDK would add an Authorization header and the storage would
// answer 400, which is why the zambda downloads the files itself, unauthenticated.
const fakeOystehr = {
  fhir: {
    search: async ({ params }: { resourceType: string; params?: { name: string; value: string }[] }) => {
      searchCalls.push(params ?? []);
      return { jobId: 'job', contentLocation: '', mode: 'bulk' };
    },
    waitForAsyncJob: async () => ({
      status: 200,
      mode: 'bulk',
      manifest: {
        requiresAccessToken: true,
        output: [
          { type: 'Appointment', url: APPOINTMENT_URL },
          { type: 'Patient', url: PATIENT_URL },
        ],
      },
    }),
  },
} as unknown as Oystehr;

describe('async-bulk search (via fetchAppointmentReportResources)', () => {
  beforeEach(() => {
    searchCalls.length = 0;
    requestedUrls.length = 0;
  });

  it('downloads every file in the manifest and returns all of their resources', async () => {
    // Inside one window, so the manifest is fetched once.
    const dateRange = { start: '2026-07-01T00:00:00.000Z', end: '2026-07-02T23:59:59.999Z' };
    const resources = await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange });

    expect(requestedUrls).toEqual([APPOINTMENT_URL, PATIENT_URL]);
    expect(resources.filter((r) => r.resourceType === 'Appointment')).toHaveLength(1002);
    expect(resources.filter((r) => r.resourceType === 'Patient')).toHaveLength(2);
  });

  it('splits a long range into windows and returns each resource once', async () => {
    // Bulk lifts the limit on how much the server may send, not on the query it has to run: a
    // six-month range failed the job itself, so the range is searched window by window.
    const dateRange = { start: '2026-01-01T00:00:00.000Z', end: '2026-01-10T00:00:00.000Z' };
    const resources = await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange });

    const bounds = Array.from(
      new Set(
        searchCalls
          .flatMap((params) => params.filter((p) => p.name === 'date' && p.value.startsWith('ge')))
          .map((p) => p.value)
      )
    ).sort();
    // Nine days in windows of three.
    expect(bounds).toHaveLength(3);
    // Windows start where the previous one ended, and the last one stops at the requested end.
    expect(bounds[0]).toContain('2026-01-01');
    expect(bounds.some((b) => b.includes('2026-01-10'))).toBe(false);

    // The fake serves the same ids for every window; a resource must not be reported twice.
    const appointments = resources.filter((r) => r.resourceType === 'Appointment');
    expect(appointments).toHaveLength(1002);
    expect(new Set(appointments.map((a) => a.id)).size).toBe(1002);
  });
});
