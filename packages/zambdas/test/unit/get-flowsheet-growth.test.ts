import { Appointment, Encounter, Location, Observation } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL, TIMEZONE_EXTENSION_URL } from 'utils/lib/fhir/constants';
import {
  formatAge,
  formatPercentile,
  lmsAt,
  normCdf,
  valueAtZ,
  zForPercentile,
  zOf,
} from 'utils/lib/helpers/vitals/growth-lms';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, test } from 'vitest';
import {
  ageMonthsAt,
  buildGrowthFlowsheet,
  chartSetAt,
  percentileOf,
  scoreOn,
  weightForLengthPercentileOf,
} from '../../src/ehr/get-flowsheet/growth';
import { GROWTH_TABLES } from '../../src/ehr/get-flowsheet/growth-tables.generated';

const PATIENT = 'Patient/p1';

const vital = (field: VitalFieldNames, encounterId: string, effectiveDateTime: string, value: number): Observation => ({
  resourceType: 'Observation',
  id: `${field}-${encounterId}-${effectiveDateTime}`,
  status: 'final',
  code: { text: field },
  subject: { reference: PATIENT },
  encounter: { reference: `Encounter/${encounterId}` },
  effectiveDateTime,
  valueQuantity: { value },
  meta: { tag: [{ system: `${PRIVATE_EXTENSION_BASE_URL}/${PATIENT_VITALS_META_SYSTEM}`, code: field }] },
});

const appointments: Appointment[] = [
  {
    resourceType: 'Appointment',
    id: 'a1',
    status: 'fulfilled',
    start: '2024-07-10T14:00:00.000Z',
    meta: { tag: [{ code: 'OTTEHR-IP' }] },
    participant: [],
  },
  {
    resourceType: 'Appointment',
    id: 'a2',
    status: 'fulfilled',
    start: '2034-01-10T14:00:00.000Z',
    meta: { tag: [{ code: 'OTTEHR-IP' }] },
    participant: [],
  },
];
const encounters: Encounter[] = [
  {
    resourceType: 'Encounter',
    id: 'e1',
    status: 'finished',
    class: { code: 'AMB' },
    appointment: [{ reference: 'Appointment/a1' }],
  },
  {
    resourceType: 'Encounter',
    id: 'e2',
    status: 'finished',
    class: { code: 'AMB' },
    appointment: [{ reference: 'Appointment/a2' }],
  },
];

// A girl born 2024-01-10: a 6-month visit (WHO) and a 10-year visit (CDC).
const observations: Observation[] = [
  vital(VitalFieldNames.VitalWeight, 'e1', '2024-07-10T14:05:00.000Z', 7.3),
  vital(VitalFieldNames.VitalHeight, 'e1', '2024-07-10T14:06:00.000Z', 65),
  vital(VitalFieldNames.VitalHeadCircumference, 'e1', '2024-07-10T14:07:00.000Z', 42),
  vital(VitalFieldNames.VitalWeight, 'e2', '2034-01-10T14:05:00.000Z', 32),
  vital(VitalFieldNames.VitalHeight, 'e2', '2034-01-10T14:06:00.000Z', 138),
  vital(VitalFieldNames.VitalHeadCircumference, 'e2', '2034-01-10T14:07:00.000Z', 52),
];
const resources = {
  appointments,
  encounters,
  conditions: [],
  practitioners: [],
  observations,
  birthDate: '2024-01-10',
  gender: 'female' as const,
};

