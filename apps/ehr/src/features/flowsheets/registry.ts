import { FlowsheetId } from 'utils/lib/types/api/flowsheets.types';

export interface FlowsheetRow {
  label: string;
  /** Measure keys of the get-flowsheet response shown in this row, joined with "/" (e.g. systolic/diastolic). */
  keys: string[];
  /** Decimal places for numeric values; text values (e.g. medication names) and unrounded numbers omit it. */
  digits?: number;
  /** The panel heading the row sits under; consecutive rows with the same group share one heading. */
  group?: string;
  /** Leave the row out when no visit shown has a value for it (BMI rows for a patient under 2). */
  hideWhenEmpty?: boolean;
  /** A metric measure the grid can show imperial (practice header unit system) with both units on hover. */
  imperial?: { label: string; unit: 'lbs' | 'in' };
  /** A temperature in °C, with °F on hover as in vitals history ("37.0 C ≈ 98.6 F"). */
  fahrenheit?: boolean;
}

export interface FlowsheetChart {
  title: string;
  unit: string;
  lines: { name: string; key: string }[];
  /** Plot against hours of life (0–336 h) when the visits carry them (time of birth recorded), else against time. */
  hoursOfLife?: boolean;
  /** The y-axis always shows at least this range, widened to fit any value outside it. */
  yRange?: [number, number];
  /** The y-axis tick step, where ECharts' own would miss the range's ends (85 to 100 by 3s tops out at 99). */
  yStep?: number;
  /** The y-axis is at least this tall, centred on the values; without yRange or minSpan, ±10% of the middle value. */
  minSpan?: number;
  /** The unit when the practice's header unit system is imperial (a weight in lbs). */
  imperialUnit?: 'lbs';
  /** A temperature in °C, its hover with °F as in vitals history. */
  fahrenheit?: boolean;
}

export interface FlowsheetDefinition {
  id: FlowsheetId;
  title: string;
  rows: FlowsheetRow[];
  charts: FlowsheetChart[];
  /** Show only the rows the patient has a value for (and only the headings that keep a row). */
  hideEmptyRows?: boolean;
}

const vitals: FlowsheetDefinition = {
  id: 'vitals',
  title: 'Vitals',
  rows: [
    { label: 'Temperature (°C)', keys: ['temperature'], digits: 1, fahrenheit: true },
    { label: 'Heart rate (/min)', keys: ['heartRate'], digits: 0 },
    { label: 'Respiratory rate (/min)', keys: ['respirationRate'], digits: 0 },
    { label: 'SpO₂ (%)', keys: ['oxygenSaturation'], digits: 0 },
    { label: 'Blood pressure (mm Hg)', keys: ['systolic', 'diastolic'], digits: 0 },
    { label: 'Weight (kg)', keys: ['weight'], digits: 2, imperial: { label: 'Weight (lbs)', unit: 'lbs' } },
    { label: 'Height (cm)', keys: ['height'], digits: 1, imperial: { label: 'Height (in)', unit: 'in' } },
    // Measured in infants, so left out (like BMI under 2 years) when no visit shown has one.
    {
      label: 'Head circumference (cm)',
      keys: ['headCircumference'],
      digits: 1,
      hideWhenEmpty: true,
      imperial: { label: 'Head circumference (in)', unit: 'in' },
    },
    // No BMI under 2 years, so the row is left out when no visit shown has one.
    { label: 'BMI (kg/m²)', keys: ['bmi'], digits: 1, hideWhenEmpty: true },
  ],
  charts: [
    { title: 'Heart rate', unit: '/min', minSpan: 40, lines: [{ name: 'Heart rate', key: 'heartRate' }] },
    { title: 'SpO₂', unit: '%', yRange: [85, 100], yStep: 5, lines: [{ name: 'SpO₂', key: 'oxygenSaturation' }] },
    {
      title: 'Temperature',
      unit: '°C',
      yRange: [35, 40],
      fahrenheit: true,
      lines: [{ name: 'Temperature', key: 'temperature' }],
    },
    { title: 'Weight', unit: 'kg', imperialUnit: 'lbs', lines: [{ name: 'Weight', key: 'weight' }] },
    { title: 'BMI', unit: 'kg/m²', lines: [{ name: 'BMI', key: 'bmi' }] },
    {
      title: 'Blood pressure',
      unit: 'mm Hg',
      minSpan: 40,
      lines: [
        { name: 'Systolic', key: 'systolic' },
        { name: 'Diastolic', key: 'diastolic' },
      ],
    },
  ],
};

