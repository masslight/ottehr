import { Appointment, Encounter } from 'fhir/r4b';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { VitalAlertCriticality } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { FlowsheetLabResult, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, test } from 'vitest';
import { LAB_ROW_LOINC_CODES } from '../../src/ehr/get-flowsheet/lab-loinc-codes.generated';
import { buildLabResultsFlowsheet } from '../../src/ehr/get-flowsheet/lab-results';
import { FlowsheetData, unlinkedResultKey } from '../../src/ehr/get-flowsheet/patient-data';

const PATIENT = 'Patient/p1';
const AT = '2024-03-04T18:00:00.000Z';

const appointment = (id: string, start: string): Appointment => ({
  resourceType: 'Appointment',
  id,
  status: 'fulfilled',
  start,
  meta: { tag: [{ code: OTTEHR_MODULE.IP }] },
  participant: [{ actor: { reference: PATIENT }, status: 'accepted' }],
});
const encounter = (id: string, appointmentId: string): Encounter => ({
  resourceType: 'Encounter',
  id,
  status: 'finished',
  class: { code: 'AMB' },
  subject: { reference: PATIENT },
  appointment: [{ reference: `Appointment/${appointmentId}` }],
});

interface LabOptions {
  codes?: string[];
  value?: number;
  text?: string;
  unit?: string;
  /** The ordered test's name and LOINC codes (the report's for an unsolicited result). */
  test?: string;
  testCodes?: string[];
  flag?: 'H' | 'L' | '';
  at?: string;
  fasting?: boolean;
}
const lab = (
  analyte: string,
  { codes = [], value, text, unit = '', test = '', testCodes = [], flag = '', at = AT, fasting }: LabOptions
): FlowsheetLabResult => ({
  analyte,
  loincCodes: codes,
  testName: test,
  testLoincCodes: testCodes,
  fasting,
  value,
  valueText: value !== undefined ? String(value) : text ?? '',
  unit,
  referenceRange: '',
  interpretation: flag,
  flag: flag ? VitalAlertCriticality.Abnormal : undefined,
  resultedAt: at,
  source: 'external',
});

const base: FlowsheetData = {
  appointments: [appointment('a1', '2024-03-04T14:00:00.000Z'), appointment('a2', '2024-09-09T14:00:00.000Z')],
  encounters: [encounter('e1', 'a1'), encounter('e2', 'a2')],
  conditions: [],
  practitioners: [],
};
const build = (labs: Record<string, FlowsheetLabResult[]>): FlowsheetVisit[] =>
  buildLabResultsFlowsheet({ ...base, labs });
/** Row key -> cell value of visit e1 when it holds only `labs`. */
const valuesOf = (...labs: FlowsheetLabResult[]): Record<string, string | number> =>
  Object.fromEntries(Object.entries(build({ e1: labs })[0]?.values ?? {}).map(([key, v]) => [key, v.value]));

