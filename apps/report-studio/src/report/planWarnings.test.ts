import type { FetchPlanInput, FetchStepInput, FetchStepStats } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { describe, expect, it } from 'vitest';
import { heavySearchWarnings, ID_LIST_WARNING_VALUES, idListWarnings, requestBudgetWarnings } from './planWarnings';

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
  it('warns when the saved densities put the plan over the budget, naming the steps that cost and the by-date searches', () => {
    // A year at a busy practice: 32,279 visits (2 bulk jobs), the Encounters and Patients by lists of ids (130 + 97 batches).
    const warnings = requestBudgetWarnings(
      visitReport,
      {
        visits: { recordsPerDay: 32_279 / 365 },
        encounters: { recordsPerId: 1, idsPerSourceRecord: 1 },
        patients: { recordsPerId: 1, idsPerSourceRecord: 0.75 },
        locations: { recordsPerId: 1, idsPerSourceRecord: 10 / 32_279 },
      },
      year
    );
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('the plan should take ~231 requests on this date range, over the budget of 20');
    expect(warnings[0]).toContain('"encounters" ~130 (32,279 ids in 130 paged batch(es) of 250)');
    expect(warnings[0]).toContain('"patients" ~97');
    expect(warnings[0]).not.toContain('"locations"');
    expect(warnings[0]).toContain('Encounter?appointment.date=ge{{start}}&appointment.date=le{{end}}');
    expect(warnings[0]).toContain(
      'Patient?_has:Appointment:patient:date=ge{{start}}&_has:Appointment:patient:date=le{{end}}'
    );
    expect(warnings[0]).not.toContain('Not counted');
  });

  it('names the steps it could not count', () => {
    const warnings = requestBudgetWarnings(
      visitReport,
      { visits: { recordsPerDay: 32_279 / 365 }, encounters: { recordsPerId: 1, idsPerSourceRecord: 1 } },
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

  it('points a long id list at the by-date search for its type', () => {
    const warnings = idListWarnings([
      stat({ id: 'visits', resourceType: 'Appointment', byType: { Appointment: 32_279 }, mode: 'bulk', requests: 3 }),
      stat({
        id: 'encounters',
        resourceType: 'Encounter',
        byType: { Encounter: 32_279 },
        scopedValues: 32_279,
        requests: 130,
      }),
      stat({
        id: 'patients',
        resourceType: 'Patient',
        byType: { Patient: 24_209 },
        scopedValues: 24_209,
        requests: 97,
      }),
      stat({
        id: 'vitals',
        resourceType: 'Observation',
        byType: { Observation: 60_000 },
        scopedValues: 32_279,
        requests: 130,
      }),
    ]);
    expect(warnings).toEqual([
      'step "encounters" fetches 32,279 Encounter by a list of 32,279 ids (130 requests); fetch it by date instead, ' +
        'e.g. Encounter?appointment.date=ge{{start}}&appointment.date=le{{end}}',
      'step "patients" fetches 24,209 Patient by a list of 24,209 ids (97 requests); fetch it by date instead, ' +
        'e.g. Patient?_has:Appointment:patient:date=ge{{start}}&_has:Appointment:patient:date=le{{end}}',
      'step "vitals" fetches 60,000 Observation by a list of 32,279 ids (130 requests); fetch it by date instead, ' +
        'e.g. Observation by a date parameter of its own over {{start}}..{{end}} (see the data map)',
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
