/**
 * Readable hand tests for the two mockup patients of documents/vaccine-schedule/mockups/immunization-views-concepts.html
 * (Maya, 4-month well visit; Leo, new-patient catch-up at 5 y), plus the Ottehr-specific input rules
 * (undated doses, self-reported doses, marks, combination vaccines).
 *
 * Where the hand-drawn mockup and the CDSi data disagree, the CDSi result is asserted and the mockup value is
 * noted in a comment.
 */
import { describe, expect, it } from 'vitest';
import { forecastImmunizations } from './engine';
import {
  ForecastDoseInput,
  IMMUNIZATION_REPORT_ORIGIN,
  ImmunizationForecast,
  ImmunizationGroupForecast,
  ImmunizationGroupId,
} from './types';

const TODAY = '2026-11-10';

const CVX = {
  engerixPeds: '08',
  pediarix: '110',
  pentacel: '120',
  actHib: '48',
  pcv13: '133',
  pcv20: '216',
  rotaTeq: '116',
  rotarix: '119',
  mmr: '03',
  havrix: '83',
  beyfortus: '306',
  ppsv23: '33',
  ipv: '10',
  fluIIV3: '140',
  varivax: '21',
};

const given = (id: string, date: string, cvx: string): ForecastDoseInput => ({ id, date, cvx, source: 'administered' });
const outside = (
  id: string,
  date: string | null,
  cvx: string,
  outsideSource: ForecastDoseInput['outsideSource'] = IMMUNIZATION_REPORT_ORIGIN.OTHER_PROVIDER
): ForecastDoseInput => ({ id, date, cvx, source: 'outside', outsideSource });

const group = (forecast: ImmunizationForecast, id: ImmunizationGroupId): ImmunizationGroupForecast => {
  const g = forecast.groups.find((x) => x.group === id);
  if (!g) throw new Error(`no group ${id}`);
  return g;
};

