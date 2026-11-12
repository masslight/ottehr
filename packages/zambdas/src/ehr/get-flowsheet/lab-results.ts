import { FlowsheetLabResult, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { ConditionColumns, conditionColumns, LabRow } from './columns';
import { LAB_ROW_LOINC_CODES } from './lab-loinc-codes.generated';
import { FlowsheetData, FlowsheetDataKind } from './patient-data';

export const LAB_RESULTS_DATA_KINDS: FlowsheetDataKind[] = ['labs'];

const URINE = /urin|\bua\b/i;
const GLUCOSE: Pick<LabRow, 'analyte' | 'exclude'> = {
  analyte: /glucose/i,
  exclude: /tolerance|\bgtt\b|post|hour|minute|whole blood|capillary|fluid/i,
};
const CRP = /c.?reactive|\bcrp\b/i;
const HS_CRP = /hs.?crp|high.?sens|cardi/i;
const EGFR: Pick<LabRow, 'analyte' | 'exclude'> = {
  analyte: /\begfr\b|\bgfr\b|glomerular/i,
  // A race-based result is never shown, whatever equation it names.
  exclude: /black|african|non.?af/i,
};

/** Rows whose uncoded results come from blood tests: a urine test never lands on them. */
const serum = (rows: LabRow[]): LabRow[] => rows.map((row) => ({ ...row, excludeTest: URINE }));
/** Urinalysis rows: uncoded results only from a urine test, shown as reported, number or text. */
const urine = (rows: LabRow[]): LabRow[] => rows.map((row) => ({ ...row, test: URINE, text: true }));

/**
 * Lab rows (codes: lab-row-rules.ts). The name patterns only place uncoded results; the first matching row wins, so
 * absolute counts, high-sensitivity CRP and ratios are listed before, or excluded from, the rows they share a name
 * with. Glucose and eGFR each take two rules under one key (see lab-row-rules.ts).
 */
const LAB_ROWS: LabRow[] = [
  ...serum([
    // CBC
    { key: 'hemoglobin', analyte: /^(hemoglobin|hgb|hb)\b/i, exclude: /a1c|glyc|mean|\bmch|free|carboxy|met/i },
    { key: 'hematocrit', analyte: /hematocrit|\bhct\b/i },
    { key: 'mcv', analyte: /\bmcv\b|mean corpuscular volume/i },
    { key: 'mch', analyte: /\bmch\b|mean corpuscular hemoglobin/i, exclude: /conc|\bmchc\b/i },
    { key: 'mchc', analyte: /\bmchc\b|mean corpuscular hemoglobin conc/i },
    {
      key: 'rbc',
      analyte: /\brbc\b|erythrocyte|red blood cell/i,
      exclude: /distribution|\brdw\b|morph|cast|sediment/i,
    },
    { key: 'wbc', analyte: /\bwbc\b|leukocyte|white blood cell/i, exclude: /esterase|morph|cast|differential/i },
    { key: 'platelets', analyte: /platelet|\bplt\b/i, exclude: /\bmpv\b|mean|morph|volume/i },
    {
      key: 'neutrophilsAbsolute',
      analyte: /(neutrophil|\bneut\b|granulocyte).*(abs|#|count)|abs.*(neutrophil|granulocyte)/i,
    },
    { key: 'lymphocytesAbsolute', analyte: /(lymphocyte|\blymph\b).*(abs|#|count)|abs.*lymph/i },
    { key: 'neutrophilsPercent', analyte: /neutrophil|\bneut\b|granulocyte/i, exclude: /abs|#|count|band|immature/i },
    { key: 'lymphocytesPercent', analyte: /lymphocyte|\blymph\b/i, exclude: /abs|#|count|atyp|reactive|variant/i },
    { key: 'monocytesPercent', analyte: /monocyte|\bmono\b/i, exclude: /abs|#|count/i },
    { key: 'eosinophilsPercent', analyte: /eosinophil|\beos\b/i, exclude: /abs|#|count/i },
    { key: 'basophilsPercent', analyte: /basophil|\bbaso\b/i, exclude: /abs|#|count/i },
    // CMP/BMP
    { key: 'glucose', rule: 'fastingGlucose', fasting: true, ...GLUCOSE },
    { key: 'glucose', fasting: true, ...GLUCOSE },
    { key: 'bun', analyte: /\bbun\b|urea nitrogen/i, exclude: /ratio|\/|creat/i },
    { key: 'creatinine', analyte: /creatinine/i, exclude: /ratio|\/|bun|urea|albumin|protein|clearance|gfr/i },
    { key: 'egfr', rule: 'egfr2021', ...EGFR },
    { key: 'egfr', ...EGFR },
    { key: 'bunCreatinineRatio', analyte: /bun\/creat|urea nitrogen\/creat|bun.*creatinine ratio/i },
    { key: 'sodium', analyte: /sodium|^na$/i },
    { key: 'potassium', analyte: /potassium|^k$/i },
    { key: 'chloride', analyte: /chloride|^cl$/i },
    { key: 'bicarbonate', analyte: /\bco2\b|carbon dioxide|bicarbonate|\bhco3\b/i, exclude: /partial|pco2|arterial/i },
    { key: 'calcium', analyte: /calcium/i, exclude: /ionized|corrected/i },
    // CMP
    {
      key: 'totalProtein',
      analyte: /^protein\b|total protein|protein,? total/i,
      exclude: /\/|ratio|protein [sc]\b|electro|binding/i,
    },
    { key: 'albumin', analyte: /^albumin\b|albumin,? serum/i, exclude: /\/|ratio|micro|globulin|bound/i },
    { key: 'globulin', analyte: /^globulin\b|globulin,? total|total globulin/i, exclude: /\/|ratio|immuno|binding/i },
    { key: 'albuminGlobulinRatio', analyte: /a\/g ratio|albumin\/globulin|alb\/glob/i },
    {
      key: 'totalBilirubin',
      analyte: /bilirubin/i,
      exclude: /direct|conjugated|indirect|unconjugated|neonat|transcut/i,
    },
    {
      key: 'alkalinePhosphatase',
      analyte: /alkaline phosphatase|alk phos|\balp\b/i,
      exclude: /isoenz|bone|intestinal|liver/i,
    },
    { key: 'ast', analyte: /\bast\b|aspartate|\bsgot\b/i },
    { key: 'alt', analyte: /\balt\b|alanine|\bsgpt\b/i },
    // Lipid panel
    { key: 'totalCholesterol', analyte: /cholesterol/i, exclude: /ldl|hdl|non|ratio|\//i },
    { key: 'ldlCholesterol', analyte: /\bldl\b/i, exclude: /ratio|\/|vldl|particle|size|pattern/i },
    { key: 'hdlCholesterol', analyte: /\bhdl\b/i, exclude: /ratio|\/|non|particle/i },
    { key: 'triglycerides', analyte: /triglycerid|\btrig\b/i },
    { key: 'nonHdlCholesterol', analyte: /non.?hdl/i },
    // Thyroid
    { key: 'tsh', analyte: /\btsh\b|thyrotropin|thyroid stimulating/i, exclude: /receptor|antibod|binding|globulin/i },
    { key: 'freeT4', analyte: /free t4|ft4|thyroxine.*free/i },
    // Iron panel
    {
      key: 'iron',
      analyte: /^iron\b|iron,? (serum|total)|total iron/i,
      exclude: /binding|saturation|\btibc\b|\buibc\b|%/i,
    },
    { key: 'tibc', analyte: /\btibc\b|iron binding capacity/i, exclude: /unsaturated|\buibc\b/i },
    { key: 'transferrinSaturation', analyte: /iron.*sat|sat.*iron|transferrin sat|% ?sat/i },
    { key: 'ferritin', analyte: /ferritin/i },
    // Standalone tests
    { key: 'hba1c', analyte: /a1c|glycated|glycohemoglobin/i, exclude: /estimated|\beag\b|average glucose/i },
    { key: 'vitaminD', analyte: /25.?(oh|hydroxy)|vitamin d\b/i, exclude: /1,25|dihydroxy|\bd2\b|\bd3\b/i },
    { key: 'vitaminB12', analyte: /b.?12|cobalamin/i, exclude: /binding|unsat|methylmalonic/i },
    { key: 'psa', analyte: /\bpsa\b|prostate specific/i, exclude: /free|ratio|%|\//i },
    { key: 'magnesium', analyte: /magnesium|^mg$/i },
    { key: 'hsCrp', analyte: HS_CRP, exclude: /troponin/i },
    { key: 'crp', analyte: CRP, exclude: HS_CRP },
    {
      key: 'hivAgAb',
      text: true,
      analyte: /\bhiv\b/i,
      exclude: /\brna\b|viral load|genotyp|confirm|differentiation|western/i,
    },
    {
      key: 'hepatitisCAntibody',
      text: true,
      analyte: /hepatitis c|\bhcv\b|hep c/i,
      exclude: /\brna\b|viral load|genotyp|quant|pcr/i,
    },
    { key: 'esr', analyte: /sed rate|sedimentation|\besr\b/i },
    { key: 'uricAcid', analyte: /uric acid|urate/i },
    { key: 'folate', analyte: /folate|folic acid/i, exclude: /rbc|red cell/i },
    { key: 'testosterone', analyte: /testosterone/i, exclude: /free|bioavail|%|\bshbg\b/i },
    { key: 'pth', analyte: /\bpth\b|parathyroid hormone|parathyrin/i, exclude: /related|rp\b|intraop/i },
    { key: 'phosphorus', analyte: /phosph(orus|ate)/i, exclude: /alkaline|acid|organo/i },
  ]),
  // Urine tests other than the urinalysis: an in-house POC ratio or pregnancy test need not say "urine".
  { key: 'urineAlbuminCreatinineRatio', analyte: /(micro)?albumin\/creat|albumin.*creatinine ratio|\buacr\b|\bacr\b/i },
  { key: 'urineHcg', text: true, analyte: /hcg|chorio|pregnan/i, test: /urin|pregnan/i, exclude: /serum|quant|blood/i },
  ...urine([
    { key: 'uaColor', analyte: /colou?r/i },
    { key: 'uaAppearance', analyte: /appearance|clarity|turbid/i },
    { key: 'uaSpecificGravity', analyte: /specific gravity|sp\.? ?gr/i },
    { key: 'uaPh', analyte: /\bph\b/i },
    { key: 'uaProtein', analyte: /protein|albumin/i, exclude: /creatinine|\/|ratio|micro/i },
    { key: 'uaGlucose', analyte: /glucose/i },
    { key: 'uaKetones', analyte: /ketone/i },
    { key: 'uaBilirubin', analyte: /bilirubin|\bbili\b/i },
    { key: 'uaBlood', analyte: /blood|hemoglobin|\bhgb\b|occult/i, exclude: /cells|\brbc\b/i },
    { key: 'uaNitrite', analyte: /nitrite/i },
    { key: 'uaLeukocyteEsterase', analyte: /leuk|esterase/i },
    { key: 'uaUrobilinogen', analyte: /urobilinogen/i },
  ]),
];

const hasCode = (lab: FlowsheetLabResult, rule: string): boolean =>
  lab.loincCodes.some((code) => LAB_ROW_LOINC_CODES[rule].includes(code));

/** Of one draw's eGFR results, only the 2021 race-free CKD-EPI one is shown when the lab sent it. */
const preferEgfr2021 = (labs: FlowsheetLabResult[]): FlowsheetLabResult[] =>
  labs.filter(
    (lab) =>
      !(hasCode(lab, 'egfr') && labs.some((other) => hasCode(other, 'egfr2021') && other.resultedAt === lab.resultedAt))
  );

/** A fasting glucose code, or an uncoded result named fasting, marks the result fasting like the report can. */
const markFasting = (lab: FlowsheetLabResult): FlowsheetLabResult =>
  hasCode(lab, 'fastingGlucose') || (lab.loincCodes.length === 0 && /fasting/i.test(lab.analyte))
    ? { ...lab, fasting: true }
    : lab;

const URINE_CULTURE_NAME = /urine culture|culture,? urine/i;

/** A result of a urine culture order or report, including its organisms, which carry lab-local codes. */
const isUrineCultureResult = (lab: FlowsheetLabResult): boolean =>
  lab.testLoincCodes.some((code) => LAB_ROW_LOINC_CODES.urineCulture.includes(code)) ||
  URINE_CULTURE_NAME.test(lab.testName);

/**
 * The culture's own result reads as reported ("No growth"); an organism reads its name and count as reported. Other
 * coded results of the same order (susceptibilities) are left out.
 */
const cultureText = (lab: FlowsheetLabResult): string => {
  if (hasCode(lab, 'urineCulture') || URINE_CULTURE_NAME.test(lab.analyte)) return lab.valueText;
  return lab.loincCodes.length === 0 ? [lab.analyte, lab.valueText].filter(Boolean).join(' ') : '';
};

const unique = (texts: string[]): string[] => [...new Set(texts)];

/** One Urine culture reading per report time in each column, listing every organism of that culture. */
const addUrineCultures = (columns: ConditionColumns, labs: Record<string, FlowsheetLabResult[]>): void =>
  Object.entries(labs).forEach(([key, results]) => {
    const byTime = new Map<string, string[]>();
    results.filter(isUrineCultureResult).forEach((lab) => {
      const text = cultureText(lab);
      if (!text) return;
      const time = lab.resultedAt ?? '';
      byTime.set(time, [...(byTime.get(time) ?? []), text]);
    });
    [...byTime]
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([time, texts]) => {
        const column = columns.columnFor(key, time || undefined);
        if (!column) return;
        columns.addReading(column, 'urineCulture', { time: time || column.start, value: unique(texts).join('; ') });
      });
  });

export const buildLabResultsFlowsheet = (data: FlowsheetData): FlowsheetVisit[] => {
  const labs = Object.fromEntries(
    Object.entries(data.labs ?? {}).map(([key, results]) => [key, preferEgfr2021(results).map(markFasting)])
  );
  // No vitals rows: a visit or an outside result is a column when it has a result for any row.
  const columns = conditionColumns({ ...data, labs }, []);
  columns.addLabs(LAB_ROWS);
  addUrineCultures(columns, labs);
  return columns.list();
};
