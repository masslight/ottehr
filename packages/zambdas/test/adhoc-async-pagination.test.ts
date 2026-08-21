import Oystehr from '@oystehr/sdk';
import { Appointment, FhirResource } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { fetchAppointmentReportResources } from '../src/shared/adhoc-report';

const appt = (id: string): Appointment => ({ resourceType: 'Appointment', id, status: 'fulfilled', participant: [] });

// Scripted pages keyed by the requested _offset: two non-empty pages then a terminal empty page.
function matchesForOffset(offset: number): Appointment[] {
  if (offset === 0) return Array.from({ length: 1000 }, (_, i) => appt(`appt-${i}`));
  if (offset === 1000) return [appt('appt-1000'), appt('appt-1001')];
  return [];
}

// A completion bundle (batch-response) whose first entry is the searchset. Page 1000 also carries an
// 'outcome'-mode entry and a non-searchset outer entry, both of which must be ignored.
const fakeOystehr = {
  fhir: {
    search: async ({ params }: { resourceType: string; params?: { name: string; value: string }[] }) => ({
      jobId: params?.find((p) => p.name === '_offset')?.value ?? '0',
      contentLocation: '',
      mode: 'bundle',
    }),
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
            { resource: { resourceType: 'Bundle', type: 'searchset', entry: searchsetEntries } },
            ...(offset === 1000 ? [{ resource: { resourceType: 'OperationOutcome' } }] : []),
          ],
        },
      };
    },
  },
} as unknown as Oystehr;

const dateRange = { start: '2026-07-01T00:00:00.000Z', end: '2026-07-31T23:59:59.999Z' };

describe('searchAllAsync pagination (via fetchAppointmentReportResources)', () => {
  it('walks every page until an empty page and returns all matched resources', async () => {
    const resources = await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange });
    const appointments = resources.filter((r) => r.resourceType === 'Appointment');
    // 1000 from page 0 + 2 from page 1000; the terminal empty page stops the loop.
    expect(appointments).toHaveLength(1002);
    expect(new Set(appointments.map((a) => a.id)).size).toBe(1002);
  });

  it('ignores outcome-mode entries and non-searchset completion entries', async () => {
    const resources = await fetchAppointmentReportResources<FhirResource>(fakeOystehr, { dateRange });
    expect(resources.some((r) => r.resourceType === 'OperationOutcome')).toBe(false);
  });
});