describe('Maya Rivera, DOB 2026-07-08, 4-month well visit on 2026-11-10', () => {
  const maya = forecastImmunizations({
    dob: '2026-07-08',
    sex: 'female',
    asOf: TODAY,
    doses: [
      outside('m1', '2026-07-08', CVX.engerixPeds), // birth dose at Mercy Hospital
      given('m2', '2026-08-10', CVX.engerixPeds),
      given('m3', '2026-09-09', CVX.pentacel), // DTaP + IPV + Hib in one shot
      given('m4', '2026-09-09', CVX.pcv20),
      given('m5', '2026-09-09', CVX.rotaTeq),
      given('m6', '2026-10-06', CVX.beyfortus),
    ],
    marks: { rota: { type: 'declined', date: TODAY, by: 'J. Nurse' } },
  });

  it('uses the shipped data version and maps every CVX', () => {
    expect(maya.dataVersion).toBe('2026-11');
    expect(maya.unmappedDoses).toEqual([]);
  });

  it('Hep B: up to date, dose 3 at 24 weeks and 8 weeks after dose 2', () => {
    const hepb = group(maya, 'hepb');
    expect(hepb.status).toBe('uptodate');
    expect(hepb.targetText).toBe('3');
    expect(hepb.doses.map((d) => [d.id, d.status, d.doseNumber])).toEqual([
      ['m1', 'valid', 1],
      ['m2', 'valid', 2],
    ]);
    // 24 weeks (2026-12-23) is later than 8 weeks after dose 2 (2026-10-05)
    expect(hepb.next).toMatchObject({ n: 3, earliest: '2026-12-23', recommended: '2027-01-08' });
    // past due = 19 months + 4 weeks − 1 day (the mockup showed 2028-02-08, i.e. 19 months)
    expect(hepb.next?.pastDue).toBe('2028-03-06');
  });

  it('Pentacel counts toward DTaP, Hib and polio; PCV20 toward PCV; all four are due today', () => {
    for (const id of ['dtap', 'hib', 'ipv', 'pcv'] as const) {
      const g = group(maya, id);
      expect(g.status, id).toBe('due');
      expect(
        g.doses.filter((d) => d.counted).map((d) => d.doseNumber),
        id
      ).toEqual([1]);
      expect(g.next, id).toMatchObject({ n: 2, earliest: '2026-10-07', recommended: '2026-11-08' });
      // CDSi: latest recommended age 5 months + 4 weeks → past due 2027-01-04 (mockup showed 2026-12-08)
      expect(g.next?.pastDue, id).toBe('2027-01-04');
    }
    expect(group(maya, 'dtap').targetText).toBe('5, then Tdap at 11–12 y');
    expect(group(maya, 'pcv').next?.cvx).toEqual(['215', '216']); // PCV15 / PCV20 recommended
  });

  it('dose 1 windows: given on time at 2 months', () => {
    const dtap = group(maya, 'dtap');
    expect(dtap.doses[0].window).toEqual({ earliest: '2026-08-19', recommended: '2026-09-08', pastDue: '2026-11-04' });
    expect(dtap.doses[0].timing).toBe('on-time');
  });

  it('Rotavirus: the declined mark overrides the status but the forecast is still there', () => {
    const rota = group(maya, 'rota');
    expect(rota.status).toBe('declined');
    expect(rota.mark).toEqual({ type: 'declined', date: TODAY, by: 'J. Nurse' });
    expect(rota.seriesStatus).toBe('Not Complete');
    expect(rota.next).toMatchObject({ n: 2, earliest: '2026-10-07', recommended: '2026-11-08' });
  });

  it('RSV antibody: one dose covers the first season', () => {
    const rsv = group(maya, 'rsv');
    expect(rsv.status).toBe('complete');
    expect(rsv.targetText).toBe('1');
    expect(rsv.doses[0]).toMatchObject({ id: 'm6', status: 'valid', doseNumber: 1 });
  });

  it('Flu and COVID-19: not yet due until 6 months', () => {
    expect(group(maya, 'flu')).toMatchObject({ status: 'notyet', targetText: 'Every season' });
    expect(group(maya, 'flu').next).toMatchObject({
      n: 1,
      earliest: '2027-01-08',
      recommended: '2027-01-08',
      pastDue: null,
    });
    expect(group(maya, 'covid').next).toMatchObject({ n: 1, earliest: '2027-01-08' });
  });

  it('MMR, varicella, Hep A: not yet due until 12 months; HPV and MenACWY years away', () => {
    expect(group(maya, 'mmr').next).toMatchObject({ n: 1, earliest: '2027-07-08', recommended: '2027-07-08' });
    expect(group(maya, 'var').next).toMatchObject({ n: 1, earliest: '2027-07-08', recommended: '2027-07-08' });
    expect(group(maya, 'hepa').next).toMatchObject({ n: 1, earliest: '2027-07-08', recommended: '2027-07-08' });
    expect(group(maya, 'hpv').next).toMatchObject({ n: 1, earliest: '2035-07-08', recommended: '2035-07-08' });
    expect(group(maya, 'menacwy').next).toMatchObject({ n: 1, earliest: '2037-07-08', recommended: '2037-07-08' });
    for (const id of ['mmr', 'var', 'hepa', 'hpv', 'menacwy'] as const)
      expect(group(maya, id).status, id).toBe('notyet');
  });

  it('adult-only lanes are not shown for a child', () => {
    expect(maya.groups.map((g) => g.group)).not.toContain('pneumo-adult');
    expect(maya.groups.map((g) => g.group)).not.toContain('rsv-adult');
  });
});

