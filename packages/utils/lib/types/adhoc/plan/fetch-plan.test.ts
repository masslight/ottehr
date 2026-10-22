import { describe, expect, it } from 'vitest';
import {
  BULK_JOB_ROWS,
  bulkWindowCount,
  estimatePlanRequests,
  FETCH_PLAN_LIMITS,
  FetchStepStats,
  includeRowsEstimate,
  isRejectedStepsError,
  PAGED_WINDOW_TARGET,
  pagedWindowCount,
  planNeedsPatient,
  planUsesDateRange,
  rejectedStepsError,
  REQUEST_BUDGET,
  resolveParamTemplates,
  RunFetchPlanInputSchema,
  scopedBulkBatchSize,
  scopedPagedBatchSize,
  scopedStepSourceMismatch,
  scopedStepValues,
  stepIsDateBounded,
  toElementName,
} from './fetch-plan';

describe('toElementName', () => {
  it('maps choice-type JSON keys to their FHIR base element name', () => {
    expect(toElementName('valueQuantity')).toBe('value');
    expect(toElementName('valueString')).toBe('value');
    expect(toElementName('effectiveDateTime')).toBe('effective');
    expect(toElementName('onsetDateTime')).toBe('onset');
    expect(toElementName('performedDateTime')).toBe('performed');
    expect(toElementName('medicationCodeableConcept')).toBe('medication');
    expect(toElementName('deceasedBoolean')).toBe('deceased');
  });

  it('leaves plain and look-alike names alone', () => {
    expect(toElementName('value')).toBe('value');
    expect(toElementName('performer')).toBe('performer');
    expect(toElementName('status')).toBe('status');
    expect(toElementName('component')).toBe('component');
    expect(toElementName('meta')).toBe('meta');
  });
});

describe('scopedStepValues', () => {
  it('makes bare ids full references of the source type for a reference param without keepType', () => {
    // DiagnosticReport?based-on=<bare id> is rejected: based-on can point to several types.
    const orders = [
      { resourceType: 'ServiceRequest', id: 's1' },
      { resourceType: 'ServiceRequest', id: 's2' },
    ];
    expect(scopedStepValues(orders, { step: 's', path: 'id', param: 'based-on' })).toEqual([
      'ServiceRequest/s1',
      'ServiceRequest/s2',
    ]);
    // _id keeps bare ids
    expect(scopedStepValues(orders, { step: 's', path: 'id', param: '_id' })).toEqual(['s1', 's2']);
  });

  const visits = [
    { resourceType: 'Appointment', id: 'a1', participant: [{ actor: { reference: 'Patient/p1' } }] },
    { resourceType: 'Encounter', id: 'e1', participant: [{ individual: { reference: 'Practitioner/d1' } }] },
    { resourceType: 'Encounter', id: 'e2', participant: [{ individual: { reference: 'Practitioner/d1' } }] },
    { resourceType: 'Patient', id: 'p1' },
  ];

  it('takes bare ids only from resources of keepType', () => {
    expect(scopedStepValues(visits, { step: 'visits', path: 'id', param: 'encounter', keepType: 'Encounter' })).toEqual(
      ['Encounter/e1', 'Encounter/e2']
    );
    expect(scopedStepValues(visits, { step: 'visits', path: 'id', param: '_id', keepType: 'Patient' })).toEqual(['p1']);
  });

  it('filters references by keepType regardless of the source resource type', () => {
    expect(
      scopedStepValues(visits, {
        step: 'visits',
        path: 'participant.individual.reference',
        param: '_id',
        keepType: 'Practitioner',
      })
    ).toEqual(['d1']);
    expect(
      scopedStepValues(visits, {
        step: 'visits',
        path: 'participant.actor.reference',
        param: 'beneficiary',
        keepType: 'Patient',
      })
    ).toEqual(['Patient/p1']);
  });

  it('takes every id when there is no keepType', () => {
    expect(scopedStepValues(visits, { step: 'visits', path: 'id', param: '_id' })).toEqual(['a1', 'e1', 'e2', 'p1']);
  });
});

