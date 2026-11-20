import { describe, expect, it } from 'vitest';
import { forecastImmunizations } from './engine';
import { buildVaccineScheduleView } from './schedule-view';
import { ImmunizationGroupId } from './types';

const statusOf = (dob: string, id: ImmunizationGroupId): string | undefined =>
  forecastImmunizations({ dob, asOf: '2026-11-11', doses: [], groups: [id] }).groups[0]?.status;

describe('aged out: too old to start, with no dose given', () => {
  it('an unvaccinated 30-year-old is not "complete" for Hep A, MenACWY, Hib, rotavirus or polio', () => {
    for (const id of ['hepa', 'menacwy', 'hib', 'rota', 'ipv'] as const)
      expect(statusOf('1996-05-01', id), id).toBe('agedout');
    expect(statusOf('1996-05-01', 'mmr')).toBe('pastdue');
  });

  it('a 9-month-old who never had rotavirus is past the age to start it, not "complete"', () => {
    expect(statusOf('2026-02-11', 'rota')).toBe('agedout');
  });

  it('the Adults tab gives the Td/Tdap booster in adult words', () => {
    const dtap = buildVaccineScheduleView().adults.find((lane) => lane.group === 'dtap');
    expect(dtap?.target).toBe('Td or Tdap every 10 years');
  });
});
