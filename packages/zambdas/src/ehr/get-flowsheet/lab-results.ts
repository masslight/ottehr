import { FlowsheetLabResult, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { byInstant, ConditionColumns, conditionColumns, LabRow } from './columns';
import { LAB_ROW_LOINC_CODES } from './lab-loinc-codes.generated';
import { FlowsheetData, FlowsheetDataKind } from './patient-data';
import { THYROID_LAB_ROWS } from './thyroid';

export const LAB_RESULTS_DATA_KINDS: FlowsheetDataKind[] = ['labs'];

const URINE = /urin|\bua\b/i;
const GLUCOSE: Pick<LabRow, 'analyte' | 'exclude'> = {
  analyte: /glucose/i,
  exclude: /tolerance|\bgtt\b|post|hour|minute|whole blood|capillary|fluid/i,
};
/** A meter reading, by its test's or its own name ("Glucose Finger/Heel Stick", "POC Glucose"). */
const FINGERSTICK_GLUCOSE: Pick<LabRow, 'analyte' | 'exclude' | 'test'> = {
  analyte: /glucose/i,
  exclude: /tolerance|\bgtt\b|post|hour|minute|fluid/i,
  test: /capillary|whole blood|finger|heel|\bpoc\b|point.of.care|glucometer|\bmeter\b/i,
};
const CRP = /c.?reactive|\bcrp\b/i;
const HS_CRP = /hs.?crp|high.?sens|cardi/i;
const EGFR: Pick<LabRow, 'analyte' | 'exclude'> = {
  analyte: /\begfr\b|\bgfr\b|glomerular/i,
  // A race-based result is never shown, whatever equation it names.
  exclude: /black|african|non.?af/i,
};

const hasCode = (lab: FlowsheetLabResult, rule: string): boolean =>
  lab.loincCodes.some((code) => LAB_ROW_LOINC_CODES[rule].includes(code));

/** A lead level's specimen: the one its code names, else the one its test's or its own name does. */
const leadSpecimen = (lab: FlowsheetLabResult): string | undefined => {
  if (hasCode(lab, 'leadCapillary')) return 'capillary';
  if (hasCode(lab, 'leadVenous')) return 'venous';
  const name = `${lab.testName} ${lab.analyte}`;
  return /capillary|finger|heel/i.test(name) ? 'capillary' : /venous/i.test(name) ? 'venous' : undefined;
};
const LEAD: Pick<LabRow, 'analyte' | 'note'> = {
  analyte: /^lead\b|blood lead|\blead,? (blood|venous|capillary)/i,
  note: leadSpecimen,
};

/** Rows whose uncoded results come from blood tests: a urine test never lands on them (a row may exclude more). */
const serum = (rows: LabRow[]): LabRow[] => rows.map((row) => ({ excludeTest: URINE, ...row }));
/** Urinalysis rows: uncoded results only from a urine test, shown as reported, number or text. */
const urine = (rows: LabRow[]): LabRow[] => rows.map((row) => ({ ...row, test: URINE, text: true }));

/**
 * Lab rows (codes: lab-row-rules.ts). The name patterns only place uncoded results; the first matching row wins, so
 * absolute counts, high-sensitivity CRP and ratios are listed before, or excluded from, the rows they share a name
 * with. Glucose, fingerstick glucose and eGFR each take two rules under one key, and Lead three (see lab-row-rules.ts).
 */
const LAB_ROWS: LabRow[] = [
  ...serum([
    // CBC
    {
      key: 'hemoglobin',
      analyte: /^(hemoglobin|hgb|hb)\b/i,
      exclude: /a1c|glyc|mean|\bmch|free|carboxy|met|fecal|stool|occult/i,
    },
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
    { key: 'monocytesAbsolute', analyte: /(monocyte|\bmono\b).*(abs|#|count)|abs.*mono/i },
    { key: 'eosinophilsAbsolute', analyte: /(eosinophil|\beos\b).*(abs|#|count)|abs.*eos/i },
    { key: 'basophilsAbsolute', analyte: /(basophil|\bbaso\b).*(abs|#|count)|abs.*baso/i },
    { key: 'rdw', analyte: /\brdw\b|distribution width/i },
    // CMP/BMP. A meter glucose is listed first, so the serum Glucose row never takes it.
    { key: 'fingerstickGlucose', rule: 'fastingFingerstickGlucose', fasting: true, ...FINGERSTICK_GLUCOSE },
    { key: 'fingerstickGlucose', fasting: true, ...FINGERSTICK_GLUCOSE },
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
    { key: 'anionGap', analyte: /anion gap/i },
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
      key: 'directBilirubin',
      analyte: /bilirubin.*(direct|conjugated)|(direct|conjugated).*bilirubin/i,
      exclude: /indirect|unconjugated/i,
      // Serum or plasma, as for Total bilirubin.
      excludeTest: /urin|\bua\b|cord|neonat|newborn|capillary|heel/i,
    },
    {
      key: 'totalBilirubin',
      analyte: /bilirubin/i,
      exclude: /direct|conjugated|indirect|unconjugated|neonat|transcut/i,
      // Serum or plasma only: not urine, cord blood, or a heel-stick (neonatal capillary) sample.
      excludeTest: /urin|\bua\b|cord|neonat|newborn|capillary|heel/i,
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
    // Thyroid: the Thyroid flowsheet's rows
    ...THYROID_LAB_ROWS,
    // Iron panel
    {
      key: 'iron',
      analyte: /^iron\b|iron,? (serum|total)|total iron/i,
      exclude: /binding|saturation|\btibc\b|\buibc\b|%/i,
    },
    { key: 'tibc', analyte: /\btibc\b|iron binding capacity/i, exclude: /unsaturated|\buibc\b/i },
    { key: 'transferrinSaturation', analyte: /iron.*sat|sat.*iron|transferrin sat|% ?sat/i },
    { key: 'ferritin', analyte: /ferritin/i },
    // Coagulation
    { key: 'inr', analyte: /\binr\b|international normali[sz]ed ratio/i },
    { key: 'pt', analyte: /\bpt\b|prothrombin time|\bprotime\b/i, exclude: /\binr\b|ptt|partial|mix/i },
    // Hepatitis: shown as reported ("Negative", "Reactive", "<5 mIU/mL"), number or text.
    {
      key: 'hepatitisBSurfaceAntigen',
      text: true,
      analyte: /hep(atitis)? ?b.*surface.*(antigen|\bag\b)|\bhbsag\b|\bhbs ag\b/i,
      exclude: /antibod|\bab\b/i,
    },
    {
      key: 'hepatitisBSurfaceAntibody',
      text: true,
      analyte: /hep(atitis)? ?b.*surface.*(antibod|\bab\b)|\bhbsab\b|\bhbs ab\b|anti-?hbs\b/i,
    },
    {
      key: 'hepatitisBCoreAntibody',
      text: true,
      analyte: /hep(atitis)? ?b.*core.*(antibod|\bab\b)|\bhbcab\b|\bhbc ab\b|anti-?hbc\b/i,
      exclude: /igm/i,
    },
    {
      key: 'hepatitisCRna',
      text: true,
      analyte: /(hepatitis c|\bhcv\b|hep c).*(\brna\b|viral load|pcr|quant)/i,
      exclude: /genotyp|\blog\b/i,
    },
    // HIV and STI, shown as reported ("Not detected", "Reactive 1:8"); the swab and urine tests are below.
    { key: 'hiv1Rna', text: true, analyte: /\bhiv.*(\brna\b|viral load)/i, exclude: /genotyp|resist|\blog\b/i },
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
    { key: 'syphilisRpr', text: true, analyte: /\brpr\b|rapid plasma reagin/i },
    {
      key: 'syphilisTreponemalAntibody',
      text: true,
      analyte: /treponem|t\.? ?pallidum|\btp-?pa\b|\bfta\b/i,
      exclude: /nontreponemal|non-treponemal|reagin|\brpr\b|igm/i,
    },
    {
      key: 'igra',
      text: true,
      analyte: /quantiferon|\bigra\b|t-?spot|interferon.?gamma release|\btb gold\b/i,
      // The tubes' numbers (nil, mitogen, TB antigen minus nil) stay off: the row is the test's result.
      exclude: /\bnil\b|mitogen|\btb ?[12]\b|minus|antigen|\bag\b|value/i,
    },
    { key: 'lipoproteinA', analyte: /lipoprotein ?\(a\)|lipoprotein a\b|\blp ?\(a\)/i },
    { key: 'apoB', analyte: /\bapo ?b\b|apolipoprotein b/i, exclude: /\/|ratio/i },
    { key: 'ntProBnp', analyte: /nt-?pro-?bnp|pro.?bnp|n-terminal/i },
    { key: 'bnp', analyte: /\bbnp\b|b-type natriuretic|brain natriuretic/i, exclude: /\bpro|n-terminal/i },
    { key: 'cystatinC', analyte: /cystatin/i, exclude: /gfr|glomerular/i },
    { key: 'ck', analyte: /\bck\b|creatine kinase|\bcpk\b/i, exclude: /\bmb\b|isoenz|index|relative/i },
    {
      key: 'serumHcg',
      analyte: /hcg|chorio/i,
      exclude: /free|alpha|tumor|qual/i,
      // A pregnancy test that names no specimen is the urine one (below).
      test: /quant|serum|plasma|blood/i,
    },
    { key: 'ttgIga', analyte: /transglutaminase|\bttg\b/i, exclude: /igg|igm/i },
    { key: 'lead', rule: 'leadCapillary', ...LEAD },
    { key: 'lead', rule: 'leadVenous', ...LEAD },
    { key: 'lead', ...LEAD },
    { key: 'esr', analyte: /sed rate|sedimentation|\besr\b/i },
    { key: 'uricAcid', analyte: /uric acid|urate/i },
    { key: 'folate', analyte: /folate|folic acid/i, exclude: /rbc|red cell/i },
    { key: 'testosterone', analyte: /testosterone/i, exclude: /free|bioavail|%|\bshbg\b/i },
    { key: 'pth', analyte: /\bpth\b|parathyroid hormone|parathyrin/i, exclude: /related|rp\b|intraop/i },
    { key: 'phosphorus', analyte: /phosph(orus|ate)/i, exclude: /alkaline|acid|organo/i },
  ]),
  // Swab or urine NAATs and the stool FIT, number or text as reported; their names say neither "urine" nor "serum".
  {
    key: 'chlamydia',
    text: true,
    analyte: /chlamydia|c\.? ?trachomatis/i,
    exclude: /pneumoniae|psittaci|antibod|\bab\b|ig[gm]/i,
  },
  { key: 'gonorrhea', text: true, analyte: /gonorrh|n\.? ?gonorrhoeae|neisseria gon/i, exclude: /antibod|\bab\b/i },
  { key: 'trichomonas', text: true, analyte: /trichomon|\bt\.? ?vaginalis/i, exclude: /antibod|\bab\b/i },
  { key: 'hpvHighRisk', text: true, analyte: /\bhpv\b|papilloma/i, exclude: /\b(16|18)\b|genotyp|low.?risk|vaccin/i },
  { key: 'hpv16', text: true, analyte: /(\bhpv\b|papilloma).*\b16\b/i, exclude: /\b18\b|low.?risk|vaccin/i },
  { key: 'hpv18', text: true, analyte: /(\bhpv\b|papilloma).*\b18\b/i, exclude: /\b16\b|low.?risk|vaccin/i },
  { key: 'fit', text: true, analyte: /\bfit\b|immunochem|\bifobt\b|occult blood.*immuno/i, exclude: /guaiac/i },
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

/** Of one draw's eGFR results, only the 2021 race-free CKD-EPI one is shown when the lab sent it. */
const preferEgfr2021 = (labs: FlowsheetLabResult[]): FlowsheetLabResult[] =>
  labs.filter(
    (lab) =>
      !(hasCode(lab, 'egfr') && labs.some((other) => hasCode(other, 'egfr2021') && other.resultedAt === lab.resultedAt))
  );

/** A fasting glucose code, or an uncoded result named fasting, marks the result fasting like the report can. */
const markFasting = (lab: FlowsheetLabResult): FlowsheetLabResult =>
  hasCode(lab, 'fastingGlucose') ||
  hasCode(lab, 'fastingFingerstickGlucose') ||
  (lab.loincCodes.length === 0 && /fasting/i.test(lab.analyte))
    ? { ...lab, fasting: true }
    : lab;

const URINE_CULTURE_NAME = /urine culture|culture,? urine/i;

/** A result of a urine culture order or report, including its organisms, which carry lab-local codes. */
const isUrineCultureResult = (lab: FlowsheetLabResult): boolean =>
  lab.testLoincCodes.some((code) => LAB_ROW_LOINC_CODES.urineCulture.includes(code)) ||
  URINE_CULTURE_NAME.test(lab.testName);

/** A susceptibility's value: susceptible, intermediate or resistant, as a letter or spelled out. */
const SUSCEPTIBILITY = /^\s*([SIR]|susceptible|intermediate|resistant)\s*$/i;
/** A quantity's text: a number, with its comparator if any. */
const QUANTITY_TEXT = /^\s*[<>]?=?\s*[\d.,]+\s*$/;
/**
 * A susceptibility's unit: an antibiotic concentration (MIC) or a disk-diffusion zone size in mm; organism counts
 * are in CFU, never in either.
 */
const MIC_UNIT = /^\s*(mg\/l|(u|µ|μ|mc)g\/ml|mm)\s*$/i;

/**
 * The culture's own result reads as reported ("No growth"); an organism reads its name and count as reported. Other
 * coded results of the same order are left out, and so are uncoded susceptibilities: valued or interpreted S, I or R,
 * or an MIC (a value in an antibiotic-concentration unit).
 */
const cultureText = (lab: FlowsheetLabResult): string => {
  // A count sent as a quantity keeps its unit: ">100000 CFU/mL".
  const reported = QUANTITY_TEXT.test(lab.valueText) && lab.unit ? `${lab.valueText} ${lab.unit}` : lab.valueText;
  if (hasCode(lab, 'urineCulture') || URINE_CULTURE_NAME.test(lab.analyte)) return reported;
  const susceptibility =
    SUSCEPTIBILITY.test(lab.valueText) || SUSCEPTIBILITY.test(lab.interpretation) || MIC_UNIT.test(lab.unit);
  if (lab.loincCodes.length > 0 || susceptibility) return '';
  return [lab.analyte, reported].filter(Boolean).join(' ');
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
      .sort(([a], [b]) => byInstant(a, b))
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