describe('scopedStepSourceMismatch', () => {
  const appointments = [
    { resourceType: 'Appointment', id: 'a1', participant: [{ actor: { reference: 'Patient/p1' } }] },
    { resourceType: 'Appointment', id: 'a2', participant: [{ actor: { reference: 'Location/l1' } }] },
  ];

  it('names the misuse: a bare-value path with a keepType no source resource has (the type to FETCH was written)', () => {
    const reason = scopedStepSourceMismatch(appointments, {
      step: 'visits',
      path: 'id',
      param: 'appointment',
      keepType: 'Encounter',
    });
    expect(reason).toContain('no Encounter in step "visits" (it holds Appointment)');
    expect(reason).toContain('keepType');
  });

  it('is nothing when keepType filters references, when a source resource has the type, or when the source is empty', () => {
    // references of other types are filtered, not misused: Practitioner ids over Appointments that only name Patients
    expect(
      scopedStepSourceMismatch(appointments, {
        step: 'visits',
        path: 'participant.actor.reference',
        param: '_id',
        keepType: 'Practitioner',
      })
    ).toBeUndefined();
    expect(
      scopedStepSourceMismatch(appointments, {
        step: 'visits',
        path: 'id',
        param: 'appointment',
        keepType: 'Appointment',
      })
    ).toBeUndefined();
    expect(
      scopedStepSourceMismatch(appointments, { step: 'visits', path: 'id', param: 'appointment' })
    ).toBeUndefined();
    expect(
      scopedStepSourceMismatch([], { step: 'visits', path: 'id', param: 'appointment', keepType: 'Encounter' })
    ).toBeUndefined();
  });
});

describe('resolveParamTemplates', () => {
  const range = { start: '2026-01-01T05:00:00.000Z', end: '2026-01-31T04:59:59.999Z' };

  it('fills the date range and the patient id', () => {
    expect(resolveParamTemplates('ge{{start}}', range)).toBe('ge2026-01-01T05:00:00.000Z');
    expect(resolveParamTemplates('{{startDate}}', range)).toBe('2026-01-01');
    expect(resolveParamTemplates('Patient/{{patientId}}', undefined, { patientId: 'p1' })).toBe('Patient/p1');
    expect(resolveParamTemplates('Patient/{{ patientId }}', range, { patientId: 'p1' })).toBe('Patient/p1');
  });

  it('names what is missing', () => {
    expect(() => resolveParamTemplates('Patient/{{patientId}}', range)).toThrow(/needs a patient id/);
    expect(() => resolveParamTemplates('ge{{start}}')).toThrow(/needs a date range/);
  });
});

describe('stepIsDateBounded', () => {
  it('needs both ends of the range, as instants or days', () => {
    expect(
      stepIsDateBounded({
        params: [
          { name: 'date', value: 'ge{{start}}' },
          { name: 'date', value: 'le{{end}}' },
        ],
      })
    ).toBe(true);
    expect(
      stepIsDateBounded({
        params: [
          { name: 'date', value: 'ge{{ startDate }}' },
          { name: 'date', value: 'le{{endDate}}' },
        ],
      })
    ).toBe(true);
    expect(stepIsDateBounded({ params: [{ name: 'date', value: 'ge{{start}}' }] })).toBe(false);
    expect(stepIsDateBounded({ params: [{ name: 'patient', value: 'Patient/{{patientId}}' }] })).toBe(false);
    expect(stepIsDateBounded({})).toBe(false);
  });
});