describe('growth math (ported from the OTR-3741 growth-charts report)', () => {
  test('the median of a table row is the 50th percentile', () => {
    // WHO weight-for-age, boys, 12 months: M = 9.6479 (table row, no interpolation).
    expect(lmsAt(GROWTH_TABLES['WHO wfa male'], 12)?.M).toBe(9.6479);
    expect(percentileOf('weight', 9.6479, 12, 'male')).toBe('50th');
    // CDC stature-for-age, girls, at a half-month table row.
    const sfa = lmsAt(GROWTH_TABLES['CDC sfa female'], 120.5);
    expect(sfa).toBeDefined();
    expect(percentileOf('height', sfa!.M, 120.5, 'female')).toBe('50th');
    // WHO head-circumference-for-age, boys, 6 months: M = 43.3306.
    expect(percentileOf('headCircumference', 43.3306, 6, 'male')).toBe('50th');
  });

  test('interpolates L, M and S between table rows', () => {
    const a = lmsAt(GROWTH_TABLES['WHO lfa female'], 6)!;
    const b = lmsAt(GROWTH_TABLES['WHO lfa female'], 7)!;
    const mid = lmsAt(GROWTH_TABLES['WHO lfa female'], 6.5)!;
    expect(mid.M).toBeCloseTo((a.M + b.M) / 2, 10);
    expect(mid.S).toBeCloseTo((a.S + b.S) / 2, 10);
    expect(lmsAt(GROWTH_TABLES['WHO lfa female'], 24.01)).toBeUndefined();
  });

  test('z-score and normal CDF', () => {
    const p = { L: 0, M: 10, S: 0.1 };
    expect(zOf(p, 10 * Math.exp(0.1))).toBeCloseTo(1, 10);
    expect(normCdf(0)).toBeCloseTo(0.5, 10);
    expect(normCdf(1.959964)).toBeCloseTo(0.975, 6);
    expect(formatPercentile(1)).toBe('84th');
    expect(formatPercentile(-2.5)).toBe('<1st');
    expect(formatPercentile(2.5)).toBe('>99th');
    expect(formatPercentile(0.6)).toBe('73rd');
  });

  test('WHO weight-based indicators use the restricted z-score beyond 3 SD, and implausible values get no percentile', () => {
    // 20 kg at 12 months (boys): z ≈ 6.8 unrestricted, ≈ 7.9 restricted — above WHO's +5 limit.
    expect(percentileOf('weight', 20, 12, 'male')).toBe('implausible');
    // 14 kg at 12 months: restricted z ≈ 3.5 — a real (if extreme) value.
    expect(percentileOf('weight', 14, 12, 'male')).toBe('>99th');
  });

  test('weight-for-length: WHO table by length in cm, restricted z, ±5 implausible limit', () => {
    const atMedian = lmsAt(GROWTH_TABLES['WHO wfl female'], 65)!;
    expect(weightForLengthPercentileOf(atMedian.M, 65, 'female')).toBe('50th');
    expect(weightForLengthPercentileOf(20, 65, 'female')).toBe('implausible');
    expect(weightForLengthPercentileOf(7, 44.5, 'female')).toBeUndefined();
    expect(weightForLengthPercentileOf(20, 110.5, 'female')).toBeUndefined();
    // A pair built from an implausible length is implausible even though the table would give a number.
    const implausibleLength = buildGrowthFlowsheet({
      ...resources,
      observations: [
        vital(VitalFieldNames.VitalWeight, 'e1', '2024-07-10T14:05:00.000Z', 7.3),
        vital(VitalFieldNames.VitalHeight, 'e1', '2024-07-10T14:06:00.000Z', 100),
      ],
    }).visits[0];
    expect(implausibleLength.values.heightPercentile.value).toBe('implausible');
    expect(implausibleLength.values.weightForLengthPercentile.value).toBe('implausible');
  });

  test('picks WHO under 24 months and CDC from 24 months; BMI is CDC only, head circumference WHO only', () => {
    expect(percentileOf('bmi', 17, 12, 'female')).toBeUndefined();
    expect(percentileOf('bmi', 16.5, 60, 'female')).toMatch(/th$|st$|nd$|rd$/);
    expect(percentileOf('headCircumference', 48, 30, 'female')).toBeUndefined();
    expect(percentileOf('weight', 12, 23.9, 'female')).toBe(
      formatPercentile(zOf(lmsAt(GROWTH_TABLES['WHO wfa female'], 23.9)!, 12, true))
    );
    expect(percentileOf('weight', 40, 241, 'female')).toBeUndefined();
  });

  test('age in months from the birth date to the measurement day in its own zone', () => {
    // 2007-03-31 -> 2007-10-01 is 184 days.
    expect(ageMonthsAt('2007-03-31', '2007-10-01T13:30:00.000Z')).toBeCloseTo(184 / 30.4375, 10);
    // 03:30 on Oct 1 in UTC+9 is still Oct 1 where it was recorded, even though it is Sep 30 in UTC.
    expect(ageMonthsAt('2007-03-31', '2007-10-01T03:30:00+09:00')).toBeCloseTo(184 / 30.4375, 10);
    expect(ageMonthsAt('2007-03-31', 'not a date')).toBeUndefined();
    // An appointment start is stored in UTC: 00:30Z on Apr 1 is 20:30 on Mar 31 in New York, so age 0 there.
    expect(ageMonthsAt('2026-03-31', '2026-04-01T00:30:00.000Z', 'America/New_York')).toBe(0);
    expect(ageMonthsAt('2026-03-31', '2026-04-01T00:30:00.000Z')).toBeCloseTo(1 / 30.4375, 10);
    expect(ageMonthsAt('2026-03-31', '2026-04-01T00:30:00.000Z', 'Not/A_Zone')).toBeCloseTo(1 / 30.4375, 10);
    expect(formatAge(0.5)).toBe('15 d');
    expect(formatAge(13.9)).toBe('13 mo');
    expect(formatAge(24)).toBe('2 y');
    expect(formatAge(54.2)).toBe('4 y 6 mo');
  });
});

