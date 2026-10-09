import { describe, expect, it } from 'vitest';
import { ROUTER_PATH } from '../../src/features/visits/in-person/routing/routesInPerson';
import { formPagePath } from '../../src/features/visits/shared/components/patient-forms/formNavigation';

// formNavigation spells the chart routes out to avoid an import cycle; this keeps them in step with the routes.
describe('formPagePath', () => {
  it('points each chart form type at its in-person route', () => {
    expect(formPagePath('screening', 'appt-1')).toBe(`/in-person/appt-1/${ROUTER_PATH.SCREENING}`);
    expect(formPagePath('questionnaires', 'appt-1')).toBe(`/in-person/appt-1/${ROUTER_PATH.QUESTIONNAIRES}`);
  });

  it('keeps a follow-up note open on its own encounter, and sends Visit details forms to Visit Details', () => {
    expect(formPagePath('questionnaires', 'appt-1', 'enc-2')).toBe(
      `/in-person/appt-1/${ROUTER_PATH.QUESTIONNAIRES}?encounterId=enc-2`
    );
    expect(formPagePath('visit-details', 'appt-1', 'enc-2')).toBe('/visit/appt-1');
  });
});