describe('planNeedsPatient and the run input', () => {
  const plan = {
    version: 1 as const,
    steps: [
      { id: 'visits', resourceType: 'Appointment', params: [{ name: 'patient', value: 'Patient/{{patientId}}' }] },
    ],
  };

  it('spots the template in any step', () => {
    expect(planNeedsPatient(plan)).toBe(true);
    expect(planNeedsPatient({ steps: [{ params: [{ name: 'date', value: 'ge{{start}}' }] }] })).toBe(false);
  });

  it('tells a date-range report from one without (a per-patient history asks for no range)', () => {
    expect(planUsesDateRange(plan)).toBe(false);
    expect(planUsesDateRange({ steps: [{ params: [{ name: 'date', value: 'ge{{start}}' }] }] })).toBe(true);
    expect(planUsesDateRange({ steps: [{ params: [{ name: 'authored', value: 'le{{ endDate }}' }] }] })).toBe(true);
  });

  it('accepts parameters on the run input', () => {
    const parsed = RunFetchPlanInputSchema.parse({ plan, parameters: { patientId: 'p1' } });
    expect(parsed.parameters?.patientId).toBe('p1');
    expect(() => RunFetchPlanInputSchema.parse({ plan, parameters: { patientId: '' } })).toThrow();
  });

  it('accepts density hints per step, and none at all', () => {
    const hints = { visits: { recordsPerDay: 441.4 }, vitals: { recordsPerId: 6.5 } };
    expect(RunFetchPlanInputSchema.parse({ plan, hints }).hints).toEqual(hints);
    expect(RunFetchPlanInputSchema.parse({ plan }).hints).toBeUndefined();
    expect(() => RunFetchPlanInputSchema.parse({ plan, hints: { visits: { recordsPerDay: -1 } } })).toThrow();
  });
});

describe('bulk job sizing', () => {
  it('cuts a date range into bulk jobs of about BULK_JOB_ROWS rows, includes counted; weekly when nothing is known', () => {
    // 2,500 records a day for 30 days: 75,000 rows → 15 jobs of 5,000.
    expect(bulkWindowCount(2500, 30)).toBe(Math.ceil((2500 * 30) / BULK_JOB_ROWS));
    expect(bulkWindowCount(2500, 30)).toBe(15);
    // a year at a busy practice (90/day): 7 jobs; with patient + encounters (3.26 rows each): 22
    expect(bulkWindowCount(90, 365)).toBe(7);
    expect(bulkWindowCount(90, 365, 3.26)).toBe(22);
    // nothing measured: a job a week
    expect(bulkWindowCount(undefined, 365)).toBe(53);
    expect(bulkWindowCount(undefined, 60)).toBe(9);
    expect(bulkWindowCount(0, 365)).toBe(1);
  });

  it('guesses rows per record from the includes before a run has measured them', () => {
    expect(includeRowsEstimate([{ name: 'date' }, { name: '_tag' }])).toBe(1);
    expect(includeRowsEstimate([{ name: '_include' }, { name: '_revinclude' }, { name: '_revinclude:iterate' }])).toBe(
      4
    );
  });

  it('cuts a paged step into windows of a few pages each', () => {
    // A year of synth visits (7.4 a day, 2,697) → 2 windows; 2,500 a day → 365.
    expect(pagedWindowCount(7.4, 365)).toBe(2);
    expect(pagedWindowCount(2500, 365)).toBe(Math.ceil((2500 * 365) / PAGED_WINDOW_TARGET));
    expect(pagedWindowCount(7.4, 7)).toBe(1);
    expect(pagedWindowCount(undefined, 365)).toBe(1);
    expect(pagedWindowCount(0, 365)).toBe(1);
    expect(PAGED_WINDOW_TARGET).toBeLessThan(FETCH_PLAN_LIMITS.autoBulkThreshold);
  });

  it('fits as many ids in a paged scoped batch as one page holds; a full batch without a hint', () => {
    // 6.5 vitals an encounter → 153 ids a batch; one encounter an appointment → 1,000.
    expect(scopedPagedBatchSize(6.5)).toBe(153);
    expect(scopedPagedBatchSize(1)).toBe(FETCH_PLAN_LIMITS.scopedBatchSize);
    expect(scopedPagedBatchSize(0.9)).toBe(FETCH_PLAN_LIMITS.scopedBatchSize);
    expect(scopedPagedBatchSize(5000)).toBe(1);
    expect(scopedPagedBatchSize(undefined)).toBe(FETCH_PLAN_LIMITS.scopedBatchSize);
    expect(scopedPagedBatchSize(0)).toBe(FETCH_PLAN_LIMITS.scopedBatchSize);
  });

  it("fits as many ids in a scoped batch as the target allows, within bounds; today's size without a hint", () => {
    expect(scopedBulkBatchSize(300)).toBe(33);
    expect(scopedBulkBatchSize(6.5)).toBe(FETCH_PLAN_LIMITS.scopedBulkBatchMax);
    expect(scopedBulkBatchSize(50_000)).toBe(1);
    expect(scopedBulkBatchSize(undefined)).toBe(FETCH_PLAN_LIMITS.scopedBatchSize);
    expect(scopedBulkBatchSize(0)).toBe(FETCH_PLAN_LIMITS.scopedBatchSize);
  });
});

