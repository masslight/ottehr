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
  flag?: 'H' | 'L' | 'A' | 'S' | 'R' | 'INTERMEDIATE' | '';
  at?: string;
  fasting?: boolean;
  /** The result's Observation id and the ids it links to (hasMember, derivedFrom). */
  id?: string;
  links?: string[];
}
const lab = (
  analyte: string,
  { codes = [], value, text, unit = '', test = '', testCodes = [], flag = '', at = AT, fasting, id, links }: LabOptions
): FlowsheetLabResult => ({
  observationId: id,
  linkedObservationIds: links,
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
    ['hivAgAb', ['56888-1', '75666-8', '58900-2']],
    ['hivAb', ['80387-4', '73906-0', '31201-7', '73905-2']],
    ['hepatitisCAntibody', ['16128-1', '13955-0', '72376-7', '89359-4']],
    ['esr', ['4537-7', '30341-2']],
    ['urineHcg', ['2106-3', '2112-1']],
    ['pth', ['2731-8']],
    ['uaColor', ['5778-6']],
    ['uaSpecificGravity', ['5811-5']],
    ['uaProtein', ['20454-5', '5804-0']],
    ['uaBlood', ['5794-3']],
    ['uaLeukocyteEsterase', ['5799-2']],
    ['hemoglobin', ['30350-3', '30352-9']],
    ['rdw', ['788-0']],
    ['monocytesAbsolute', ['742-7']],
    ['eosinophilsAbsolute', ['711-2']],
    ['basophilsAbsolute', ['704-7']],
    ['anionGap', ['33037-3', '10466-1']],
    ['pt', ['5902-2']],
    ['inr', ['6301-6', '34714-6', '46418-0']],
    ['hepatitisBSurfaceAntigen', ['5196-1']],
    ['hepatitisBSurfaceAntibody', ['16935-9', '10900-9']],
    ['hepatitisBCoreAntibody', ['16933-4', '13952-7']],
    ['hepatitisCRna', ['11011-4', '11259-9']],
    ['hiv1Rna', ['20447-9', '25835-0']],
    ['chlamydia', ['42931-6', '50387-0', '53926-2']],
    ['gonorrhea', ['60256-5', '50388-8', '53879-3']],
    ['syphilisRpr', ['20507-0', '31147-2']],
    ['syphilisTreponemalAntibody', ['47236-5', '24110-9']],
    ['hpvHighRisk', ['59420-0', '69002-4', '71431-1']],
    ['hpv16', ['77399-4', '61372-9', '115798-1']],
    ['hpv18', ['77400-0', '61373-7']],
    ['hpv18And45', ['75694-0', '106509-3']],
    ['hpv16And18', ['70061-7', '114965-7', '114970-7']],
    ['directBilirubin', ['1968-7']],
    ['fingerstickGlucose', ['2339-0', '41653-7']],
    ['fastingFingerstickGlucose', ['1556-0', '41604-0', '14770-2']],
    ['trichomonas', ['70165-6', '70167-2', '69937-1', '41511-7', '6566-4']],
    ['trichomonasWetMount', ['14367-7', '6565-6']],
    ['lead', ['5671-3', '14807-2']],
    ['leadCapillary', ['10368-9']],
    ['leadVenous', ['77307-7']],
    ['igra', ['71773-6']],
    ['fit', ['29771-3']],
    ['lipoproteinA', ['10835-7']],
    ['apoB', ['1884-6']],
    ['ntProBnp', ['33762-6']],
    ['bnp', ['30934-4']],
    ['cystatinC', ['33863-2']],
    ['ck', ['2157-6']],
    ['serumHcg', ['21198-7', '19080-1']],
    ['ttgIga', ['31017-7']],
  ])('%s carries the codes of its measure in every unit and method', (row, codes) => {
    codes.forEach((code) => expect(LAB_ROW_LOINC_CODES[row]).toContain(code));
  });

  test('race-based eGFR, yes/no codes on number rows and timed glucose are on no row; no code is on two Lab results rows', () => {
    // The Newborn bilirubin flowsheet's rows carry this flowsheet's bilirubin codes as well.
    const { newbornTotalBilirubin: _total, newbornDirectBilirubin: _direct, ...labResultsRows } = LAB_ROW_LOINC_CODES;
    const all = Object.values(labResultsRows).flat();
    [
      '88293-6', // eGFR CKD-EPI among black population
      '88294-4', // eGFR CKD-EPI among non black population
      '48642-3', // eGFR MDRD among non black population
      '48643-1', // eGFR MDRD among black population
      '717-9', // Hemoglobin [Presence] in Blood
      '11039-5', // C reactive protein [Presence] in Serum or Plasma
      '1521-4', // Glucose in Serum or Plasma --2 hours post 75 g glucose
      '50196-5', // Hemoglobin in Stool by guaiac (FOBT), not a FIT
      '29539-4', // HIV 1 RNA [Log #/volume]: the count repeated
      '45086-6', // Chlamydia trachomatis DNA in Nasopharynx: a newborn's, not an STI test
    ].forEach((code) => expect(all).not.toContain(code));
    // A meter glucose (whole or capillary blood) is its own row; RDW shares ESR's component but not its row.
    ['2339-0', '41653-7', '32016-8'].forEach((code) => expect(LAB_ROW_LOINC_CODES.fingerstickGlucose).toContain(code));
    ['2339-0', '41653-7', '32016-8'].forEach((code) => expect(LAB_ROW_LOINC_CODES.glucose).not.toContain(code));
    expect(LAB_ROW_LOINC_CODES.rdw).toContain('788-0');
    expect(LAB_ROW_LOINC_CODES.esr).not.toContain('788-0');
    expect(LAB_ROW_LOINC_CODES.totalProtein).not.toContain('2888-6');
    expect(new Set(all).size).toBe(all.length);
  });

  test('total bilirubin takes serum, plasma or blood, a heel-stick (42719-5, 97770-2) included; cord blood does not', () => {
    ['42719-5', '97770-2', '59828-4'].forEach((code) => expect(LAB_ROW_LOINC_CODES.totalBilirubin).toContain(code));
    expect(LAB_ROW_LOINC_CODES.totalBilirubin).not.toContain('48624-1');
    expect(valuesOf(lab('Bilirubin, total', { codes: ['42719-5'], value: 9.9 }))).toEqual({ totalBilirubin: 9.9 });
    expect(valuesOf(lab('Bilirubin, total', { codes: ['1975-2'], value: 0.6 }))).toEqual({ totalBilirubin: 0.6 });
    expect(valuesOf(lab('Bilirubin, total', { codes: ['48624-1'], value: 2.1 }))).toEqual({});
  });

  test('by name, a cord blood bilirubin named only by its test stays off Total bilirubin', () => {
    expect(valuesOf(lab('Bilirubin, Total', { test: 'Cord Blood Evaluation', value: 2.1 }))).toEqual({});
    // A urinalysis bilirubin still goes to its Urinalysis row, and a CMP's to Total bilirubin.
    expect(valuesOf(lab('Bilirubin', { test: 'Urinalysis', value: 1 }))).toEqual({ uaBilirubin: 1 });
    expect(valuesOf(lab('Bilirubin, Total', { test: 'Comprehensive metabolic panel', value: 0.6 }))).toEqual({
      totalBilirubin: 0.6,
    });
  });

  test('by name, a heel-stick or neonatal capillary bilirubin is on Total bilirubin, like the coded one', () => {
    const totals = (...results: FlowsheetLabResult[]): (string | number)[] =>
      build({ e1: results })[0].values.totalBilirubin.readings.map((r) => r.value);
    const at = (hour: number): string => `2024-03-04T${hour}:00:00.000Z`;
    expect(
      totals(
        lab('Bilirubin, Total', { test: 'Neonatal Bilirubin, Capillary', value: 11.2, at: at(10) }),
        lab('Bilirubin, Total', { test: 'Newborn bilirubin', value: 10.1, at: at(11) }),
        lab('Bilirubin, Total', { test: 'Bilirubin, heel stick', value: 9.4, at: at(12) }),
        lab('Bilirubin, Total', { test: 'Bilirubin, capillary', value: 9.1, at: at(13) })
      )
    ).toEqual([11.2, 10.1, 9.4, 9.1]);
  });

  test('by name, a heel-stick or neonatal direct bilirubin is on Direct bilirubin too; cord blood and urine stay off', () => {
    expect(valuesOf(lab('Bilirubin, Direct', { test: 'Neonatal Bilirubin, Capillary', value: 0.4 }))).toEqual({
      directBilirubin: 0.4,
    });
    expect(valuesOf(lab('Neonatal Bilirubin, Direct', { value: 1.6 }))).toEqual({ directBilirubin: 1.6 });
    expect(valuesOf(lab('Bilirubin, Conjugated', { test: 'Bilirubin, heel stick', value: 1.1 }))).toEqual({
      directBilirubin: 1.1,
    });
    expect(valuesOf(lab('Bilirubin, Direct', { test: 'Cord blood bilirubin', value: 0.3 }))).toEqual({});
    expect(valuesOf(lab('Bilirubin, Direct', { test: 'Bilirubin, urine', value: 0.3 }))).toEqual({ uaBilirubin: 0.3 });
    // Coded, the serum or plasma direct bilirubin as before (LOINC has no blood direct bilirubin code).
    expect(LAB_ROW_LOINC_CODES.directBilirubin).toEqual(LAB_ROW_LOINC_CODES.newbornDirectBilirubin);
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

  test('eGFR: an uncoded 2021 CKD-EPI result, by its name, is the one shown for its draw too', () => {
    const egfrs = (...results: FlowsheetLabResult[]): (string | number)[] =>
      build({ e1: results })[0].values.egfr.readings.map((r) => r.value);
    expect(
      egfrs(
        lab('eGFR', { value: 80 }),
        lab('eGFR (CKD-EPI 2021)', { value: 84 }),
        lab('eGFR African American', { value: 92 }),
        // A later draw without a 2021 result shows its race-free result.
        lab('eGFR', { value: 75, at: '2024-03-06T18:00:00.000Z' })
      )
    ).toEqual([84, 75]);
    // Named 2021 beside a coded other race-free result, or coded 2021 beside a named one.
    expect(egfrs(lab('eGFR', { codes: ['62238-1'], value: 80 }), lab('eGFR CKD-EPI 2021', { value: 84 }))).toEqual([
      84,
    ]);
    expect(egfrs(lab('eGFR', { value: 80 }), lab('eGFR', { codes: ['98979-8'], value: 84 }))).toEqual([84]);
    // Without a 2021 result, every race-free one shows.
    expect(egfrs(lab('eGFR', { value: 80 }), lab('eGFR (MDRD)', { value: 78 }))).toEqual([80, 78]);
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

  test('urine culture: a coded organism ("Bacteria identified", 634-6 or 43409-2) shows its value; coded susceptibilities stay off', () => {
    const culture = { test: 'Culture, Urine', testCodes: ['630-4'] };
    expect(
      valuesOf(
        lab('Bacteria identified', { ...culture, codes: ['634-6'], text: 'Escherichia coli' }),
        lab('Organism', { ...culture, codes: ['43409-2'], text: 'Enterococcus faecalis' }),
        lab('Ampicillin [Susceptibility]', { ...culture, codes: ['18864-9'], text: 'R' }),
        lab('Nitrofurantoin [Susceptibility] by MIC', { ...culture, codes: ['18955-5'], text: '<=16', unit: 'ug/mL' }),
        lab('Sensitivity Panel', { ...culture, codes: ['50545-3'], text: 'Ampicillin R; Nitrofurantoin S' })
      )
    ).toEqual({ urineCulture: 'Escherichia coli; Enterococcus faecalis' });
  });

  test('urine culture: a coded colony count (19090-0 and its siblings) follows its organism with its unit, or alone shows its name; coded susceptibilities stay off', () => {
    const culture = { test: 'Culture, Urine', testCodes: ['630-4'] };
    expect(
      valuesOf(
        lab('Bacteria identified', { ...culture, codes: ['634-6'], text: 'Escherichia coli' }),
        lab('Colony count', { ...culture, codes: ['19090-0'], text: '>100000', unit: 'CFU/mL' }),
        lab('Ampicillin [Susceptibility]', { ...culture, codes: ['18864-9'], text: 'R' })
      )
    ).toEqual({ urineCulture: 'Escherichia coli >100000 CFU/mL' });
    expect(
      valuesOf(
        lab('Colony Count', { ...culture, codes: ['19091-8'], value: 50000, unit: 'CFU/mL' }),
        lab('Colony Count', {
          ...culture,
          codes: ['49223-1'],
          text: '10,000-49,000 CFU/mL',
          at: '2024-03-04T18:05:00Z',
        })
      )
    ).toEqual({ urineCulture: 'Colony Count 10,000-49,000 CFU/mL' });
  });

  test('urine culture: each coded organism reads with its own count, paired by order; only exact duplicate pairs go', () => {
    const culture = { test: 'Culture, Urine', testCodes: ['630-4'] };
    const organism = (name: string, id?: string): FlowsheetLabResult =>
      lab('Bacteria identified', { ...culture, codes: ['634-6'], text: name, id });
    const count = (text: string, id?: string, links?: string[]): FlowsheetLabResult =>
      lab('Colony count', { ...culture, codes: ['19090-0'], text, unit: 'CFU/mL', id, links });
    expect(
      valuesOf(
        organism('Escherichia coli'),
        count('>100000'),
        organism('Klebsiella pneumoniae'),
        count('>100000'),
        // The same organism and count sent twice.
        organism('Klebsiella pneumoniae'),
        count('>100000')
      )
    ).toEqual({ urineCulture: 'Escherichia coli >100000 CFU/mL; Klebsiella pneumoniae >100000 CFU/mL' });
    // Organisms first, then counts that link to them (the count derived from, or a member of, its organism).
    expect(
      valuesOf(
        organism('Escherichia coli', 'o1'),
        organism('Enterococcus faecalis', 'o2'),
        count('10000', 'c2', ['o2']),
        count('>100000', 'c1', ['o1'])
      )
    ).toEqual({ urineCulture: 'Escherichia coli >100000 CFU/mL; Enterococcus faecalis 10000 CFU/mL' });
    expect(
      valuesOf(
        lab('Bacteria identified', { ...culture, codes: ['634-6'], text: 'Escherichia coli', id: 'o1', links: ['c1'] }),
        count('>100000', 'c1')
      )
    ).toEqual({ urineCulture: 'Escherichia coli >100000 CFU/mL' });
  });

  test('urine culture: an uncoded susceptibility (value S, I or R) is left out of the organism cell', () => {
    const culture = { test: 'Culture, Urine', testCodes: ['630-4'] };
    expect(
      valuesOf(
        lab('Escherichia coli', { ...culture, text: '>100,000 CFU/mL' }),
        lab('Ampicillin', { ...culture, text: 'R' }),
        lab('Nitrofurantoin', { ...culture, text: 'S' }),
        lab('Cefazolin', { ...culture, text: ' i ' })
      )
    ).toEqual({ urineCulture: 'Escherichia coli >100,000 CFU/mL' });
  });

  test('urine culture: an uncoded susceptibility sent as a number (MIC) is left out; organism counts stay', () => {
    const culture = { test: 'Culture, Urine', testCodes: ['630-4'] };
    expect(
      valuesOf(
        lab('Escherichia coli', { ...culture, text: '>100,000 CFU/mL' }),
        lab('Ampicillin', { ...culture, text: '>=32', unit: 'ug/mL', flag: 'R' }),
        lab('Ciprofloxacin', { ...culture, value: 0.25, unit: 'mcg/mL' }),
        lab('Gentamicin', { ...culture, text: '<=1', unit: 'mg/L' }),
        lab('Nitrofurantoin', { ...culture, value: 16, flag: 'S' }),
        // An organism sent as a count, flagged abnormal, is kept.
        lab('Proteus mirabilis', { ...culture, value: 50000, unit: 'CFU/mL', flag: 'A' }),
        lab('Klebsiella pneumoniae', { ...culture, text: '>100000' })
      )
    ).toEqual({
      urineCulture: 'Escherichia coli >100,000 CFU/mL; Proteus mirabilis 50000 CFU/mL; Klebsiella pneumoniae >100000',
    });
  });

  test('urine culture: an uncoded susceptibility spelled out (Susceptible, Intermediate, Resistant) is left out', () => {
    const culture = { test: 'Culture, Urine', testCodes: ['630-4'] };
    expect(
      valuesOf(
        lab('Escherichia coli', { ...culture, text: '>100,000 CFU/mL' }),
        lab('Ampicillin', { ...culture, text: 'Resistant' }),
        lab('Nitrofurantoin', { ...culture, text: ' susceptible ' }),
        lab('Ceftriaxone', { ...culture, text: '<=1', flag: 'INTERMEDIATE' })
      )
    ).toEqual({ urineCulture: 'Escherichia coli >100,000 CFU/mL' });
  });

  test('urine culture: an uncoded disk-diffusion zone size (mm) is left out like an MIC', () => {
    const culture = { test: 'Culture, Urine', testCodes: ['630-4'] };
    expect(
      valuesOf(
        lab('Escherichia coli', { ...culture, text: '>100,000 CFU/mL' }),
        lab('Ampicillin', { ...culture, value: 18, unit: 'mm' }),
        lab('Ciprofloxacin', { ...culture, text: '>=21', unit: ' MM ' })
      )
    ).toEqual({ urineCulture: 'Escherichia coli >100,000 CFU/mL' });
  });

  test('urine culture: an organism count sent as a quantity keeps its unit', () => {
    const culture = { test: 'Urine Culture', testCodes: ['630-4'] };
    expect(
      valuesOf(
        lab('Urine Culture', { ...culture, text: 'Final report' }),
        lab('Escherichia coli', { ...culture, text: '>100000', unit: 'CFU/mL' }),
        lab('Enterococcus faecalis', { ...culture, value: 20000, unit: 'CFU/mL' })
      )
    ).toEqual({ urineCulture: 'Final report; Escherichia coli >100000 CFU/mL; Enterococcus faecalis 20000 CFU/mL' });
  });

  test('urine culture: reports are ordered by instant, so the later one is the cell', () => {
    const culture = { test: 'Urine Culture', testCodes: ['630-4'] };
    const visits = build({
      e1: [
        lab('Urine Culture', { ...culture, codes: ['630-4'], text: 'Preliminary: growth', at: '2024-03-04T14:00:00Z' }),
        lab('Urine Culture', { ...culture, codes: ['630-4'], text: 'No growth', at: '2024-03-04T10:30:00-05:00' }),
      ],
    });
    expect(visits[0].values.urineCulture.value).toBe('No growth');
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

  test('a rapid (point-of-care) HIV or hepatitis C antibody test lands on its screen row; an HIV immunoblot does not', () => {
    expect(
      valuesOf(
        lab('HIV 1/2 Ab, Rapid', { codes: ['80387-4'], text: 'Non-reactive' }),
        lab('HCV Ab, Rapid', { codes: ['72376-7'], text: 'Non-reactive' })
      )
    ).toEqual({ hivAgAb: 'Non-reactive', hepatitisCAntibody: 'Non-reactive' });
    expect(valuesOf(lab('HCV IgG Ab, Rapid', { codes: ['89359-4'], text: 'Reactive' }))).toEqual({
      hepatitisCAntibody: 'Reactive',
    });
    expect(valuesOf(lab('HIV 1+2 Ab, Immunoblot', { codes: ['44873-8'], text: 'Positive' }))).toEqual({});
  });

  test('HIV Ag/Ab: an antibody-only result shows "(antibody only)", by its code or else its name; an Ag/Ab one no note', () => {
    const hiv = (result: FlowsheetLabResult): [string | number, string | undefined] => {
      const value = build({ e1: [result] })[0].values.hivAgAb;
      return [value.value, value.note];
    };
    // By code: the rapid and lab antibody tests, whatever the name says; the 4th-generation Ag/Ab test has no note.
    expect(hiv(lab('HIV 1/2 Ab, Rapid', { codes: ['80387-4'], text: 'Non-reactive' }))).toEqual([
      'Non-reactive',
      'antibody only',
    ]);
    expect(hiv(lab('HIV', { codes: ['73906-0'], text: 'Non-reactive', test: 'OraQuick' }))).toEqual([
      'Non-reactive',
      'antibody only',
    ]);
    expect(hiv(lab('HIV 1+2 Ab', { codes: ['31201-7'], text: 'Nonreactive' }))).toEqual([
      'Nonreactive',
      'antibody only',
    ]);
    expect(hiv(lab('HIV Ag/Ab Antibody', { codes: ['56888-1'], text: 'Non-reactive' }))).toEqual([
      'Non-reactive',
      undefined,
    ]);
    expect(hiv(lab('HIV 1/2 Ag/Ab, 4th Gen', { codes: ['75666-8'], text: 'Non-reactive' }))).toEqual([
      'Non-reactive',
      undefined,
    ]);
    // By name: says antibody and not antigen, Ag/Ab, p24 or 4th generation.
    expect(hiv(lab('HIV 1/2 Antibody Screen', { text: 'Non-reactive' }))).toEqual(['Non-reactive', 'antibody only']);
    expect(hiv(lab('HIV-1/2', { text: 'Non-reactive', test: 'HIV-1/2 Ab, Rapid' }))).toEqual([
      'Non-reactive',
      'antibody only',
    ]);
    expect(hiv(lab('HIV-1/2 Ag/Ab', { text: 'Non-reactive' }))).toEqual(['Non-reactive', undefined]);
    expect(hiv(lab('HIV 1/2 Antigen and Antibody', { text: 'Non-reactive' }))).toEqual(['Non-reactive', undefined]);
    expect(hiv(lab('HIV Ab', { text: 'Non-reactive', test: 'HIV 4th generation screen' }))).toEqual([
      'Non-reactive',
      undefined,
    ]);
    expect(hiv(lab('HIV p24 Ag + Ab', { text: 'Non-reactive' }))).toEqual(['Non-reactive', undefined]);
    expect(hiv(lab('HIV Screen', { text: 'Non-reactive' }))).toEqual(['Non-reactive', undefined]);
  });

  test('a fingerstick glucose is its own row, coded or named; the serum Glucose row keeps the lab glucose', () => {
    expect(
      valuesOf(
        lab('Glucose', { codes: ['32016-8'], value: 112, test: 'Glucose Finger/Heel Stick' }),
        lab('Glucose', { codes: ['2345-7'], value: 98, test: 'Basic metabolic panel', at: '2024-03-04T19:00:00.000Z' })
      )
    ).toEqual({ fingerstickGlucose: 112, glucose: 98 });
    expect(valuesOf(lab('Glucose', { value: 140, test: 'POC Glucose' }))).toEqual({ fingerstickGlucose: 140 });
    expect(valuesOf(lab('Glucose, capillary', { value: 140 }))).toEqual({ fingerstickGlucose: 140 });
    expect(valuesOf(lab('Glucose', { value: 98, test: 'Comp. metabolic panel' }))).toEqual({ glucose: 98 });
  });

  test('a fasting fingerstick glucose, coded or named, is on Glucose (fingerstick) marked fasting, like Glucose', () => {
    const fingerstick = (result: FlowsheetLabResult): [string | number, string | undefined] => {
      const value = build({ e1: [result] })[0].values.fingerstickGlucose;
      return [value.value, value.note];
    };
    expect(fingerstick(lab('Glucose, Fasting', { codes: ['41604-0'], value: 104 }))).toEqual([104, 'fasting']);
    expect(fingerstick(lab('Fasting Glucose', { value: 98, test: 'POC Glucose' }))).toEqual([98, 'fasting']);
    expect(fingerstick(lab('Glucose', { codes: ['32016-8'], value: 112 }))).toEqual([112, undefined]);
  });

  test('hepatitis, HIV and STI results show their text as reported, coded or named; a number shows too', () => {
    expect(
      valuesOf(
        lab('Hepatitis B Surface Antigen', { codes: ['5196-1'], text: 'Nonreactive' }),
        lab('Hep B Surface Ab, Quant', { value: 245, unit: 'mIU/mL' }),
        lab('Hepatitis B Core Ab, Total', { text: 'Negative' }),
        lab('HCV RNA, Quantitative', { codes: ['11011-4'], text: 'Not detected' }),
        lab('HIV-1 RNA, Quant', { text: '<20', unit: 'copies/mL' }),
        lab('Chlamydia trachomatis RNA, TMA', { codes: ['42931-6'], text: 'Not detected' }),
        lab('Neisseria gonorrhoeae RNA, TMA', { text: 'Not detected', test: 'CT/NG NAA, Urine' }),
        lab('Trichomonas vaginalis RNA, TMA', { codes: ['70165-6'], text: 'Detected' }),
        lab('RPR', { codes: ['20507-0'], text: 'Reactive 1:8' }),
        lab('QuantiFERON-TB Gold Plus', { codes: ['71773-6'], text: 'Negative' }),
        lab('QuantiFERON Nil Value', { value: 0.04, unit: 'IU/mL' }),
        lab('Fecal Immunochemical Test (FIT)', { text: 'Negative' })
      )
    ).toEqual({
      hepatitisBSurfaceAntigen: 'Nonreactive',
      hepatitisBSurfaceAntibody: 245,
      hepatitisBCoreAntibody: 'Negative',
      hepatitisCRna: 'Not detected',
      hiv1Rna: '<20',
      chlamydia: 'Not detected',
      gonorrhea: 'Not detected',
      trichomonas: 'Detected',
      syphilisRpr: 'Reactive 1:8',
      igra: 'Negative',
      fit: 'Negative',
    });
  });

  test('lead: shows its specimen, from the code when it names one, else from the test or result name; else none', () => {
    const lead = (result: FlowsheetLabResult): [string | number, string | undefined] => {
      const value = build({ e1: [result] })[0].values.lead;
      return [value.value, value.note];
    };
    expect(lead(lab('Lead', { codes: ['10368-9'], value: 6, test: 'Lead, Venous' }))).toEqual([6, 'capillary']);
    expect(lead(lab('Lead, Blood', { codes: ['77307-7'], value: 2.1 }))).toEqual([2.1, 'venous']);
    expect(lead(lab('Lead', { codes: ['5671-3'], value: 3.6, test: 'Lead, Blood (Capillary)' }))).toEqual([
      3.6,
      'capillary',
    ]);
    expect(lead(lab('Lead, Blood (Venous)', { value: 2 }))).toEqual([2, 'venous']);
    expect(lead(lab('Lead', { value: 5.1, test: 'Lead Screen, Fingerstick' }))).toEqual([5.1, 'capillary']);
    expect(lead(lab('Lead', { codes: ['5671-3'], value: 1.2 }))).toEqual([1.2, undefined]);
    expect(lead(lab('Blood Lead', { value: 1.2 }))).toEqual([1.2, undefined]);
  });

  test('a genotyped HPV report: HPV 16 and HPV 18 (18/45) are their own rows, coded or named; a pooled 16/18 is the HPV 16/18 row', () => {
    expect(
      valuesOf(
        lab('HPV 16', { codes: ['77399-4'], text: 'Detected' }),
        lab('HPV 18', { codes: ['77400-0'], text: 'Not detected' }),
        lab('Other high risk HPV', { codes: ['71431-1'], text: 'Not detected' })
      )
    ).toEqual({ hpv16: 'Detected', hpv18: 'Not detected', hpvHighRisk: 'Not detected' });
    expect(
      valuesOf(
        lab('HPV Genotype 16', { text: 'Detected' }),
        lab('HPV 18/45', { text: 'Not detected' }),
        lab('HPV High Risk Other', { text: 'Not detected' })
      )
    ).toEqual({ hpv16: 'Detected', hpv18: 'Not detected', hpvHighRisk: 'Not detected' });
    expect(valuesOf(lab('HPV 16/18', { codes: ['70061-7'], text: 'Detected' }))).toEqual({ hpv16And18: 'Detected' });
    expect(valuesOf(lab('HPV 16/18', { text: 'Not detected' }))).toEqual({ hpv16And18: 'Not detected' });
    expect(valuesOf(lab('HPV 16 and 18', { codes: ['114970-7'], text: 'Detected' }))).toEqual({
      hpv16And18: 'Detected',
    });
  });

  test('HPV 18: a pooled 18/45 result shows "(18/45)", by its code or else its name; an HPV 18 one no note', () => {
    const hpv18 = (result: FlowsheetLabResult): [string | number, string | undefined] => {
      const value = build({ e1: [result] })[0].values.hpv18;
      return [value.value, value.note];
    };
    expect(hpv18(lab('HPV 18/45', { codes: ['75694-0'], text: 'Not detected' }))).toEqual(['Not detected', '18/45']);
    expect(hpv18(lab('HPV 18', { codes: ['106509-3'], text: 'Detected' }))).toEqual(['Detected', '18/45']);
    expect(hpv18(lab('HPV 18', { codes: ['77400-0'], text: 'Detected' }))).toEqual(['Detected', undefined]);
    expect(hpv18(lab('HPV Genotype 18/45', { text: 'Detected' }))).toEqual(['Detected', '18/45']);
    expect(hpv18(lab('HPV 18,45', { text: 'Not detected' }))).toEqual(['Not detected', '18/45']);
    expect(hpv18(lab('HPV 18', { text: 'Detected', test: 'HPV genotyping 16, 18, 45' }))).toEqual([
      'Detected',
      undefined,
    ]);
  });

  test('an uncoded pooled high-risk HPV result whose name lists 16 and 18 among other types is HPV (high risk)', () => {
    [
      'HPV High Risk DNA (16,18,31,33,35,39,45,51,52,56,58,59,68)',
      'HPV DNA High Risk Types 16/18/31/33/35/39/45/51/52/56/58/59/66/68',
      'HPV 16, 18, 31, 33, 35, 45, 51, 52, 56',
      'HPV, high risk',
      'Other high risk HPV (31,33,35,39,45,51,52,56,58,59,66,68)',
    ].forEach((name) => expect(valuesOf(lab(name, { text: 'Detected' }))).toEqual({ hpvHighRisk: 'Detected' }));
    // 16, 18 and 18/45 alone keep their rows.
    expect(valuesOf(lab('HPV 16/18', { text: 'Detected' }))).toEqual({ hpv16And18: 'Detected' });
    expect(valuesOf(lab('HPV 18/45', { text: 'Detected' }))).toEqual({ hpv18: 'Detected' });
    expect(valuesOf(lab('HPV 16', { text: 'Detected' }))).toEqual({ hpv16: 'Detected' });
  });

  test('a coded Trichomonas rapid antigen or wet-mount result lands on Trichomonas; a culture or Pap code does not', () => {
    expect(valuesOf(lab('Trichomonas vaginalis Ag', { codes: ['41511-7'], text: 'Positive' }))).toEqual({
      trichomonas: 'Positive',
    });
    expect(valuesOf(lab('OSOM Trichomonas', { codes: ['6566-4'], text: 'Negative' }))).toEqual({
      trichomonas: 'Negative',
    });
    expect(valuesOf(lab('Trichomonas, wet mount', { codes: ['14367-7'], text: 'None seen' }))).toEqual({
      trichomonas: 'None seen',
    });
    expect(valuesOf(lab('Trichomonas culture', { codes: ['90285-8'], text: 'Negative' }))).toEqual({});
    expect(valuesOf(lab('Trichomonas, urine sediment', { codes: ['5813-1'], text: 'Present' }))).toEqual({});
  });

  test('a urine result stays off the blood rows: urine glucose, hemoglobin and hCG land on their urine rows', () => {
    expect(
      valuesOf(
        lab('Glucose', { value: 50, test: 'Urinalysis (UA) Dipstick' }),
        lab('Hemoglobin', { text: 'Negative', test: 'Urinalysis, Complete' }),
        lab('Bilirubin, Direct', { text: 'Negative', test: 'Urinalysis' }),
        lab('hCG', { text: 'Negative', test: 'Urine Pregnancy Test (HCG)' }),
        lab('Lead', { value: 2, test: 'Heavy metals, urine' })
      )
    ).toEqual({ uaGlucose: 50, uaBlood: 'Negative', uaBilirubin: 'Negative', urineHcg: 'Negative' });
    // Named for blood, they are the blood rows.
    expect(
      valuesOf(
        lab('Bilirubin, Direct', { value: 0.2, test: 'Hepatic function panel' }),
        lab('hCG, Quantitative', { value: 1200, unit: 'mIU/mL', test: 'hCG, Quantitative, Serum' }),
        lab('Lead, Blood (Venous)', { value: 2 })
      )
    ).toEqual({ directBilirubin: 0.2, serumHcg: 1200, lead: 2 });
  });

  test('the Thyroid rows: Total T4, Free T3, Total T3, TPO antibodies (as text too) and thyroglobulin after TSH and Free T4', () => {
    expect(
      valuesOf(
        lab('TSH', { codes: ['3016-3'], value: 6.2 }),
        lab('Free T4', { value: 0.9 }),
        lab('T4, Total', { codes: ['3026-2'], value: 7.1 }),
        lab('Free T3', { value: 2.8 }),
        lab('Triiodothyronine (T3)', { value: 110 }),
        lab('Thyroid Peroxidase (TPO) Ab', { codes: ['8099-4'], text: 'Negative' }),
        lab('Thyroglobulin', { codes: ['3013-0'], value: 0.4 }),
        lab('Thyroglobulin Ab', { text: '<1.0' })
      )
    ).toEqual({
      tsh: 6.2,
      freeT4: 0.9,
      totalT4: 7.1,
      freeT3: 2.8,
      totalT3: 110,
      tpoAntibodies: 'Negative',
      thyroglobulin: 0.4,
      thyroglobulinAntibodies: '<1.0',
    });
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
