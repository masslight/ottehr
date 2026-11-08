import { Appointment, Encounter, Observation } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { PATIENT_VITALS_META_SYSTEM } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, test } from 'vitest';
import {
  ageMonthsAt,
  buildGrowthFlowsheet,
  formatAge,
  formatPercentile,
  lmsAt,
  normCdf,
  percentileOf,
  zOf,
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
    expect(formatAge(0.5)).toBe('15 d');
    expect(formatAge(13.9)).toBe('13 mo');
    expect(formatAge(24)).toBe('2 y');
    expect(formatAge(54.2)).toBe('4 y 6 mo');
  });
});

describe('buildGrowthFlowsheet', () => {
  test('one column per visit with measurements, BMI from the visit pair, age and percentiles', () => {
    const [cdcVisit, whoVisit] = buildGrowthFlowsheet(resources);
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
    // The WHO set has no BMI-for-age chart.
    expect(whoVisit.values.bmiPercentile).toBeUndefined();

    expect(cdcVisit.encounterId).toBe('e2');
    expect(cdcVisit.values.age.value).toBe('10 y');
    expect(cdcVisit.values.bmiPercentile.value).toMatch(/^(<1st|>99th|\d+(st|nd|rd|th))$/);
    // Head circumference is still shown after 24 months, without a percentile.
    expect(cdcVisit.values.headCircumference.value).toBe(52);
    expect(cdcVisit.values.headCircumferencePercentile).toBeUndefined();
  });

  test('percentiles follow the patient sex', () => {
    const asGirl = buildGrowthFlowsheet(resources)[1].values.weightPercentile.value;
    const asBoy = buildGrowthFlowsheet({ ...resources, gender: 'male' })[1].values.weightPercentile.value;
    expect(asGirl).not.toBe(asBoy);
  });

  test('without a full birth date or a male/female sex: measurements only, no age or percentiles', () => {
    for (const partial of [
      { ...resources, birthDate: undefined },
      { ...resources, birthDate: '2024' },
      { ...resources, gender: 'other' as const },
    ]) {
      const visit = buildGrowthFlowsheet(partial)[1];
      expect(visit.values.weight.value).toBe(7.3);
      expect(visit.values.bmi).toBeDefined();
      expect(Object.keys(visit.values).filter((key) => key.endsWith('Percentile'))).toEqual([]);
      expect(visit.values.age === undefined || partial.birthDate === '2024-01-10').toBe(true);
    }
    expect(buildGrowthFlowsheet({ ...resources, gender: 'other' })[1].values.age.value).toBe('5 mo');
  });

  test('keeps every reading of a measure in the visit, latest as the cell value, with its percentile', () => {
    const twice = buildGrowthFlowsheet({
      ...resources,
      observations: [...observations, vital(VitalFieldNames.VitalWeight, 'e1', '2024-07-10T14:40:00.000Z', 7.5)],
    })[1];
    expect(twice.values.weight.value).toBe(7.5);
    expect(twice.values.weight.readings.map((r) => r.value)).toEqual([7.3, 7.5]);
    expect(twice.values.weightPercentile.readings).toHaveLength(2);
    expect(twice.values.bmi.value).toBeCloseTo(7.5 / 0.65 ** 2, 10);
  });
});