describe('LAB_ROW_LOINC_CODES for the Lab results rows', () => {
  test.each([
    ['hemoglobin', ['718-7', '59260-0']],
    ['hematocrit', ['4544-3', '20570-8']],
    ['mcv', ['787-2']],
    ['mch', ['785-6']],
    ['mchc', ['786-4']],
    ['rbc', ['789-8']],
    ['wbc', ['6690-2']],
    ['platelets', ['777-3']],
    ['neutrophilsPercent', ['770-8']],
    ['neutrophilsAbsolute', ['751-8']],
    ['glucose', ['2345-7', '14749-6']],
    ['fastingGlucose', ['1558-6', '14771-0']],
    ['bun', ['3094-0']],
    ['creatinine', ['2160-0']],
    ['egfr', ['33914-3', '62238-1', '69405-9']],
    ['egfr2021', ['98979-8', '98980-6']],
    ['bunCreatinineRatio', ['3097-3']],
    ['bicarbonate', ['2028-9']],
    ['totalBilirubin', ['1975-2']],
    ['ast', ['1920-8']],
    ['alt', ['1742-6']],
    ['ldlCholesterol', ['2089-1', '13457-7', '18262-6']],
    ['nonHdlCholesterol', ['43396-1']],
    ['transferrinSaturation', ['2502-3']],
    ['hba1c', ['4548-4', '17856-6']],
    ['vitaminD', ['1989-3', '62292-8']],
    ['urineAlbuminCreatinineRatio', ['9318-7', '14959-1']],
    ['crp', ['1988-5']],
    ['hsCrp', ['30522-7']],
    ['urineCulture', ['630-4']],
    ['hivAgAb', ['56888-1']],
    ['hepatitisCAntibody', ['16128-1', '13955-0']],
    ['esr', ['4537-7', '30341-2']],
    ['urineHcg', ['2106-3', '2112-1']],
    ['pth', ['2731-8']],
    ['uaColor', ['5778-6']],
    ['uaSpecificGravity', ['5811-5']],
    ['uaProtein', ['20454-5', '5804-0']],
    ['uaBlood', ['5794-3']],
    ['uaLeukocyteEsterase', ['5799-2']],
  ])('%s carries the codes of its measure in every unit and method', (row, codes) => {
    codes.forEach((code) => expect(LAB_ROW_LOINC_CODES[row]).toContain(code));
  });

  test('race-based eGFR, whole-blood glucose, RDW and timed glucose are on no row; no code is on two Lab results rows', () => {
    // The Newborn bilirubin flowsheet's total row carries this flowsheet's total bilirubin codes as well.
    const { newbornTotalBilirubin: _newborn, ...labResultsRows } = LAB_ROW_LOINC_CODES;
    const all = Object.values(labResultsRows).flat();
    [
      '88293-6', // eGFR CKD-EPI among black population
      '88294-4', // eGFR CKD-EPI among non black population
      '48642-3', // eGFR MDRD among non black population
      '48643-1', // eGFR MDRD among black population
      '2339-0', // Glucose in Blood
      '788-0', // Erythrocyte distribution width (shares ESR's component)
      '1521-4', // Glucose in Serum or Plasma --2 hours post 75 g glucose
      '2888-6', // Protein in Urine is a urinalysis row, never total protein
    ]
      .slice(0, 7)
      .forEach((code) => expect(all).not.toContain(code));
    expect(LAB_ROW_LOINC_CODES.totalProtein).not.toContain('2888-6');
    expect(new Set(all).size).toBe(all.length);
  });

  test('total bilirubin is serum or plasma only: a heel-stick (42719-5) result is not a CMP result', () => {
    expect(LAB_ROW_LOINC_CODES.totalBilirubin).not.toContain('42719-5');
    expect(valuesOf(lab('Bilirubin, total', { codes: ['42719-5'], value: 9.9 }))).toEqual({});
    expect(valuesOf(lab('Bilirubin, total', { codes: ['1975-2'], value: 0.6 }))).toEqual({ totalBilirubin: 0.6 });
  });
});