// Percentiles are WHO (birth to 24 months) / CDC (2 to 20 years) for the patient's sex; BMI is computed from the
// visit's weight and height from 2 years (never under 2, so its rows disappear for an infant). Percentile rows are text ("88th", "<1st", "implausible") computed by the server. The
// growth chart cards (GrowthCharts.tsx) take the place of trend charts, from the server's growth data.
const growth: FlowsheetDefinition = {
  id: 'growth',
  title: 'Growth',
  // An adult has no percentile or head circumference rows; they would only be empty.
  hideEmptyRows: true,
  rows: [
    { label: 'Age', keys: ['age'] },
    { label: 'Weight (kg)', keys: ['weight'], digits: 2, imperial: { label: 'Weight (lbs)', unit: 'lbs' } },
    { label: 'Weight percentile', keys: ['weightPercentile'] },
    {
      label: 'Height / length (cm)',
      keys: ['height'],
      digits: 1,
      imperial: { label: 'Height / length (in)', unit: 'in' },
    },
    { label: 'Height / length percentile', keys: ['heightPercentile'] },
    { label: 'BMI (kg/m²)', keys: ['bmi'], digits: 1, hideWhenEmpty: true },
    { label: 'BMI percentile', keys: ['bmiPercentile'], hideWhenEmpty: true },
    { label: 'Weight-for-length percentile', keys: ['weightForLengthPercentile'] },
    {
      label: 'Head circumference (cm)',
      keys: ['headCircumference'],
      digits: 1,
      imperial: { label: 'Head circumference (in)', unit: 'in' },
    },
    { label: 'Head circumference percentile', keys: ['headCircumferencePercentile'] },
  ],
  charts: [],
};

// Lab rows carry no unit in the label and no rounding: the value and unit are shown as the lab saved them.
const thyroid: FlowsheetDefinition = {
  id: 'thyroid',
  title: 'Thyroid',
  rows: [
    { label: 'TSH', keys: ['tsh'] },
    { label: 'Free T4', keys: ['freeT4'] },
    // Less often ordered, so left out when no visit shown has one.
    { label: 'Total T4', keys: ['totalT4'], hideWhenEmpty: true },
    { label: 'Free T3', keys: ['freeT3'], hideWhenEmpty: true },
    { label: 'Total T3', keys: ['totalT3'], hideWhenEmpty: true },
    { label: 'TPO antibodies', keys: ['tpoAntibodies'], hideWhenEmpty: true },
    { label: 'Thyroglobulin', keys: ['thyroglobulin'], hideWhenEmpty: true },
    { label: 'Thyroglobulin antibodies', keys: ['thyroglobulinAntibodies'], hideWhenEmpty: true },
    { label: 'Thyroid medication', keys: ['thyroidMedication'] },
    { label: 'Thyroid diagnosis this visit', keys: ['thyroidDiagnosis'] },
    { label: 'Weight (kg)', keys: ['weight'], digits: 2, imperial: { label: 'Weight (lbs)', unit: 'lbs' } },
    { label: 'Heart rate (/min)', keys: ['heartRate'], digits: 0 },
  ],
  charts: [
    { title: 'TSH', unit: 'mIU/L', lines: [{ name: 'TSH', key: 'tsh' }] },
    { title: 'Free T4', unit: 'ng/dL', lines: [{ name: 'Free T4', key: 'freeT4' }] },
    { title: 'Weight', unit: 'kg', imperialUnit: 'lbs', lines: [{ name: 'Weight', key: 'weight' }] },
    { title: 'Heart rate', unit: '/min', minSpan: 40, lines: [{ name: 'Heart rate', key: 'heartRate' }] },
  ],
};

const newbornBilirubin: FlowsheetDefinition = {
  id: 'newbornBilirubin',
  title: 'Newborn bilirubin',
  rows: [
    { label: 'Total bilirubin (blood)', keys: ['newbornTotalBilirubin'] },
    { label: 'Direct (conjugated) bilirubin', keys: ['newbornDirectBilirubin'] },
    { label: 'Transcutaneous bilirubin (TcB)', keys: ['transcutaneousBilirubin'] },
    { label: 'Day of life', keys: ['dayOfLife'], digits: 0 },
    { label: 'Weight (kg)', keys: ['weight'], digits: 2, imperial: { label: 'Weight (lbs)', unit: 'lbs' } },
  ],
  charts: [
    {
      title: 'Bilirubin',
      unit: 'mg/dL',
      hoursOfLife: true,
      lines: [
        { name: 'Blood', key: 'newbornTotalBilirubin' },
        { name: 'TcB', key: 'transcutaneousBilirubin' },
      ],
    },
  ],
};

