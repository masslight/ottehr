import { describe, expect, it } from 'vitest';
import { HPV_GUIDANCE, MMRV_GUIDANCE } from './data/aap-overrides';
import { getRulesData, getSourceRulesData, RulesData } from './data/rules-data';
import { forecastImmunizations } from './engine';
import { buildVaccineScheduleView } from './schedule-view';
import { ForecastDoseInput, ImmunizationGroupForecast, ImmunizationGroupId } from './types';

const given = (id: string, date: string, cvx: string): ForecastDoseInput => ({ id, date, cvx, source: 'administered' });

const groupFor = (
  group: ImmunizationGroupId,
  dob: string,
  asOf: string,
  doses: ForecastDoseInput[] = [],
  rules: RulesData = getRulesData()
): ImmunizationGroupForecast => forecastImmunizations({ dob, asOf, doses, groups: [group] }, rules).groups[0];

const hpvForTenYearOld = (rules = getRulesData()): ImmunizationGroupForecast =>
  groupFor('hpv', '2016-11-11', '2026-11-11', [], rules);

const mmrvBeginAge = (rules: RulesData, antigen: string, doseIndex: number): string | undefined =>
  rules.antigens.get(antigen)?.series[0].doses[doseIndex].preferableVaccines.find((vaccine) => vaccine.cvx === '94')
    ?.beginAge;

describe('AAP overrides', () => {
  describe('HPV', () => {
    it('a 10-year-old is due for HPV (AAP: from 9 years)', () => {
      expect(hpvForTenYearOld().status).toBe('due');
    });

    it('the CDC source data alone still starts HPV at 11 years', () => {
      expect(hpvForTenYearOld(getSourceRulesData()).status).toBe('notyet');
    });

    it('the note says 9 to 12 years, not the ACIP 11 or 12; the CDC data still carries the ACIP text', () => {
      expect(hpvForTenYearOld().next?.note).toBe(HPV_GUIDANCE);
      expect(hpvForTenYearOld(getSourceRulesData()).next?.note).toMatch(/ACIP recommends routine HPV vaccination/);
      const hpv = buildVaccineScheduleView().children.find((lane) => lane.group === 'hpv');
      expect(hpv?.guidance[0]).toBe(HPV_GUIDANCE);
      expect(hpv?.guidance.join(' ')).not.toMatch(/11 or 12/);
    });
  });

  describe('MMRV', () => {
    it('is preferable for dose 1 from 12 months on every MMR and varicella antigen; dose 2 keeps the CDC 4 years', () => {
      for (const antigen of ['Measles', 'Mumps', 'Rubella', 'Varicella']) {
        expect(mmrvBeginAge(getRulesData(), antigen, 0)).toBe('12 months');
        expect(mmrvBeginAge(getRulesData(), antigen, 1)).toBe('4 years');
        expect(mmrvBeginAge(getSourceRulesData(), antigen, 0)).toBe('4 years');
      }
    });

    it('MMR and varicella still name no forecast vaccine type, so MMR plus varicella and MMRV all match a due dose', () => {
      expect(groupFor('mmr', '2025-11-11', '2026-11-11').next?.cvx).toEqual([]);
      expect(groupFor('var', '2025-11-11', '2026-11-11').next?.cvx).toEqual([]);
    });

    it('the AAP preference text is the MMR and varicella note, before the CDC guidance', () => {
      expect(groupFor('mmr', '2025-11-11', '2026-11-11').next?.note).toBe(MMRV_GUIDANCE);
      expect(groupFor('var', '2025-11-11', '2026-11-11').next?.note).toBe(MMRV_GUIDANCE);
      const varicella = buildVaccineScheduleView().children.find((lane) => lane.group === 'var');
      expect(varicella?.guidance[0]).toBe(MMRV_GUIDANCE);
      expect(varicella?.guidance[1]).toMatch(/HIV-infected/);
      // the 13+ series has no MMRV and takes no MMRV text
      expect(getRulesData().antigens.get('Varicella')?.series[1].seriesAdminGuidance[0]).not.toBe(MMRV_GUIDANCE);
    });
  });

  describe('DTaP dose 4', () => {
    const primary = [given('d1', '2025-03-01', '20'), given('d2', '2025-05-01', '20'), given('d3', '2025-07-01', '20')];

    it('can be given at 12 months once 6 months have passed since dose 3 (CDC data: 15 months)', () => {
      const dtap = groupFor('dtap', '2025-01-01', '2025-12-01', primary);
      expect(dtap.next).toMatchObject({ n: 4, earliest: '2026-01-01', recommended: '2026-04-01' });
      expect(groupFor('dtap', '2025-01-01', '2025-12-01', primary, getSourceRulesData()).next?.earliest).toBe(
        '2026-04-01'
      );
    });

    it('waits for 6 months after a late dose 3 even past 12 months', () => {
      const lateThird = [primary[0], primary[1], given('d3', '2025-09-01', '20')];
      expect(groupFor('dtap', '2025-01-01', '2025-12-01', lateThird).next?.earliest).toBe('2026-03-01');
    });

    it('still counts a dose 4 given at 12 months only 4 months after dose 3 (the retrospective rule)', () => {
      const doses = [primary[0], primary[1], given('d3', '2025-08-20', '20'), given('d4', '2026-01-02', '20')];
      const dtap = groupFor('dtap', '2025-01-01', '2026-02-01', doses);
      expect(dtap.doses.find((dose) => dose.id === 'd4')?.status).toBe('valid');
      expect(dtap.next?.n).toBe(5);
    });

    it('a dose 4 before 12 months is still too young', () => {
      const doses = [...primary, given('d4', '2025-12-20', '20')];
      expect(groupFor('dtap', '2025-01-01', '2026-02-01', doses).doses.find((dose) => dose.id === 'd4')).toMatchObject({
        status: 'invalid',
        reason: 'Too young',
      });
    });
  });

  it('the schedule page lists the AAP as a source, for HPV, MMR, varicella and DTaP', () => {
    const aap = buildVaccineScheduleView().sources.find((source) => source.name.startsWith('AAP'));
    expect(aap).toMatchObject({
      version: '2026',
      antigens: ['HPV', 'Measles', 'Mumps', 'Rubella', 'Varicella', 'Diphtheria', 'Tetanus', 'Pertussis'],
    });
    const dtap = buildVaccineScheduleView().children.find((lane) => lane.group === 'dtap');
    expect(dtap?.doses[3]).toMatchObject({ label: 'Dose 4', minAge: '12 months', recommendedAge: '15 months' });
  });
});