describe('estimatePlanRequests', () => {
  const dated = [
    { name: 'date', value: 'ge{{start}}' },
    { name: 'date', value: 'le{{end}}' },
  ];
  const scoped = (
    id: string,
    resourceType: string,
    from: { step: string; path: string; param: string; keepType: string },
    mode?: 'bulk'
  ): { id: string; resourceType: string; from: typeof from; params: never[]; mode?: 'bulk' } => ({
    id,
    resourceType,
    from,
    params: [],
    ...(mode ? { mode } : {}),
  });
  const visitReport = {
    steps: [
      { id: 'visits', resourceType: 'Appointment', params: dated },
      scoped('encounters', 'Encounter', { step: 'visits', path: 'id', param: 'appointment', keepType: 'Appointment' }),
      scoped('patients', 'Patient', {
        step: 'visits',
        path: 'participant.actor.reference',
        param: '_id',
        keepType: 'Patient',
      }),
      scoped('locations', 'Location', {
        step: 'visits',
        path: 'participant.actor.reference',
        param: '_id',
        keepType: 'Location',
      }),
    ],
  };
  const byId = (
    estimates: ReturnType<typeof estimatePlanRequests>
  ): Record<string, ReturnType<typeof estimatePlanRequests>[number]> =>
    Object.fromEntries(estimates.map((e) => [e.id, e]));

  it('sizes a year at a busy practice as the runner would: bulk jobs for the visits, a paged batch per 250 ids after', () => {
    // 32,100 visits a year: seven bulk jobs. One Encounter per visit; a patient every 1.33 visits; ten locations in all.
    const estimates = byId(
      estimatePlanRequests(
        visitReport,
        {
          visits: { recordsPerDay: 32_100 / 365 },
          encounters: { recordsPerId: 1, idsPerSourceRecord: 1 },
          patients: { recordsPerId: 1, idsPerSourceRecord: 0.75 },
          locations: { recordsPerId: 1, idsPerSourceRecord: 10 / 32_100 },
        },
        365
      )
    );
    // jobs of ~BULK_JOB_ROWS rows: 32,100 / 5,000 → 7
    expect(estimates.visits.requests).toBe(8);
    expect(estimates.visits.records).toBeCloseTo(32_100);
    expect(estimates.visits.how).toBe('32,100 records in 7 bulk job(s)');
    expect(estimates.encounters).toMatchObject({ requests: 129, how: '32,100 ids in 129 paged batch(es) of 250' });
    expect(estimates.patients.requests).toBe(97);
    expect(estimates.locations.requests).toBe(1);
    expect(Object.values(estimates).reduce((sum, e) => sum + (e.requests ?? 0), 0)).toBeGreaterThan(REQUEST_BUDGET);
  });

  it('pages a small practice in hint-sized windows, and counts a page per 1,000 records of a batch', () => {
    // 7.4 a day (synth): 2,701 visits in two windows of two pages; 6.5 vitals an encounter → 153 ids a batch, one page each.
    const plan = {
      steps: [
        ...visitReport.steps.slice(0, 2),
        scoped('vitals', 'Observation', { step: 'encounters', path: 'id', param: 'encounter', keepType: 'Encounter' }),
      ],
    };
    const estimates = byId(
      estimatePlanRequests(
        plan,
        {
          visits: { recordsPerDay: 7.4 },
          encounters: { recordsPerId: 1, idsPerSourceRecord: 1 },
          vitals: { recordsPerId: 6.5, idsPerSourceRecord: 1 },
        },
        365
      )
    );
    expect(estimates.visits).toMatchObject({ requests: 4, how: '2,701 records in 4 page(s)' });
    expect(estimates.encounters.requests).toBe(11);
    expect(estimates.vitals).toMatchObject({ requests: 18, how: '2,701 ids in 18 paged batch(es) of 153' });

    // 5,000 records an id: one id a batch, five pages each.
    const heavy = byId(
      estimatePlanRequests(
        plan,
        { visits: { recordsPerDay: 3 }, encounters: { recordsPerId: 1 }, vitals: { recordsPerId: 5000 } },
        1
      )
    );
    expect(heavy.vitals.requests).toBe(15);
  });

  it('counts a probe and a job for mode bulk, with ids per job from the bulk target', () => {
    const plan = {
      steps: [
        { id: 'visits', resourceType: 'Appointment', mode: 'bulk' as const, params: dated },
        scoped(
          'encounters',
          'Encounter',
          { step: 'visits', path: 'id', param: 'appointment', keepType: 'Appointment' },
          'bulk'
        ),
      ],
    };
    const unsized = byId(estimatePlanRequests(plan, undefined, 365));
    expect(unsized.visits).toEqual({ id: 'visits', requests: 54, how: '53 bulk job(s)' });
    expect(unsized.encounters).toEqual({ id: 'encounters', how: 'fed by "visits", whose size is unknown' });

    const sized = byId(
      estimatePlanRequests(plan, { visits: { recordsPerDay: 32_100 / 365 }, encounters: { recordsPerId: 1 } }, 365)
    );
    expect(sized.encounters).toMatchObject({ requests: 34, how: '32,100 ids in 33 bulk job(s)' });
  });

  it('estimates nothing without a measurement, and says why', () => {
    const none = byId(estimatePlanRequests(visitReport, undefined, 365));
    expect(none.visits).toEqual({ id: 'visits', how: 'no measurement yet' });
    expect(none.encounters.how).toBe('fed by "visits", whose size is unknown');

    const sourceOnly = byId(estimatePlanRequests(visitReport, { visits: { recordsPerDay: 7.4 } }, 365));
    expect(sourceOnly.encounters).toEqual({ id: 'encounters', how: 'no measurement yet' });

    const tasks = { steps: [{ id: 'tasks', resourceType: 'Task', params: [{ name: 'status', value: 'requested' }] }] };
    expect(estimatePlanRequests(tasks, {}, 365)[0].how).toBe('not bounded by the date range, size unknown');
  });
});

