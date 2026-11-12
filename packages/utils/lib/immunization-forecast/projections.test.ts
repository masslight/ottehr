import { describe, expect, it } from 'vitest';
import { forecastImmunizations } from './engine';
import { projectLaterDoses } from './projections';
import { ForecastDoseInput, ImmunizationForecastInput } from './types';

const given = (id: string, date: string, cvx: string): ForecastDoseInput => ({ id, date, cvx, source: 'administered' });

// Maya at her 4-month visit, after dose 2 of DTaP/Hib/polio and PCV (as the mockup patient, before today's doses)
const maya: ImmunizationForecastInput = {
  dob: '2026-07-08',
  sex: 'female',
  asOf: '2026-11-10',
  doses: [
    given('m1', '2026-07-08', '08'),
    given('m2', '2026-08-10', '08'),
    given('m3', '2026-09-09', '120'),
    given('m4', '2026-09-09', '216'),
    given('m5', '2026-11-10', '120'),
    given('m6', '2026-11-10', '216'),
  ],
  marks: { rota: { type: 'declined', date: '2026-11-10', by: 'J. Nurse' } },
};
const forecast = forecastImmunizations(maya);
const projections = projectLaterDoses(maya, forecast);

describe('projectLaterDoses', () => {
  it('projects the doses after the next one, each from the one before given on its recommended date', () => {
    // next: polio dose 3 at 6 months; then dose 4 at 4 years
    expect(forecast.groups.find((g) => g.group === 'ipv')?.next).toMatchObject({ n: 3, recommended: '2027-01-08' });
    expect(projections.ipv).toEqual([
      { n: 4, earliest: '2030-07-08', recommended: '2030-07-08', pastDue: '2033-08-04' },
    ]);
    // next: DTaP dose 3; then doses 4 and 5, stopping at the target of 5
    expect(projections.dtap?.map((dose) => [dose.n, dose.recommended])).toEqual([
      [4, '2027-10-08'],
      [5, '2030-07-08'],
    ]);
    expect(projections.mmr).toEqual([
      { n: 2, earliest: '2027-08-08', recommended: '2030-07-08', pastDue: '2033-08-04' },
    ]);
  });

  it('projects nothing after the last dose, for seasonal groups, or for a group with an exception', () => {
    // Hep B dose 3 is the next dose and the last
    expect(projections.hepb).toBeUndefined();
    expect(projections.flu).toBeUndefined();
    expect(projections.covid).toBeUndefined();
    expect(projections.rota).toBeUndefined();
  });

  it('leaves the forecast itself as it was', () => {
    expect(forecastImmunizations(maya)).toEqual(forecast);
  });
});