describe('buildLabResultsFlowsheet', () => {
  test('a panel visit: CBC, CMP and lipid results land by LOINC with the saved flag and unit, whatever the test is called', () => {
    const [visit] = build({
      e1: [
        lab('Hemoglobin', { codes: ['718-7'], value: 11.2, unit: 'g/dL', flag: 'L', test: 'CBC with differential' }),
        lab('Neutrophils', { codes: ['770-8'], value: 62, unit: '%', test: 'CBC with differential' }),
        lab('Neutrophils Absolute', { codes: ['751-8'], value: 4.1, unit: 'x10E3/uL', test: 'CBC with differential' }),
        lab('Creatinine', { codes: ['2160-0'], value: 1.4, unit: 'mg/dL', flag: 'H', test: 'Comp. metabolic panel' }),
        lab('BUN/Creatinine Ratio', { codes: ['3097-3'], value: 14, test: 'Comp. metabolic panel' }),
        lab('LDL Chol Calc (NIH)', { codes: ['13457-7'], value: 131, unit: 'mg/dL', flag: 'H', test: 'Lipid panel' }),
        lab('TSH', { codes: ['3016-3'], value: 2.1, unit: 'uIU/mL', test: 'TSH' }),
      ],
    });
    expect(visit.encounterId).toBe('e1');
    expect(
      Object.fromEntries(Object.entries(visit.values).map(([key, v]) => [key, [v.value, v.unit, v.flag]]))
    ).toEqual({
      hemoglobin: [11.2, 'g/dL', VitalAlertCriticality.Abnormal],
      neutrophilsPercent: [62, '%', undefined],
      neutrophilsAbsolute: [4.1, 'x10E3/uL', undefined],
      creatinine: [1.4, 'mg/dL', VitalAlertCriticality.Abnormal],
      bunCreatinineRatio: [14, undefined, undefined],
      ldlCholesterol: [131, 'mg/dL', VitalAlertCriticality.Abnormal],
      tsh: [2.1, 'uIU/mL', undefined],
    });
  });

  test('CRP and hs-CRP are separate rows, by method code and by name', () => {
    expect(valuesOf(lab('C-Reactive Protein', { codes: ['1988-5'], value: 3.2 }))).toEqual({ crp: 3.2 });
    expect(valuesOf(lab('CRP', { codes: ['30522-7'], value: 0.8 }))).toEqual({ hsCrp: 0.8 });
    expect(valuesOf(lab('C-Reactive Protein, Quant', { value: 3.2 }))).toEqual({ crp: 3.2 });
    expect(valuesOf(lab('hs-CRP', { value: 0.8 }))).toEqual({ hsCrp: 0.8 });
    expect(valuesOf(lab('C-Reactive Protein, Cardiac', { value: 0.8 }))).toEqual({ hsCrp: 0.8 });
  });

  test('eGFR: race-based results are never shown; the 2021 race-free result is the one shown for its draw', () => {
    const draw1 = [
      lab('GFR est AA', { codes: ['88293-6'], value: 92 }),
      lab('GFR est non-AA', { codes: ['88294-4'], value: 79 }),
      lab('eGFR', { codes: ['62238-1'], value: 80 }),
      lab('eGFR (CKD-EPI 2021)', { codes: ['98979-8'], value: 84 }),
    ];
    // A later draw in the same visit without a 2021 result shows the lab's race-free result.
    const draw2 = [lab('eGFR', { codes: ['62238-1'], value: 75, at: '2024-03-06T18:00:00.000Z' })];
    const [visit] = build({ e1: [...draw1, ...draw2] });
    expect(visit.values.egfr.readings.map((r) => r.value)).toEqual([84, 75]);
    expect(Object.keys(visit.values)).toEqual(['egfr']);

    // Uncoded: a result named for a race is left out; the plain one is shown.
    expect(
      valuesOf(lab('eGFR African American', { value: 92 }), lab('eGFR Non-African American', { value: 79 }))
    ).toEqual({});
    expect(valuesOf(lab('eGFR', { value: 80 }))).toEqual({ egfr: 80 });
  });

  test('glucose: marked fasting by a fasting code, by the report’s fasting status, or by an uncoded name; otherwise not', () => {
    const noteOf = (result: FlowsheetLabResult): string | undefined => build({ e1: [result] })[0].values.glucose.note;
    expect(noteOf(lab('Glucose', { codes: ['1558-6'], value: 92 }))).toBe('fasting');
    expect(noteOf(lab('Glucose', { codes: ['2345-7'], value: 92, fasting: true }))).toBe('fasting');
    expect(noteOf(lab('Glucose, Fasting', { value: 92, test: 'Basic metabolic panel' }))).toBe('fasting');
    expect(noteOf(lab('Glucose', { codes: ['2345-7'], value: 92 }))).toBeUndefined();
    expect(noteOf(lab('Glucose', { value: 92, test: 'Basic metabolic panel' }))).toBeUndefined();
    // Both land on the one Glucose row, oldest first.
    const [visit] = build({
      e1: [
        lab('Glucose', { codes: ['2345-7'], value: 140, at: '2024-03-04T20:00:00.000Z' }),
        lab('Glucose', { codes: ['1558-6'], value: 92 }),
      ],
    });
    expect(visit.values.glucose.readings.map((r) => [r.value, r.note])).toEqual([
      [92, 'fasting'],
      [140, undefined],
    ]);
  });

  test('urinalysis: coded components as reported; uncoded ones only from a urine test, which the serum rows never take', () => {
    expect(
      valuesOf(
        lab('Color', { codes: ['5778-6'], text: 'Yellow', test: 'Urinalysis, Complete' }),
        lab('pH', { codes: ['5803-2'], value: 6 }),
        lab('Protein', { codes: ['20454-5'], text: 'Negative' }),
        lab('Leukocyte Esterase', { codes: ['5799-2'], text: 'Trace', flag: 'H' })
      )
    ).toEqual({ uaColor: 'Yellow', uaPh: 6, uaProtein: 'Negative', uaLeukocyteEsterase: 'Trace' });

    const inHouse = (analyte: string, text: string): FlowsheetLabResult =>
      lab(analyte, { text, test: 'Urinalysis (UA) Dipstick' });
    expect(
      valuesOf(
        inHouse('Glucose', 'Negative'),
        inHouse('Protein', 'Trace'),
        inHouse('Blood', 'Negative'),
        inHouse('Leukocytes', '2+'),
        inHouse('Bilirubin', 'Negative'),
        inHouse('Specific Gravity', '1.020'),
        lab('Glucose', { value: 98, test: 'Basic metabolic panel' }),
        lab('Protein, Total', { value: 7.1, test: 'Comp. metabolic panel' })
      )
    ).toEqual({
      uaGlucose: 'Negative',
      uaProtein: 'Trace',
      uaBlood: 'Negative',
      uaLeukocyteEsterase: '2+',
      uaBilirubin: 'Negative',
      uaSpecificGravity: '1.020',
      glucose: 98,
      totalProtein: 7.1,
    });
  });

  test('urine culture: organisms with their counts as reported, or "No growth"; susceptibilities and other cultures are left out', () => {
    const culture = { test: 'Culture, Urine', testCodes: ['630-4'] };
    const visits = build({
      e1: [
        lab('Escherichia coli', { ...culture, text: '>100,000 CFU/mL' }),
        lab('Sensitivity Panel', { ...culture, codes: ['50545-3'], text: 'Ampicillin R; Nitrofurantoin S' }),
        lab('Streptococcus pyogenes', { test: 'Culture, Throat', testCodes: ['626-2'], text: 'Heavy growth' }),
      ],
      e2: [lab('Culture, Urine', { ...culture, codes: ['630-4'], text: 'No growth', at: '2024-09-09T18:00:00.000Z' })],
    });
    expect(visits.map((v) => [v.encounterId, v.values.urineCulture.value])).toEqual([
      ['e2', 'No growth'],
      ['e1', 'Escherichia coli >100,000 CFU/mL'],
    ]);
    expect(Object.keys(visits[1].values)).toEqual(['urineCulture']);
    // A culture named rather than coded is one too.
    expect(valuesOf(lab('Escherichia coli', { test: 'Urine Culture', text: '50,000 CFU/mL' }))).toEqual({
      urineCulture: 'Escherichia coli 50,000 CFU/mL',
    });
  });

  test('HIV, hepatitis C and urine hCG show their text as reported; a text-only result on a number row is left out', () => {
    expect(
      valuesOf(
        lab('HIV 1/2 Ag/Ab', { codes: ['56888-1'], text: 'Non-reactive' }),
        lab('Hepatitis C Antibody', { codes: ['13955-0'], text: 'Negative' }),
        lab('hCG, Urine', { codes: ['2106-3'], text: 'Negative' }),
        lab('hCG', { text: 'Negative', test: 'Urine Pregnancy Test (HCG)' }),
        lab('Hemoglobin', { codes: ['718-7'], text: 'Hemolyzed' })
      )
    ).toEqual({ hivAgAb: 'Non-reactive', hepatitisCAntibody: 'Negative', urineHcg: 'Negative' });
  });

  test('a visit is a column only with a result for a row; an unlinked outside result is its own column; newest first', () => {
    expect(build({ e1: [lab('Influenza A antigen', { codes: ['104730-7'], text: 'Detected' })] })).toEqual([]);
    const visits = build({
      e1: [lab('Hemoglobin A1c', { codes: ['4548-4'], value: 6.1, unit: '%' })],
      [unlinkedResultKey('dr-9')]: [
        lab('Hemoglobin A1c', { codes: ['4548-4'], value: 6.4, unit: '%', at: '2024-06-01T12:00:00.000Z' }),
      ],
    });
    expect(visits.map((v) => [v.encounterId, v.isOutsideResult, v.start, v.values.hba1c.value])).toEqual([
      [undefined, true, '2024-06-01T12:00:00.000Z', 6.4],
      ['e1', undefined, '2024-03-04T14:00:00.000Z', 6.1],
    ]);
  });
});