describe('Leo Okafor, DOB 2021-09-14, new-patient catch-up visit on 2026-11-10', () => {
  const lakeside = (id: string, date: string, cvx: string): ForecastDoseInput => outside(id, date, cvx);
  const leo = forecastImmunizations({
    dob: '2021-09-14',
    sex: 'male',
    asOf: TODAY,
    doses: [
      outside('l1', '2021-09-14', CVX.engerixPeds, IMMUNIZATION_REPORT_ORIGIN.WRITTEN_RECORD),
      lakeside('l2', '2021-11-16', CVX.pediarix),
      lakeside('l3', '2021-11-16', CVX.actHib),
      lakeside('l4', '2021-11-16', CVX.pcv13),
      lakeside('l5', '2021-11-16', CVX.rotarix),
      lakeside('l6', '2022-01-18', CVX.pediarix),
      lakeside('l7', '2022-01-18', CVX.actHib),
      lakeside('l8', '2022-01-18', CVX.pcv13),
      lakeside('l9', '2022-01-18', CVX.rotarix),
      lakeside('l10', '2022-03-15', CVX.pediarix),
      lakeside('l11', '2022-03-15', CVX.actHib),
      lakeside('l12', '2022-03-15', CVX.pcv13),
      lakeside('l13', '2022-09-20', CVX.mmr),
      lakeside('l14', '2022-09-20', CVX.havrix),
      // Undated, recalled by the family: shown but never counted
      outside('l15', null, CVX.mmr, IMMUNIZATION_REPORT_ORIGIN.RECALL),
    ],
    marks: {
      var: { type: 'declined', date: '2026-10-02', by: 'Dr. A. Patel' },
      flu: { type: 'contraindicated', date: '2026-10-02', by: 'Dr. A. Patel' },
    },
  });

  it('Hep B: birth dose + 3 Pediarix = a complete 4-dose series', () => {
    const hepb = group(leo, 'hepb');
    expect(hepb.status).toBe('complete');
    expect(hepb.seriesNames).toEqual(['HepB 4-dose series']);
    expect(hepb.doses.map((d) => d.doseNumber)).toEqual([1, 2, 3, 4]);
  });

  it('Rotavirus: two Rotarix doses complete the 2-dose product series', () => {
    const rota = group(leo, 'rota');
    expect(rota.status).toBe('complete');
    expect(rota.seriesNames).toEqual(['Rotavirus 2-dose series']);
    expect(rota.targetText).toBe('2');
  });

  it('DTaP: at 5 y with 3 doses the 15-month dose is skipped and the 4–6 y dose is due', () => {
    const dtap = group(leo, 'dtap');
    expect(dtap.doses.filter((d) => d.counted)).toHaveLength(3);
    expect(dtap.notNeeded).toEqual([4]);
    expect(dtap.notes).toContain('Dose is not required for those 4 years or older');
    // The mockup called this "past due"; CDSi recommends the 4–6 y dose from the 4th birthday with
    // past due at 7 y, so today it is "due".
    expect(dtap.status).toBe('due');
    expect(dtap.next).toMatchObject({ n: 4, earliest: '2025-09-14', recommended: '2025-09-14', pastDue: '2028-09-13' });
  });

  it('Hib and PCV: 3 of 4 doses, no more needed at 5 y (aged out)', () => {
    for (const id of ['hib', 'pcv'] as const) {
      const g = group(leo, id);
      expect(g.status, id).toBe('complete');
      expect(g.seriesStatus, id).toBe('Aged Out');
      expect(g.targetDoses, id).toBe(4);
      expect(
        g.doses.filter((d) => d.counted),
        id
      ).toHaveLength(3);
      expect(g.notNeeded, id).toEqual([4]);
      expect(g.next, id).toBeNull();
    }
  });

  it('Polio: final dose due (4 y or older and 6 months after dose 3)', () => {
    const ipv = group(leo, 'ipv');
    expect(ipv.status).toBe('due');
    expect(ipv.next).toMatchObject({ n: 4, earliest: '2025-09-14', recommended: '2025-09-14' });
  });

  it('MMR: dose 2 due; the undated recalled dose is listed but not counted', () => {
    const mmr = group(leo, 'mmr');
    expect(mmr.status).toBe('due');
    expect(mmr.doses.map((d) => [d.id, d.status, d.reason ?? null])).toEqual([
      ['l13', 'valid', null],
      ['l15', 'not-counted', 'Date unknown'],
    ]);
    expect(mmr.doses[0].timing).toBe('on-time');
    expect(mmr.next).toMatchObject({ n: 2, earliest: '2022-10-18', recommended: '2025-09-14' });
  });

  it('Varicella: declined mark; dose 1 could have been given 28 days after the MMR (live virus spacing)', () => {
    const vari = group(leo, 'var');
    expect(vari.status).toBe('declined');
    expect(vari.next).toMatchObject({ n: 1, earliest: '2022-10-18' });
  });

  it('Hep A: dose 2 past due', () => {
    const hepa = group(leo, 'hepa');
    expect(hepa.status).toBe('pastdue');
    expect(hepa.next).toMatchObject({ n: 2, earliest: '2023-03-20', recommended: '2023-03-20' });
  });

  it('Flu: contraindicated mark; COVID-19: due this season', () => {
    expect(group(leo, 'flu').status).toBe('contraindicated');
    expect(group(leo, 'covid').status).toBe('due');
  });

  it('HPV uses the male series and is not yet due', () => {
    const hpv = group(leo, 'hpv');
    expect(hpv.seriesNames).toEqual(['HPV male 2-dose series']);
    expect(hpv.next).toMatchObject({ n: 1, earliest: '2030-09-14', recommended: '2030-09-14' });
  });
});

