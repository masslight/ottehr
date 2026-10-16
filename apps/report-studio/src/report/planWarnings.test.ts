import type { FetchPlanInput, FetchStepInput, FetchStepStats } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { describe, expect, it } from 'vitest';
import {
  dateFieldWarnings,
  heavySearchWarnings,
  ID_LIST_WARNING_VALUES,
  idListWarnings,
  requestBudgetWarnings,
} from './planWarnings';

const dated = [
  { name: 'date', value: 'ge{{start}}' },
  { name: 'date', value: 'le{{end}}' },
];
const includes = [
  { name: '_include', value: 'Appointment:patient' },
  { name: '_include', value: 'Appointment:location' },
  { name: '_revinclude', value: 'Encounter:appointment' },
  { name: '_revinclude:iterate', value: 'Procedure:encounter' },
];
const plan = (...steps: FetchStepInput[]): FetchPlanInput => ({ version: 1, steps });

describe('heavySearchWarnings', () => {
  it('warns on a date-range search with _include / _revinclude, naming the types it pulls in', () => {
    const warnings = heavySearchWarnings(
      plan({ id: 'visits', resourceType: 'Appointment', params: [...dated, ...includes] })
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('step "visits" pulls in Patient, Location, Encounter, Procedure');
    expect(warnings[0]).toContain('separate scoped steps with elements');
  });

  it('uses the explicit target type of an _include when one is given', () => {
    const warnings = heavySearchWarnings(
      plan({
        id: 'coverages',
        resourceType: 'Coverage',
        params: [
          { name: 'period', value: 'ge{{startDate}}' },
          { name: 'period', value: 'le{{endDate}}' },
          { name: '_include', value: 'Coverage:payor:Organization' },
        ],
      })
    );
    expect(warnings[0]).toContain('pulls in Organization');
  });

  it('says nothing for a date-range search without includes, a scoped step, or an unbounded search', () => {
    expect(
      heavySearchWarnings(
        plan(
          { id: 'visits', resourceType: 'Appointment', params: dated, elements: ['start'] },
          {
            id: 'encounters',
            resourceType: 'Encounter',
            from: { step: 'visits', path: 'id', param: 'appointment', keepType: 'Appointment' },
            params: [{ name: '_revinclude', value: 'Encounter:part-of' }],
          },
          { id: 'tasks', resourceType: 'Task', params: [{ name: 'status', value: 'requested' }, ...includes] }
        )
      )
    ).toEqual([]);
  });

  it('allows includes on a search bounded by one patient', () => {
    expect(
      heavySearchWarnings(
        plan({
          id: 'visits',
          resourceType: 'Appointment',
          params: [{ name: 'patient', value: 'Patient/{{patientId}}' }, ...dated, ...includes],
        })
      )
    ).toEqual([]);
  });
});

const year = { start: '2025-10-14T00:00:00.000Z', end: '2026-10-14T00:00:00.000Z' };
const scoped = (id: string, resourceType: string, path: string, keepType: string): FetchStepInput => ({
  id,
  resourceType,
  from: {
    step: 'visits',
    path,
    param: keepType === 'Patient' || keepType === 'Location' ? '_id' : 'appointment',
    keepType,
  },
  params: [],
});
const visitReport = plan(
  { id: 'visits', resourceType: 'Appointment', params: dated },
  scoped('encounters', 'Encounter', 'id', 'Appointment'),
  scoped('patients', 'Patient', 'participant.actor.reference', 'Patient'),
  scoped('locations', 'Location', 'participant.actor.reference', 'Location')
);

describe('requestBudgetWarnings', () => {
  const busyYear = {
    visits: { recordsPerDay: 32_279 / 365 },
    encounters: { recordsPerId: 1, idsPerSourceRecord: 1 },
    patients: { recordsPerId: 1, idsPerSourceRecord: 0.75 },
    locations: { recordsPerId: 1, idsPerSourceRecord: 10 / 32_279 },
  };

  it('does not count paged batches of a scoped id list, which are cheap on production', () => {
    // A year at a busy practice: 7 bulk jobs for the visits, then 130 + 97 paged batches by id (5.4 s and 2.4 s on
    // practice B, faster than the same records by visit date) — under the budget.
    expect(requestBudgetWarnings(visitReport, busyYear, year)).toEqual([]);
  });

  it('warns when bulk work puts the plan over the budget, naming the steps and what to trim', () => {
    // 2,000 visits a day, each bringing 3 rows: 2.2 million rows → 438 bulk jobs.
    const warnings = requestBudgetWarnings(
      visitReport,
      { ...busyYear, visits: { recordsPerDay: 2000, rowsPerRecord: 3 } },
      year
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/the plan should take ~\d+ requests on this date range, over the budget of 60/);
    expect(warnings[0]).toContain('"visits" ~');
    expect(warnings[0]).not.toContain('"encounters"');
    expect(warnings[0]).toContain('_summary=count');
    expect(warnings[0]).not.toContain('Not counted');
  });

  it('names the steps it could not count', () => {
    const warnings = requestBudgetWarnings(
      visitReport,
      { visits: { recordsPerDay: 2000, rowsPerRecord: 3 }, encounters: { recordsPerId: 1, idsPerSourceRecord: 1 } },
      year
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Not counted: "patients" (no measurement yet), "locations" (no measurement yet).');
  });

  it('says nothing under the budget, or before a first run has measured anything', () => {
    // Two visits a day: one page, three batches of Encounters, three of Patients, one of Locations.
    expect(
      requestBudgetWarnings(
        visitReport,
        {
          visits: { recordsPerDay: 2 },
          encounters: { recordsPerId: 1, idsPerSourceRecord: 1 },
          patients: { recordsPerId: 1, idsPerSourceRecord: 0.75 },
          locations: { recordsPerId: 1, idsPerSourceRecord: 10 / 730 },
        },
        year
      )
    ).toEqual([]);
    expect(requestBudgetWarnings(visitReport, undefined, year)).toEqual([]);
  });
});

describe('idListWarnings', () => {
  const stat = (partial: Partial<FetchStepStats> & Pick<FetchStepStats, 'id' | 'resourceType'>): FetchStepStats => ({
    ms: 1,
    count: 0,
    byType: {},
    bytes: 0,
    mode: 'normal',
    requests: 1,
    params: [],
    ...partial,
  });

  it('points a long id list run as bulk jobs at paged batches, and lets paged ones pass', () => {
    const warnings = idListWarnings([
      stat({ id: 'visits', resourceType: 'Appointment', byType: { Appointment: 32_279 }, mode: 'bulk', requests: 3 }),
      stat({
        id: 'vitals',
        resourceType: 'Observation',
        byType: { Observation: 170_270 },
        scopedValues: 52_638,
        mode: 'bulk',
        requests: 54,
      }),
      stat({
        id: 'encounters',
        resourceType: 'Encounter',
        byType: { Encounter: 52_638 },
        scopedValues: 32_279,
        requests: 130,
      }),
    ]);
    expect(warnings).toEqual([
      'step "vitals" fetched 170,270 Observation by a list of 52,638 ids as bulk jobs (54 requests); paged batches ' +
        'are faster for a scoped step — set its mode to "auto"',
    ]);
  });

  it('lets a short list, and a failed step, pass', () => {
    expect(
      idListWarnings([
        stat({ id: 'locations', resourceType: 'Location', byType: { Location: 10 }, scopedValues: 10 }),
        stat({ id: 'encounters', resourceType: 'Encounter', scopedValues: ID_LIST_WARNING_VALUES, requests: 4 }),
        stat({ id: 'patients', resourceType: 'Patient', scopedValues: 5000, requests: 0, error: 'boom' }),
      ])
    ).toEqual([]);
  });
});

describe('dateFieldWarnings', () => {
  const step = (id: string, resourceType: string, params: { name: string; value: string }[]) => ({
    id,
    resourceType,
    description: id,
    mode: 'auto' as const,
    params,
  });
  it('flags clinical records searched by a date Ottehr leaves empty, and follow-ups searched with ge', () => {
    const warnings = dateFieldWarnings({
      version: 1,
      steps: [
        step('dx', 'Condition', [{ name: 'recorded-date', value: 'ge{{start}}' }]),
        step('qr', 'QuestionnaireResponse', [{ name: 'authored', value: 'ge{{start}}' }]),
        step('fu', 'Encounter', [
          { name: 'date', value: 'ge{{start}}' },
          { name: 'date', value: 'le{{end}}' },
          { name: 'part-of:missing', value: 'false' },
        ]),
      ],
    });
    expect(warnings).toHaveLength(3);
    expect(warnings[0]).toContain('step "dx" searches Condition by recorded-date');
    expect(warnings[1]).toContain('QuestionnaireResponse by authored');
    expect(warnings[2]).toContain('date=sa{{start}}&date=le{{end}}');
  });
  it('lets the scoped and starts-after shapes pass', () => {
    expect(
      dateFieldWarnings({
        version: 1,
        steps: [
          step('fu', 'Encounter', [
            { name: 'date', value: 'sa{{start}}' },
            { name: 'date', value: 'le{{end}}' },
            { name: 'part-of:missing', value: 'false' },
          ]),
          step('v', 'Observation', [{ name: 'date', value: 'ge{{start}}' }]),
        ],
      })
    ).toEqual([]);
  });
});
