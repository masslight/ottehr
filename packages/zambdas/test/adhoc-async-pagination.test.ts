import Oystehr from '@oystehr/sdk';
import { Appointment, FhirResource } from 'fhir/r4b';
import { beforeEach, describe, expect, it } from 'vitest';
import { fetchAppointmentReportResources } from '../src/shared/adhoc-report';

const appt = (id: string): Appointment => ({ resourceType: 'Appointment', id, status: 'fulfilled', participant: [] });

// Scripted pages keyed by the requested _offset: two non-empty pages then a terminal empty page.
function matchesForOffset(offset: number): Appointment[] {
  if (offset === 0) return Array.from({ length: 1000 }, (_, i) => appt(`appt-${i}`));
  if (offset === 1000) return [appt('appt-1000'), appt('appt-1001')];
  return [];
}

// Every window the code asks for, in request order — a window is identified by its `date=ge…` bound.
const requestedWindows: string[] = [];

// A completion bundle (batch-response) whose first entry is the searchset. Page 1000 also carries an
// 'outcome'-mode entry and a non-searchset outer entry, both of which must be ignored. A page with
// results carries link[next], which is what tells the loop to ask for the following page.
const fakeOystehr = {
  fhir: {
    search: async ({ params }: { resourceType: string; params?: { name: string; value: string }[] }) => {
      const from = params?.find((p) => p.name === 'date' && p.value.startsWith('ge'))?.value ?? '';
      requestedWindows.push(from);
      return {
        jobId: params?.find((p) => p.name === '_offset')?.value ?? '0',
        contentLocation: '',
        mode: 'bundle',
      };
    },
    waitForAsyncJob: async (jobId: string) => {
      const offset = Number(jobId);
      const matches = matchesForOffset(offset);
      const searchsetEntries = matches.map((resource) => ({ resource, search: { mode: 'match' } }));
      if (offset === 1000) {
        searchsetEntries.push({
          resource: { resourceType: 'OperationOutcome' } as unknown as Appointment,
          search: { mode: 'outcome' },
        });
      }
      return {
        status: 200,
        mode: 'bundle',
        bundle: {
          resourceType: 'Bundle',
          type: 'batch-response',
          entry: [
            {
              resource: {
                resourceType: 'Bundle',
                type: 'searchset',
                entry: searchsetEntries,
                ...(matches.length ? { link: [{ relation: 'next', url: 'https://example.test/next' }] } : {}),
              },
            },
            ...(offset === 1000 ? [{ resource: { resourceType: 'OperationOutcome' } }] : []),
          ],
        },
      };
    },
  },
} as unknown as Oystehr;

// Inside one 30-day window, so this range is searched in a single pass.
const dateRange = { start: '2026-07-01T00:00:00.000Z', end: '2026-07-28T23:59:59.999Z' };

describe('searchAllAsync pagination (via fetchAppointmentReportResources)', () => {
  beforeEach(() => {
    requestedWindows.length = 0;
  });

  it('walks every page until an empty page and returns all matched resources', async () => {
    const resources = await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange });
    const appointments = resources.filter((r) => r.resourceType === 'Appointment');
    // 1000 from page 0 + 2 from page 1000; the terminal empty page stops the loop.
    expect(appointments).toHaveLength(1002);
    expect(new Set(appointments.map((a) => a.id)).size).toBe(1002);
    // A range this short is one window, so every request carried the same lower bound.
    expect(new Set(requestedWindows).size).toBe(1);
  });

  it('ignores outcome-mode entries and non-searchset completion entries', async () => {
    const resources = await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange });
    expect(resources.some((r) => r.resourceType === 'OperationOutcome')).toBe(false);
  });

  it('splits a long range into windows and returns each resource once', async () => {
    // 100 days: the server answered a five-month range with 400 Internal Error, so the range is cut
    // into windows and searched window by window.
    const longRange = { start: '2026-01-01T00:00:00.000Z', end: '2026-04-11T00:00:00.000Z' };
    const resources = await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange: longRange });

    const bounds = Array.from(new Set(requestedWindows)).sort();
    expect(bounds).toHaveLength(4);
    // Windows start where the previous one ended, and the last one stops at the requested end.
    expect(bounds[0]).toContain('2026-01-01');
    expect(requestedWindows.some((b) => b.includes('2026-04-11'))).toBe(false);

    // The fake serves the same ids for every window; a resource must not be reported twice.
    const appointments = resources.filter((r) => r.resourceType === 'Appointment');
    expect(appointments).toHaveLength(1002);
    expect(new Set(appointments.map((a) => a.id)).size).toBe(1002);
  });
});
