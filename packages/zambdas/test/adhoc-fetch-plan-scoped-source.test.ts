import Oystehr from '@oystehr/sdk';
import { FetchPlanSchema, rejectedStepsError } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { describe, expect, it } from 'vitest';
import { runFetchPlan } from '../src/shared/adhoc-fetch-plan';

// A scoped step whose "keepType" no source resource has (the planner wrote the type it wanted FETCHED — Encounter
// over an Appointments step) feeds no ids. That is the plan's fault, so the runner flags the step rejected with
// the reason, and the planner is asked to fix the plan, instead of a silent empty step (OTR-3736 browser test).
type Params = { name: string; value: string }[];

const range = { start: '2026-05-01T00:00:00.000Z', end: '2026-05-01T23:59:59.999Z' };

const searches: { resourceType: string; params: Params }[] = [];

const fake = {
  fhir: {
    search: async ({ resourceType, params }: { resourceType: string; params?: Params }) => {
      searches.push({ resourceType, params: params ?? [] });
      const resources =
        resourceType === 'Appointment'
          ? [{ resourceType: 'Appointment', id: 'a1', status: 'fulfilled', participant: [] }]
          : resourceType === 'Encounter'
          ? [
              {
                resourceType: 'Encounter',
                id: 'e1',
                status: 'finished',
                class: {},
                appointment: [{ reference: 'Appointment/a1' }],
              },
            ]
          : [];
      return { unbundle: () => resources, link: [] };
    },
  },
} as unknown as Oystehr;

const plan = (keepType: string | undefined): ReturnType<typeof FetchPlanSchema.parse> =>
  FetchPlanSchema.parse({
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
      {
        id: 'encounters',
        resourceType: 'Encounter',
        from: { step: 'visits', path: 'id', param: 'appointment', ...(keepType ? { keepType } : {}) },
      },
    ],
  });

describe('a scoped step whose keepType is not a type of its source', () => {
  it('is rejected with the source types named, and runs no search', async () => {
    searches.length = 0;
    const { stats } = await runFetchPlan(fake, plan('Encounter'), range, undefined);

    expect(stats[1]).toMatchObject({ id: 'encounters', scopedValues: 0, count: 0, rejected: true });
    expect(stats[1].error).toContain('no Encounter in step "visits" (it holds Appointment)');
    expect(searches.filter((s) => s.resourceType === 'Encounter')).toHaveLength(0);
    expect(rejectedStepsError(stats)).toContain('step "encounters" (Encounter)');
  });

  it('feeds the appointment ids as references when keepType is the source type, or left out', async () => {
    for (const keepType of ['Appointment', undefined]) {
      searches.length = 0;
      const { stats, resources } = await runFetchPlan(fake, plan(keepType), range, undefined);

      expect(stats[1]).toMatchObject({ id: 'encounters', scopedValues: 1, count: 1 });
      expect(stats[1].error).toBeUndefined();
      expect(searches.find((s) => s.resourceType === 'Encounter')?.params).toContainEqual({
        name: 'appointment',
        value: 'Appointment/a1',
      });
      expect(resources.encounters).toHaveLength(1);
    }
  });
});