describe('buildGrowthFlowsheet', () => {
  test('one column per visit with measurements, BMI from the visit pair, age and percentiles', () => {
    const [cdcVisit, whoVisit] = buildGrowthFlowsheet(resources).visits;
    expect(whoVisit.encounterId).toBe('e1');
    expect(whoVisit.values.age.value).toBe('5 mo'); // 182 days = 5.98 months
    expect(whoVisit.values.weight.value).toBe(7.3);
    expect(whoVisit.values.height.value).toBe(65);
    expect(whoVisit.values.headCircumference.value).toBe(42);
    expect(whoVisit.values.bmi.value).toBeCloseTo(7.3 / 0.65 ** 2, 10);
    expect(whoVisit.values.bmi.time).toBe('2024-07-10T14:06:00.000Z');
    expect(whoVisit.values.weightPercentile.value).toMatch(/^(<1st|>99th|\d+(st|nd|rd|th))$/);
    expect(whoVisit.values.heightPercentile.value).toMatch(/^(<1st|>99th|\d+(st|nd|rd|th))$/);
    expect(whoVisit.values.headCircumferencePercentile.value).toMatch(/^(<1st|>99th|\d+(st|nd|rd|th))$/);
    // The WHO set has no BMI-for-age chart; it has weight-for-length instead.
    expect(whoVisit.values.bmiPercentile).toBeUndefined();
    expect(whoVisit.values.weightForLengthPercentile.value).toMatch(/^(<1st|>99th|\d+(st|nd|rd|th))$/);
    expect(whoVisit.values.weightForLengthPercentile.time).toBe('2024-07-10T14:06:00.000Z');
    expect(cdcVisit.values.weightForLengthPercentile).toBeUndefined();

    expect(cdcVisit.encounterId).toBe('e2');
    expect(cdcVisit.values.age.value).toBe('10 y');
    expect(cdcVisit.values.bmiPercentile.value).toMatch(/^(<1st|>99th|\d+(st|nd|rd|th))$/);
    // Head circumference is still shown after 24 months, without a percentile.
    expect(cdcVisit.values.headCircumference.value).toBe(52);
    expect(cdcVisit.values.headCircumferencePercentile).toBeUndefined();
  });

  test('age is counted in the visit location zone: an evening visit on the day of birth is 0 d, not 1 d', () => {
    const location: Location = {
      resourceType: 'Location',
      id: 'l1',
      extension: [{ url: TIMEZONE_EXTENSION_URL, valueString: 'America/New_York' }],
    };
    const evening = {
      ...resources,
      birthDate: '2026-03-31',
      appointments: [
        {
          ...appointments[0],
          start: '2026-04-01T00:30:00.000Z',
          participant: [{ actor: { reference: 'Location/l1' }, status: 'accepted' as const }],
        },
      ],
      encounters: [encounters[0]],
      observations: [vital(VitalFieldNames.VitalWeight, 'e1', '2026-04-01T00:35:00.000Z', 3.2)],
    };
    const [withLocation] = buildGrowthFlowsheet({ ...evening, locations: [location] }).visits;
    expect(withLocation.timezone).toBe('America/New_York');
    expect(withLocation.values.age.value).toBe('0 d');
    // Without the location the UTC calendar day is used, as before.
    const [withoutLocation] = buildGrowthFlowsheet(evening).visits;
    expect(withoutLocation.timezone).toBeUndefined();
    expect(withoutLocation.values.age.value).toBe('1 d');
  });

  test('percentiles follow the patient sex', () => {
    const asGirl = buildGrowthFlowsheet(resources).visits[1].values.weightPercentile.value;
    const asBoy = buildGrowthFlowsheet({ ...resources, gender: 'male' }).visits[1].values.weightPercentile.value;
    expect(asGirl).not.toBe(asBoy);
  });

  test('without a full birth date or a male/female sex: measurements only, no age or percentiles', () => {
    for (const partial of [
      { ...resources, birthDate: undefined },
      { ...resources, birthDate: '2024' },
      { ...resources, gender: 'other' as const },
    ]) {
      const visit = buildGrowthFlowsheet(partial).visits[1];
      expect(visit.values.weight.value).toBe(7.3);
      expect(visit.values.bmi).toBeDefined();
      expect(Object.keys(visit.values).filter((key) => key.endsWith('Percentile'))).toEqual([]);
      expect(visit.values.age === undefined || partial.birthDate === '2024-01-10').toBe(true);
    }
    expect(buildGrowthFlowsheet({ ...resources, gender: 'other' }).visits[1].values.age.value).toBe('5 mo');
  });

  test('keeps every reading of a measure in the visit, latest as the cell value, with its percentile', () => {
    const twice = buildGrowthFlowsheet({
      ...resources,
      observations: [...observations, vital(VitalFieldNames.VitalWeight, 'e1', '2024-07-10T14:40:00.000Z', 7.5)],
    }).visits[1];
    expect(twice.values.weight.value).toBe(7.5);
    expect(twice.values.weight.readings.map((r) => r.value)).toEqual([7.3, 7.5]);
    expect(twice.values.weightPercentile.readings).toHaveLength(2);
    expect(twice.values.bmi.value).toBeCloseTo(7.5 / 0.65 ** 2, 10);
  });
});

