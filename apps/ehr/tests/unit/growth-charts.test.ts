import type { Observation } from 'fhir/r4b';
import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  CHART_SETS,
  chartRows,
  fmtAge,
  fmtPercentile,
  growthMeasurements,
  lmsAt,
  modifiedZ,
  normCdf,
  ordinal,
  valueAtZ,
  zForPercentile,
  zOf,
} from '../../src/features/visits/in-person/components/vitals/growth-charts/growthMath';
import {
  GROWTH_TABLES,
  GrowthTableKey,
} from '../../src/features/visits/in-person/components/vitals/growth-charts/growthTables';

const TAG_SYSTEM = 'https://fhir.zapehr.com/r4/StructureDefinitions/patient-vitals-field';
const vital = (
  field: 'vital-weight' | 'vital-height',
  encounterId: string,
  at: string,
  value: number,
  unit: string
): Observation => ({
  resourceType: 'Observation',
  status: 'final',
  code: {},
  meta: { tag: [{ system: TAG_SYSTEM, code: field }] },
  encounter: { reference: `Encounter/${encounterId}` },
  effectiveDateTime: at,
  valueQuantity: { value, unit },
});

describe('growth chart math', () => {
  it('puts the table median at z 0, the 50th percentile', () => {
    const p = lmsAt(GROWTH_TABLES['WHO wfa male'], 0)!;
    expect(p.M).toBe(3.3464);
    expect(zOf(p, 3.3464)).toBeCloseTo(0, 12);
    expect(fmtPercentile(0)).toBe('50th');
  });

  it('interpolates between table rows and is undefined outside the table', () => {
    const p = lmsAt(GROWTH_TABLES['WHO wfa male'], 0.5)!;
    expect(p.M).toBeCloseTo((3.3464 + 4.4709) / 2, 12);
    expect(lmsAt(GROWTH_TABLES['WHO wfa male'], -0.1)).toBeUndefined();
    expect(lmsAt(GROWTH_TABLES['WHO wfa male'], 24.1)).toBeUndefined();
  });

  it('inverts the normal CDF', () => {
    expect(normCdf(1.96)).toBeCloseTo(0.975, 4);
    expect(zForPercentile(97.5)).toBeCloseTo(1.96, 3);
    expect(valueAtZ({ L: 0, M: 10, S: 0.1 }, 1)).toBeCloseTo(10 * Math.exp(0.1), 12);
  });

  it('applies WHO restricted z only beyond ±3 SD', () => {
    const p = lmsAt(GROWTH_TABLES['WHO wfa male'], 12)!;
    const at2 = valueAtZ(p, 2);
    expect(zOf(p, at2, true)).toBeCloseTo(2, 10);
    const at4 = valueAtZ(p, 4);
    const sd3 = valueAtZ(p, 3);
    const sd2 = valueAtZ(p, 2);
    expect(zOf(p, at4, true)).toBeCloseTo(3 + (at4 - sd3) / (sd3 - sd2), 12);
    expect(zOf(p, at4, false)).toBeCloseTo(4, 10);
  });

  it('formats percentiles, ordinals and ages', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal)).toEqual([
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '101st',
      '111th',
    ]);
    expect(fmtPercentile(-3)).toBe('<1st');
    expect(fmtPercentile(3)).toBe('>99th');
    expect(fmtPercentile(1.1)).toBe('86th');
    expect(fmtAge(0.5)).toBe('15 d');
    expect(fmtAge(5.9)).toBe('5 mo');
    expect(fmtAge(30)).toBe('2 y 6 mo');
    expect(fmtAge(36)).toBe('3 y');
  });
});

