import { describe, expect, it } from 'vitest';
import { getRulesData, getSourceRulesData } from './data/rules-data';
import { forecastImmunizations } from './engine';
import { buildVaccineScheduleView } from './schedule-view';

const hpvForTenYearOld = (rules = getRulesData()): ReturnType<typeof forecastImmunizations>['groups'][number] =>
  forecastImmunizations({ dob: '2016-11-11', asOf: '2026-11-11', doses: [], groups: ['hpv'] }, rules).groups[0];

describe('AAP overrides', () => {
  it('a 10-year-old is due for HPV (AAP: from 9 years)', () => {
    expect(hpvForTenYearOld().status).toBe('due');
  });

  it('the CDC source data alone still starts HPV at 11 years', () => {
    expect(hpvForTenYearOld(getSourceRulesData()).status).toBe('notyet');
  });

  it('the schedule page lists the AAP as a source, for HPV', () => {
    const aap = buildVaccineScheduleView().sources.find((source) => source.name.startsWith('AAP'));
    expect(aap).toMatchObject({ version: '2026', antigens: ['HPV'] });
  });
});