describe('rejectedStepsError', () => {
  const stat = (id: string, resourceType: string, extra: Partial<FetchStepStats>): FetchStepStats => ({
    id,
    resourceType,
    ms: 1,
    count: 0,
    byType: {},
    bytes: 2,
    mode: 'normal',
    requests: 0,
    params: [],
    ...extra,
  });

  it('words only the steps the server rejected, and is recognised as a plan failure', () => {
    const error = rejectedStepsError([
      stat('visits', 'Appointment', { error: 'Unknown search parameter "foo"', rejected: true }),
      stat('conditions', 'Condition', { error: 'a single day of Condition still fails (Gateway timeout)' }),
      stat('patients', 'Patient', { mode: 'skipped', error: 'source step "visits" failed' }),
      stat('accounts', 'Account', { error: 'set type explicitly', rejected: true }),
    ]);
    expect(error).toBe(
      'The server rejected the search of step "visits" (Appointment): Unknown search parameter "foo"; ' +
        'step "accounts" (Account): set type explicitly'
    );
    expect(isRejectedStepsError(error!)).toBe(true);
  });

  it('is nothing when no step was rejected, and a runtime error is not mistaken for it', () => {
    expect(rejectedStepsError([stat('visits', 'Appointment', { error: 'still fails' })])).toBeUndefined();
    expect(rejectedStepsError([stat('visits', 'Appointment', { count: 3 })])).toBeUndefined();
    expect(isRejectedStepsError("Cannot read properties of null (reading 'useMemo')")).toBe(false);
  });
});