describe('growth measurements', () => {
  const birthDate = '2020-01-01';
  const observations = [
    vital('vital-weight', 'a', '2021-01-01T15:00:00Z', 10, 'kg'),
    vital('vital-weight', 'a', '2021-01-01T16:00:00Z', 10.2, 'kg'), // the visit's last weight wins
    vital('vital-height', 'a', '2021-01-01T15:05:00Z', 75, 'cm'),
    vital('vital-weight', 'c', '2021-06-01T15:00:00Z', 50, 'kg'), // implausible at 17 months
    vital('vital-weight', 'b', '2022-01-02T15:00:00Z', 26, 'lb'),
  ];
  const growth = growthMeasurements(observations, birthDate, 'male');

  it('keeps the last weight and height per visit, pairs them into a BMI, and flags units and implausible values', () => {
    expect(growth.map((m) => [m.kind, m.enc, m.value])).toEqual([
      ['height', 'Encounter/a', 75],
      ['weight', 'Encounter/a', 10.2],
      ['bmi', 'Encounter/a', 10.2 / 0.75 ** 2],
      ['weight', 'Encounter/c', 50],
      ['weight', 'Encounter/b', 26],
    ]);
    const [, weightA, , weightC, weightB] = growth;
    expect(weightA.length).toBe(75);
    expect(weightA.implausible).toBe(false);
    expect(weightC.implausible).toBe(true);
    expect(weightB.issue).toBe('unit "lb" — not converted to kg');
  });

  it('builds each chart from the measurements in its age range', () => {
    const wfa = chartRows(CHART_SETS.who, CHART_SETS.who.charts[0], growth, 'male');
    expect(wfa.otherAges).toBe(1); // the 2-year visit belongs to the CDC set
    expect(wfa.rows.map((r) => [r.m.enc, r.plotted])).toEqual([
      ['Encounter/a', true],
      ['Encounter/c', false],
    ]);
    expect(wfa.rows[1].note).toMatch(/^implausible \(z \d+\.\d\) — not plotted on the line$/);

    const wfl = chartRows(CHART_SETS.who, CHART_SETS.who.charts[2], growth, 'male');
    expect(wfl.rows.map((r) => [r.m.enc, r.x, r.plotted])).toEqual([['Encounter/a', 75, true]]);

    const cdcWfa = chartRows(CHART_SETS.cdc, CHART_SETS.cdc.charts[0], growth, 'male');
    expect(cdcWfa.rows.map((r) => [r.m.enc, r.plotted, r.note])).toEqual([
      ['Encounter/b', false, 'unit "lb" — not converted to kg'],
    ]);
  });
});

// Bake-off parity with the ad-hoc system report: its math block and LMS tables, evaluated from the report file,
// give the same numbers as the native port. Delete with the report.
describe('parity with the growth-charts system report', () => {
  const reportFile = path.resolve(__dirname, '../../../../config/oystehr/system-reports/growth-charts.report.json');
  const code: string = JSON.parse(readFileSync(reportFile, 'utf-8')).code;
  const mathSrc = code.slice(code.indexOf('/*GROWTH-MATH-BEGIN*/'), code.indexOf('/*GROWTH-MATH-END*/'));
  const report = new Function(`${mathSrc}; return { lmsAt, zOf, modifiedZ, normCdf, zForPercentile };`)() as {
    lmsAt: typeof lmsAt;
    zOf: typeof zOf;
    modifiedZ: typeof modifiedZ;
    normCdf: typeof normCdf;
    zForPercentile: typeof zForPercentile;
  };
  const reportTables = new Function(`${code.slice(code.indexOf('function growthTables()'))}; return growthTables();`)();

  it('has the same LMS tables', () => {
    expect(GROWTH_TABLES).toEqual(reportTables);
  });

  it('computes the same LMS parameters, z-scores and percentiles', () => {
    (Object.keys(GROWTH_TABLES) as GrowthTableKey[]).forEach((key) => {
      const table = GROWTH_TABLES[key];
      const lo = table[0][0];
      const hi = table[table.length - 1][0];
      for (let x = lo - 1; x <= hi + 1; x += (hi - lo) / 37) {
        const p = lmsAt(table, x);
        expect(p).toEqual(report.lmsAt(table, x));
        if (!p) continue;
        for (let z = -7; z <= 7; z += 0.7) {
          const y = valueAtZ(p, z);
          if (!(y > 0)) continue;
          expect(zOf(p, y, true)).toBe(report.zOf(p, y, true));
          expect(zOf(p, y, false)).toBe(report.zOf(p, y, false));
          expect(modifiedZ(p, y)).toBe(report.modifiedZ(p, y));
        }
      }
    });
    for (let z = -6; z <= 6; z += 0.13) expect(normCdf(z)).toBe(report.normCdf(z));
    [2, 3, 5, 10, 25, 50, 75, 90, 95, 97, 98].forEach((pct) =>
      expect(zForPercentile(pct)).toBe(report.zForPercentile(pct))
    );
  });
});
