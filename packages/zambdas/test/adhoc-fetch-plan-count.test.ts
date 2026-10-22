import Oystehr from '@oystehr/sdk';
import { describe, expect, it } from 'vitest';
import { runFetchPlan } from '../src/shared/adhoc-fetch-plan';

// A report that only counts asks for `_summary=count`: one search, the server's total in the step stats, no resources.
describe('a count-only step', () => {
  it('runs one search and reports the total without paging or bulk', async () => {
    const calls: { name: string; value: string }[][] = [];
    const oystehr = {
      fhir: {
        search: async ({ params }: { params: { name: string; value: string }[] }) => {
          calls.push(params);
          return { total: 5449, entry: [], link: [], unbundle: () => [] };
        },
      },
    } as unknown as Oystehr;
    const range = { start: '2026-08-01T00:00:00.000Z', end: '2026-09-30T23:59:59.999Z' };
    const { resources, stats } = await runFetchPlan(
      oystehr,
      {
        version: 1,
        steps: [
          {
            id: 'n',
            resourceType: 'Appointment',
            description: 'visits counted',
            mode: 'auto',
            params: [
              { name: 'date', value: 'ge{{start}}' },
              { name: 'date', value: 'le{{end}}' },
              { name: '_summary', value: 'count' },
            ],
          },
        ],
      },
      range,
      undefined
    );
    expect(calls).toHaveLength(1);
    expect(calls[0]).toContainEqual({ name: 'date', value: `ge${range.start}` });
    expect(calls[0].some((p) => p.name === '_count' || p.name === '_offset')).toBe(false);
    expect(resources.n).toEqual([]);
    expect(stats[0]).toMatchObject({ mode: 'normal', requests: 1, total: 5449, count: 0 });
  });

  it('does not count a per-patient step before fetching it (small, and the count cost more than it saved)', async () => {
    const calls: { name: string; value: string }[][] = [];
    const oystehr = {
      fhir: {
        search: async ({ params }: { params: { name: string; value: string }[] }) => {
          calls.push(params);
          return { total: 3, entry: [], link: [], unbundle: () => [] };
        },
      },
    } as unknown as Oystehr;
    await runFetchPlan(
      oystehr,
      {
        version: 1,
        steps: [
          {
            id: 'vitals',
            resourceType: 'Observation',
            description: "one patient's vitals",
            mode: 'auto',
            params: [{ name: 'subject', value: 'Patient/{{patientId}}' }],
          },
        ],
      },
      undefined,
      { patientId: 'p1' }
    );
    expect(calls.some((params) => params.some((p) => p.name === '_summary'))).toBe(false);
    expect(calls).toHaveLength(1);
  });
});