describe('growth chart data (the cards the EHR draws)', () => {
  test('z is 0 and the percentile 50th at a table row median, on WHO and CDC charts', () => {
    // WHO weight-for-age boys 12 months: M = 9.6479; CDC BMI-for-age girls at the 120.5-month row.
    expect(scoreOn('who-wfa', 12, 9.6479, 'male')).toMatchObject({ z: 0, percentile: '50th', implausible: false });
    const bmi = lmsAt(GROWTH_TABLES['CDC bmi female'], 120.5)!;
    expect(scoreOn('cdc-bmi', 120.5, bmi.M, 'female')?.z).toBeCloseTo(0, 10);
    expect(scoreOn('cdc-bmi', 120.5, bmi.M, 'female')?.percentile).toBe('50th');
    // WHO head circumference boys 6 months: M = 43.3306.
    expect(scoreOn('who-hcfa', 6, 43.3306, 'male')).toMatchObject({ z: 0, percentile: '50th' });
    // The curves: the value at z for the 50th percentile is M, and the percentile z's invert the normal CDF.
    expect(zForPercentile(50)).toBeCloseTo(0, 8);
    expect(zForPercentile(97.5)).toBeCloseTo(1.959964, 5);
    expect(valueAtZ(bmi, zForPercentile(50))).toBeCloseTo(bmi.M, 8);
    expect(scoreOn('who-wfa', 24.5, 10, 'male')).toBeUndefined(); // outside the WHO table
  });

  test('WHO restricted z: 3 SD above the median is z 3, and each further 2-to-3 SD gap adds 1', () => {
    const p = lmsAt(GROWTH_TABLES['WHO wfa female'], 12)!;
    const sd2 = valueAtZ(p, 2);
    const sd3 = valueAtZ(p, 3);
    expect(zOf(p, sd3, true)).toBeCloseTo(3, 8);
    expect(zOf(p, sd3 + (sd3 - sd2), true)).toBeCloseTo(4, 8);
    const sdm2 = valueAtZ(p, -2);
    const sdm3 = valueAtZ(p, -3);
    expect(zOf(p, sdm3 - (sdm2 - sdm3), true)).toBeCloseTo(-4, 8);
    // Length is not weight-based: no restriction.
    expect(scoreOn('who-lfa', 12, 95, 'female')!.z).toBeGreaterThan(5);
  });

  test('the chart set: WHO under 24 months, CDC from 24 to 240, none outside; opens on the age at asOf', () => {
    expect(chartSetAt(0)).toBe('who');
    expect(chartSetAt(23.99)).toBe('who');
    expect(chartSetAt(24)).toBe('cdc');
    expect(chartSetAt(240)).toBe('cdc');
    expect(chartSetAt(240.1)).toBeUndefined();
    expect(chartSetAt(-1)).toBeUndefined();
    const atWhoVisit = buildGrowthFlowsheet(resources, '2024-07-10T23:59:59.999-04:00').growth!;
    expect(atWhoVisit.ageMonths).toBeCloseTo(182 / 30.4375, 10);
    const atCdcVisit = buildGrowthFlowsheet(resources, '2034-01-10T23:59:59.999-05:00').growth!;
    expect(atCdcVisit.ageMonths).toBeCloseTo(120, 0);
    // Points follow the visits shown: none after asOf.
    expect(atWhoVisit.points.every((point) => point.encounterId === 'e1')).toBe(true);
    expect(atCdcVisit.points.map((point) => point.encounterId).sort()).toEqual([
      'e1',
      'e1',
      'e1',
      'e1',
      'e2',
      'e2',
      'e2',
    ]);
  });

  test('one point per chart per visit, with z, percentile and age; the other set counts as outside the range', () => {
    const { growth } = buildGrowthFlowsheet(resources);
    expect(growth?.sex).toBe('female');
    const byChart = Object.fromEntries(growth!.points.map((point) => [point.chart, point]));
    expect(Object.keys(byChart).sort()).toEqual(
      ['cdc-bmi', 'cdc-sfa', 'cdc-wfa', 'who-hcfa', 'who-lfa', 'who-wfa', 'who-wfl'].sort()
    );
    expect(byChart['who-wfa']).toMatchObject({ encounterId: 'e1', age: '5 mo', y: 7.3 });
    expect(byChart['who-wfa'].implausible).toBeUndefined();
    expect(byChart['who-wfa'].x).toBeCloseTo(182 / 30.4375, 10);
    expect(byChart['who-wfa'].z).toBeCloseTo(
      zOf(lmsAt(GROWTH_TABLES['WHO wfa female'], byChart['who-wfa'].x)!, 7.3, true),
      10
    );
    expect(byChart['who-wfa'].percentile).toBe(formatPercentile(byChart['who-wfa'].z!));
    // Weight-for-length: x is the same visit's length, the value the weight.
    expect(byChart['who-wfl']).toMatchObject({ x: 65, y: 7.3, time: '2024-07-10T14:05:00.000Z' });
    expect(byChart['who-hcfa']).toMatchObject({ x: byChart['who-wfa'].x, y: 42 });
    expect(byChart['cdc-bmi']).toMatchObject({ encounterId: 'e2', age: '10 y' });
    expect(byChart['cdc-bmi'].y).toBeCloseTo(32 / 1.38 ** 2, 10);
    expect(typeof byChart['cdc-sfa'].z).toBe('number');
    // The 10-year visit is outside birth to 24 months, the 6-month visit outside 2 to 20 years.
    expect(growth!.outsideRange).toEqual({
      'who-wfa': 1,
      'who-lfa': 1,
      'who-wfl': 1,
      'who-hcfa': 1,
      'cdc-wfa': 1,
      'cdc-sfa': 1,
      'cdc-bmi': 1,
    });
    // Every chart's LMS rows for the patient's sex, nothing else.
    expect(Object.keys(growth!.tables).sort()).toEqual(Object.keys(byChart).sort());
    expect(growth!.tables['who-wfa']).toBe(GROWTH_TABLES['WHO wfa female']);
    expect(growth!.tables['cdc-sfa']).toBe(GROWTH_TABLES['CDC sfa female']);
    // Points are oldest first.
    expect(growth!.points.map((point) => point.time)).toEqual(growth!.points.map((point) => point.time).sort());
  });

  test('implausible values keep their z but get a note instead of a percentile, and taint BMI and weight-for-length', () => {
    const heavy = buildGrowthFlowsheet({
      ...resources,
      observations: [
        // 15 kg and 100 cm at 6 months: each implausible for age, but a normal weight for that length.
        vital(VitalFieldNames.VitalWeight, 'e1', '2024-07-10T14:05:00.000Z', 15),
        vital(VitalFieldNames.VitalHeight, 'e1', '2024-07-10T14:06:00.000Z', 100),
        vital(VitalFieldNames.VitalWeight, 'e2', '2034-01-10T14:05:00.000Z', 32),
        vital(VitalFieldNames.VitalHeight, 'e2', '2034-01-10T14:06:00.000Z', 100),
      ],
    }).growth!;
    const byChart = Object.fromEntries(heavy.points.map((point) => [point.chart, point]));
    expect(byChart['who-wfa'].implausible).toBe(true);
    expect(byChart['who-wfa'].percentile).toBeUndefined();
    expect(byChart['who-wfa'].note).toMatch(/^implausible \(z \d+\.\d\) — not plotted on the line$/);
    expect(typeof byChart['who-wfa'].z).toBe('number');
    expect(byChart['who-lfa'].implausible).toBe(true);
    expect(byChart['who-wfl']).toMatchObject({
      implausible: true,
      note: 'from an implausible weight and height — not plotted on the line',
    });
    expect(byChart['who-wfl'].percentile).toBeUndefined();
    // CDC: 100 cm at 10 years is below the modified-z −5 limit; the BMI from it is tainted.
    expect(byChart['cdc-sfa'].note).toMatch(/^implausible \(modified z -\d+\.\d\) — not plotted on the line$/);
    expect(byChart['cdc-bmi']).toMatchObject({
      implausible: true,
      note: 'from an implausible height — not plotted on the line',
    });
    expect(byChart['cdc-wfa'].implausible).toBeUndefined();
  });

  test('a length outside the 45–110 cm table is listed with the report note and no z', () => {
    const long = buildGrowthFlowsheet({
      ...resources,
      observations: [
        vital(VitalFieldNames.VitalWeight, 'e1', '2024-07-10T14:05:00.000Z', 7.3),
        vital(VitalFieldNames.VitalHeight, 'e1', '2024-07-10T14:06:00.000Z', 44),
      ],
    }).growth!;
    const wfl = long.points.find((point) => point.chart === 'who-wfl')!;
    expect(wfl).toMatchObject({ x: 44, y: 7.3, note: 'length outside the 45–110 cm table' });
    expect(wfl.z).toBeUndefined();
    expect(wfl.implausible).toBeUndefined();
  });

  test('no growth data without a full birth date or a male/female sex', () => {
    expect(buildGrowthFlowsheet({ ...resources, birthDate: '2024' }).growth).toBeUndefined();
    expect(buildGrowthFlowsheet({ ...resources, gender: 'other' }).growth).toBeUndefined();
  });
});