const panel = (group: string, rows: [string, string][]): FlowsheetRow[] =>
  rows.map(([label, key]) => ({ label, keys: [key], group }));

// Rows in the requirements' order: panels, then the standalone tests under "Other tests", from most to least ordered.
// Rows without a result for the patient are hidden, panel headings with them.
const labResults: FlowsheetDefinition = {
  id: 'labResults',
  title: 'Lab results',
  hideEmptyRows: true,
  rows: [
    ...panel('CBC', [
      ['Hemoglobin', 'hemoglobin'],
      ['Hematocrit', 'hematocrit'],
      ['MCV', 'mcv'],
      ['MCH', 'mch'],
      ['MCHC', 'mchc'],
      ['RDW', 'rdw'],
      ['RBC', 'rbc'],
      ['WBC', 'wbc'],
      ['Platelets', 'platelets'],
      ['Neutrophils (%)', 'neutrophilsPercent'],
      ['Lymphocytes (%)', 'lymphocytesPercent'],
      ['Monocytes (%)', 'monocytesPercent'],
      ['Eosinophils (%)', 'eosinophilsPercent'],
      ['Basophils (%)', 'basophilsPercent'],
      ['Neutrophils (absolute)', 'neutrophilsAbsolute'],
      ['Lymphocytes (absolute)', 'lymphocytesAbsolute'],
      ['Monocytes (absolute)', 'monocytesAbsolute'],
      ['Eosinophils (absolute)', 'eosinophilsAbsolute'],
      ['Basophils (absolute)', 'basophilsAbsolute'],
    ]),
    ...panel('CMP/BMP', [
      ['Glucose', 'glucose'],
      ['BUN', 'bun'],
      ['Creatinine', 'creatinine'],
      ['eGFR', 'egfr'],
      ['BUN/Creatinine ratio', 'bunCreatinineRatio'],
      ['Sodium', 'sodium'],
      ['Potassium', 'potassium'],
      ['Chloride', 'chloride'],
      ['Bicarbonate (CO2)', 'bicarbonate'],
      ['Calcium', 'calcium'],
      ['Anion gap', 'anionGap'],
    ]),
    ...panel('CMP', [
      ['Total protein', 'totalProtein'],
      ['Albumin', 'albumin'],
      ['Globulin', 'globulin'],
      ['Albumin/Globulin ratio', 'albuminGlobulinRatio'],
      ['Total bilirubin', 'totalBilirubin'],
      ['Alkaline phosphatase', 'alkalinePhosphatase'],
      ['AST', 'ast'],
      ['ALT', 'alt'],
    ]),
    ...panel('Lipid panel', [
      ['Total cholesterol', 'totalCholesterol'],
      ['LDL cholesterol', 'ldlCholesterol'],
      ['HDL cholesterol', 'hdlCholesterol'],
      ['Triglycerides', 'triglycerides'],
      ['Non-HDL cholesterol', 'nonHdlCholesterol'],
    ]),
    ...panel('Thyroid', [
      ['TSH', 'tsh'],
      ['Free T4', 'freeT4'],
      ['Total T4', 'totalT4'],
      ['Free T3', 'freeT3'],
      ['Total T3', 'totalT3'],
      ['TPO antibodies', 'tpoAntibodies'],
      ['Thyroglobulin', 'thyroglobulin'],
      ['Thyroglobulin antibodies', 'thyroglobulinAntibodies'],
    ]),
    ...panel('Iron panel', [
      ['Iron', 'iron'],
      ['TIBC', 'tibc'],
      ['Transferrin saturation', 'transferrinSaturation'],
      ['Ferritin', 'ferritin'],
    ]),
    ...panel('Coagulation', [
      ['PT', 'pt'],
      ['INR', 'inr'],
    ]),
    ...panel('Hepatitis', [
      ['Hepatitis B surface antigen', 'hepatitisBSurfaceAntigen'],
      ['Hepatitis B surface antibody', 'hepatitisBSurfaceAntibody'],
      ['Hepatitis B core antibody (total)', 'hepatitisBCoreAntibody'],
      ['Hepatitis C antibody', 'hepatitisCAntibody'],
      ['Hepatitis C RNA', 'hepatitisCRna'],
    ]),
    ...panel('HIV and STI', [
      ['HIV Ag/Ab', 'hivAgAb'],
      ['HIV-1 RNA', 'hiv1Rna'],
      ['Chlamydia', 'chlamydia'],
      ['Gonorrhea', 'gonorrhea'],
      ['Trichomonas', 'trichomonas'],
      ['Syphilis RPR', 'syphilisRpr'],
      ['Syphilis treponemal antibody', 'syphilisTreponemalAntibody'],
      ['HPV (high risk)', 'hpvHighRisk'],
      ['HPV 16', 'hpv16'],
      ['HPV 18', 'hpv18'],
      ['HPV 16/18', 'hpv16And18'],
    ]),
    ...panel('Urinalysis', [
      ['Color', 'uaColor'],
      ['Appearance', 'uaAppearance'],
      ['Specific gravity', 'uaSpecificGravity'],
      ['pH', 'uaPh'],
      ['Protein', 'uaProtein'],
      ['Glucose', 'uaGlucose'],
      ['Ketones', 'uaKetones'],
      ['Bilirubin', 'uaBilirubin'],
      ['Blood', 'uaBlood'],
      ['Nitrite', 'uaNitrite'],
      ['Leukocyte esterase', 'uaLeukocyteEsterase'],
      ['Urobilinogen', 'uaUrobilinogen'],
    ]),
    ...panel('Other tests', [
      ['HbA1c', 'hba1c'],
      ['Glucose (fingerstick)', 'fingerstickGlucose'],
      ['Vitamin D, 25-hydroxy', 'vitaminD'],
      ['Vitamin B12', 'vitaminB12'],
      ['Urine albumin/creatinine ratio', 'urineAlbuminCreatinineRatio'],
      ['Cystatin C', 'cystatinC'],
      ['PSA', 'psa'],
      ['Magnesium', 'magnesium'],
      ['CRP', 'crp'],
      ['hs-CRP', 'hsCrp'],
      ['Lipoprotein(a)', 'lipoproteinA'],
      ['ApoB', 'apoB'],
      ['Urine culture', 'urineCulture'],
      ['ESR', 'esr'],
      ['Uric acid', 'uricAcid'],
      ['Folate', 'folate'],
      ['Testosterone, total', 'testosterone'],
      ['Urine pregnancy (hCG)', 'urineHcg'],
      ['hCG, quantitative', 'serumHcg'],
      ['PTH', 'pth'],
      ['Phosphorus', 'phosphorus'],
      ['Direct bilirubin', 'directBilirubin'],
      ['Lead', 'lead'],
      ['TB blood test (IGRA)', 'igra'],
      ['FIT', 'fit'],
      ['NT-proBNP', 'ntProBnp'],
      ['BNP', 'bnp'],
      ['CK', 'ck'],
      ['tTG-IgA', 'ttgIga'],
    ]),
  ],
  charts: [
    { title: 'HbA1c', unit: '%', lines: [{ name: 'HbA1c', key: 'hba1c' }] },
    { title: 'Creatinine', unit: 'mg/dL', lines: [{ name: 'Creatinine', key: 'creatinine' }] },
    { title: 'eGFR', unit: 'mL/min/1.73m²', lines: [{ name: 'eGFR', key: 'egfr' }] },
    {
      title: 'Urine albumin/creatinine ratio',
      unit: 'mg/g',
      lines: [{ name: 'Urine albumin/creatinine ratio', key: 'urineAlbuminCreatinineRatio' }],
    },
    { title: 'LDL cholesterol', unit: 'mg/dL', lines: [{ name: 'LDL cholesterol', key: 'ldlCholesterol' }] },
    { title: 'Hemoglobin', unit: 'g/dL', lines: [{ name: 'Hemoglobin', key: 'hemoglobin' }] },
  ],
};

/** Every flowsheet the EHR offers, in side-list (alphabetical) order. */
export const FLOWSHEETS: FlowsheetDefinition[] = [growth, labResults, newbornBilirubin, thyroid, vitals].sort((a, b) =>
  a.title.localeCompare(b.title)
);
