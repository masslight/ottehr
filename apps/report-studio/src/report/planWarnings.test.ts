import type { FetchPlanInput, FetchStepInput } from 'utils/lib/types/adhoc/plan/fetch-plan';
import { describe, expect, it } from 'vitest';
import { heavySearchWarnings } from './planWarnings';

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