describe('input rules', () => {
  it('rejects malformed dates', () => {
    expect(() => forecastImmunizations({ dob: '7/8/2026', asOf: TODAY, doses: [] })).toThrow(/dob/);
    expect(() => forecastImmunizations({ dob: '2026-07-08', asOf: 'today', doses: [] })).toThrow(/asOf/);
  });

  it('recalled doses do not count, except COVID-19, flu, PPSV23 and adult polio', () => {
    const adult = forecastImmunizations({
      dob: '1970-03-10',
      asOf: TODAY,
      doses: [
        outside('flu', '2026-10-01', CVX.fluIIV3, IMMUNIZATION_REPORT_ORIGIN.RECALL),
        outside('ppsv', '2025-03-10', CVX.ppsv23, IMMUNIZATION_REPORT_ORIGIN.RECALL),
        outside('ipv', '1995-03-10', CVX.ipv, IMMUNIZATION_REPORT_ORIGIN.RECALL),
        outside('mmr', '1985-03-10', CVX.mmr, IMMUNIZATION_REPORT_ORIGIN.RECALL),
      ],
    });
    expect(group(adult, 'flu').doses[0]).toMatchObject({ id: 'flu', status: 'valid' });
    expect(group(adult, 'pneumo-adult').doses[0]).toMatchObject({ id: 'ppsv', counted: true });
    expect(group(adult, 'ipv').doses[0]).toMatchObject({ id: 'ipv', counted: true });
    expect(group(adult, 'mmr').doses[0]).toMatchObject({
      id: 'mmr',
      status: 'not-counted',
      reason: 'Unverified (patient or family recall)',
    });

    const child = forecastImmunizations({
      dob: '2020-03-10',
      asOf: TODAY,
      doses: [outside('ipv', '2020-05-10', CVX.ipv, IMMUNIZATION_REPORT_ORIGIN.RECALL)],
    });
    expect(group(child, 'ipv').doses[0].status).toBe('not-counted');
    expect(group(child, 'ipv').next?.n).toBe(1);
  });

  it('a written outside record counts like an administered dose', () => {
    const f = forecastImmunizations({
      dob: '2026-01-10',
      asOf: TODAY,
      doses: [outside('v', '2026-03-10', CVX.pentacel, IMMUNIZATION_REPORT_ORIGIN.WRITTEN_RECORD)],
    });
    for (const id of ['dtap', 'hib', 'ipv'] as const) expect(group(f, id).doses[0].counted, id).toBe(true);
  });

  it('immunity by date of birth: measles for patients born before 1957, varicella before 1980 (US-born)', () => {
    const f = forecastImmunizations({ dob: '1955-06-01', asOf: TODAY, doses: [] });
    expect(group(f, 'mmr')).toMatchObject({ status: 'immune', seriesStatus: 'Immune' });
    expect(group(f, 'var')).toMatchObject({ status: 'immune' });
    const abroad = forecastImmunizations({ dob: '1975-06-01', asOf: TODAY, birthCountry: 'Mexico', doses: [] });
    expect(group(abroad, 'var').status).not.toBe('immune');
  });

  it('a dose given too early is invalid and dose 1 is forecast again from the minimum age', () => {
    const f = forecastImmunizations({
      dob: '2026-06-01',
      asOf: TODAY,
      doses: [given('a', '2026-07-01', CVX.pentacel)], // 4 weeks old: below the 6 weeks − 4 days absolute minimum
    });
    const hib = group(f, 'hib');
    expect(hib.doses[0]).toMatchObject({ status: 'invalid', reason: 'Too young', counted: false });
    expect(hib.next).toMatchObject({ n: 1, earliest: '2026-07-13', recommended: '2026-08-01' }); // 6 weeks / 2 months
  });

  it('a live vaccine within 28 days of another live vaccine is invalid', () => {
    const f = forecastImmunizations({
      dob: '2024-01-01',
      asOf: TODAY,
      doses: [given('a', '2025-01-02', CVX.mmr), given('b', '2025-01-20', CVX.varivax)],
    });
    expect(group(f, 'var').doses[0]).toMatchObject({ status: 'invalid', reason: 'Live virus conflict' });
    expect(group(f, 'mmr').doses[0].status).toBe('valid');
  });

  it('limits the output to the requested groups and lists unmapped CVX codes', () => {
    const f = forecastImmunizations({
      dob: '2020-01-01',
      asOf: TODAY,
      doses: [given('x', '2024-01-01', '999')],
      groups: ['mmr', 'var'],
    });
    expect(f.groups.map((g) => g.group)).toEqual(['mmr', 'var']);
    expect(f.unmappedDoses.map((d) => d.id)).toEqual(['x']);
  });
});
