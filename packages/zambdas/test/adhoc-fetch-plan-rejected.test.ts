import Oystehr from '@oystehr/sdk';
import { FetchPlanSchema, rejectedStepsError } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { describe, expect, it } from 'vitest';
import { runFetchPlan } from '../src/shared/adhoc-fetch-plan';
import { isSearchRejectedError } from '../src/shared/adhoc-report';

// A search the server refuses as written (400 / 422: an unknown parameter, an invalid _include) is the plan's fault,
// so the runner flags that step `rejected` and rejectedStepsError words the failure for the planner to fix the plan.
// A search the server could not finish (504 / 413, split to the floor), a failed bulk job and a step skipped for its
// failed source are not flagged: the plan is fine there, the volume or the server is not.
const serverError = (code: number, message: string): Error => Object.assign(new Error(message), { code });

const range = { start: '2026-05-01T00:00:00.000Z', end: '2026-05-01T23:59:59.999Z' };

// Every search throws `error`; with `bulkOnly` the plain searches (the probe) answer empty and only the bulk job fails.
const failing = (error: Error, bulkOnly = false): Oystehr =>
  ({
    fhir: {
      search: async (_: unknown, options?: { mode?: string }) => {
        if (bulkOnly && options?.mode !== 'async-bulk') return { unbundle: () => [], link: [] };
        throw error;
      },
      getAsyncJob: async () => ({}),
    },
  }) as unknown as Oystehr;

const plan = (mode: 'normal' | 'bulk'): ReturnType<typeof FetchPlanSchema.parse> =>
  FetchPlanSchema.parse({
    version: 1,
    steps: [
      {
        id: 'visits',
        resourceType: 'Appointment',
        mode,
        params: [
          { name: 'date', value: 'ge{{start}}' },
          { name: 'date', value: 'le{{end}}' },
          { name: 'foo', value: 'bar' },
        ],
      },
      {
        id: 'patients',
        resourceType: 'Patient',
        from: { step: 'visits', path: 'participant.actor.reference', param: '_id', keepType: 'Patient' },
      },
    ],
  });

describe('a search the server rejected', () => {
  it('is flagged on its step and worded for the planner; the step skipped for it is not', async () => {
    const rejection = serverError(400, 'Unknown search parameter "foo"');
    const { stats } = await runFetchPlan(failing(rejection), plan('normal'), range, undefined);

    expect(stats[0]).toMatchObject({ id: 'visits', error: 'Unknown search parameter "foo"', rejected: true });
    expect(stats[1]).toMatchObject({ id: 'patients', mode: 'skipped', error: 'source step "visits" failed' });
    expect(stats[1].rejected).toBeUndefined();
    expect(rejectedStepsError(stats)).toBe(
      'The server rejected the search of step "visits" (Appointment): Unknown search parameter "foo"'
    );
  });

  it('is not a search the server could not finish', async () => {
    const { stats } = await runFetchPlan(
      failing(serverError(504, 'Gateway timeout')),
      plan('normal'),
      range,
      undefined
    );

    expect(stats[0].error).toContain('a single day of Appointment still fails (Gateway timeout)');
    expect(stats[0].rejected).toBeUndefined();
    expect(rejectedStepsError(stats)).toBeUndefined();
  });

  it('is not a bulk job the server failed after accepting the search', async () => {
    const { stats } = await runFetchPlan(
      failing(serverError(500, 'Internal Error'), true),
      plan('bulk'),
      range,
      undefined
    );

    expect(stats[0].error).toContain('Internal Error');
    expect(stats[0].rejected).toBeUndefined();
    expect(rejectedStepsError(stats)).toBeUndefined();
  });
});

describe('isSearchRejectedError', () => {
  it('is a 400 or a 422 by the code the SDK puts on the error, nothing else', () => {
    expect(isSearchRejectedError(serverError(400, 'bad request'))).toBe(true);
    expect(isSearchRejectedError(serverError(422, 'set type explicitly'))).toBe(true);
    expect(isSearchRejectedError({ code: '400' })).toBe(true);
    expect(isSearchRejectedError(serverError(504, 'Gateway timeout'))).toBe(false);
    expect(isSearchRejectedError(serverError(413, 'too large'))).toBe(false);
    expect(isSearchRejectedError(serverError(4130, 'too large'))).toBe(false);
    expect(isSearchRejectedError(serverError(500, 'Internal Error'))).toBe(false);
    expect(isSearchRejectedError(new Error('timed out'))).toBe(false);
  });
});
