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
}

export interface FlowsheetChart {
  title: string;
  unit: string;
  lines: { name: string; key: string }[];
  /** Plot against hours of life (0–336 h) when the visits carry them (time of birth recorded), else against time. */
  hoursOfLife?: boolean;
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
    { label: 'Temperature (°C)', keys: ['temperature'], digits: 1 },
    { label: 'Heart rate (bpm)', keys: ['heartRate'], digits: 0 },
    { label: 'Respiratory rate (/min)', keys: ['respirationRate'], digits: 0 },
    { label: 'SpO₂ (%)', keys: ['oxygenSaturation'], digits: 0 },
    { label: 'Blood pressure (mmHg)', keys: ['systolic', 'diastolic'], digits: 0 },
    { label: 'Weight (kg)', keys: ['weight'], digits: 2 },
    { label: 'Height (cm)', keys: ['height'], digits: 1 },
    { label: 'Head circumference (cm)', keys: ['headCircumference'], digits: 1 },
    { label: 'BMI (kg/m²)', keys: ['bmi'], digits: 1 },
  ],
  charts: [
    { title: 'Heart rate', unit: 'bpm', lines: [{ name: 'Heart rate', key: 'heartRate' }] },
    { title: 'SpO₂', unit: '%', lines: [{ name: 'SpO₂', key: 'oxygenSaturation' }] },
    { title: 'Temperature', unit: '°C', lines: [{ name: 'Temperature', key: 'temperature' }] },
    { title: 'Weight', unit: 'kg', lines: [{ name: 'Weight', key: 'weight' }] },
    {
      title: 'Blood pressure',
      unit: 'mmHg',
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
    { label: 'Total T4', keys: ['totalT4'] },
    { label: 'Free T3', keys: ['freeT3'] },
    { label: 'Total T3', keys: ['totalT3'] },
    { label: 'TPO antibodies', keys: ['tpoAntibodies'] },
    { label: 'Thyroid medication', keys: ['thyroidMedication'] },
    { label: 'Thyroid diagnosis this visit', keys: ['thyroidDiagnosis'] },
    { label: 'Weight (kg)', keys: ['weight'], digits: 2 },
    { label: 'Heart rate (bpm)', keys: ['heartRate'], digits: 0 },
  ],
  charts: [
    { title: 'TSH', unit: 'mIU/L', lines: [{ name: 'TSH', key: 'tsh' }] },
    { title: 'Free T4', unit: 'ng/dL', lines: [{ name: 'Free T4', key: 'freeT4' }] },
    { title: 'Weight', unit: 'kg', lines: [{ name: 'Weight', key: 'weight' }] },
    { title: 'Heart rate', unit: 'bpm', lines: [{ name: 'Heart rate', key: 'heartRate' }] },
  ],
};

const newbornBilirubin: FlowsheetDefinition = {
  id: 'newbornBilirubin',
  title: 'Newborn bilirubin',
  rows: [
    { label: 'Total serum bilirubin', keys: ['newbornTotalBilirubin'] },
    { label: 'Direct (conjugated) bilirubin', keys: ['newbornDirectBilirubin'] },
    { label: 'Transcutaneous bilirubin', keys: ['transcutaneousBilirubin'] },
    { label: 'Day of life', keys: ['dayOfLife'], digits: 0 },
    { label: 'Weight (kg)', keys: ['weight'], digits: 2 },
  ],
  charts: [
    {
      title: 'Bilirubin',
      unit: 'mg/dL',
      hoursOfLife: true,
      lines: [
        { name: 'Total serum', key: 'newbornTotalBilirubin' },
        { name: 'Transcutaneous', key: 'transcutaneousBilirubin' },
      ],
    },
  ],
};

const panel = (group: string, rows: [string, string][]): FlowsheetRow[] =>
  rows.map(([label, key]) => ({ label, keys: [key], group }));

// Rows in the requirements' order: panels, then standalone tests from most to least ordered. Rows without a result
// for the patient are hidden, panel headings with them.
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
    ]),
    ...panel('Iron panel', [
      ['Iron', 'iron'],
      ['TIBC', 'tibc'],
      ['Transferrin saturation', 'transferrinSaturation'],
      ['Ferritin', 'ferritin'],
    ]),
    { label: 'HbA1c', keys: ['hba1c'] },
    { label: 'Vitamin D, 25-hydroxy', keys: ['vitaminD'] },
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
    { label: 'Vitamin B12', keys: ['vitaminB12'] },
    { label: 'Urine albumin/creatinine ratio', keys: ['urineAlbuminCreatinineRatio'] },
    { label: 'PSA', keys: ['psa'] },
    { label: 'Magnesium', keys: ['magnesium'] },
    { label: 'CRP', keys: ['crp'] },
    { label: 'hs-CRP', keys: ['hsCrp'] },
    { label: 'Urine culture', keys: ['urineCulture'] },
    { label: 'HIV Ag/Ab', keys: ['hivAgAb'] },
    { label: 'Hepatitis C antibody', keys: ['hepatitisCAntibody'] },
    { label: 'ESR', keys: ['esr'] },
    { label: 'Uric acid', keys: ['uricAcid'] },
    { label: 'Folate', keys: ['folate'] },
    { label: 'Testosterone, total', keys: ['testosterone'] },
    { label: 'Urine pregnancy (hCG)', keys: ['urineHcg'] },
    { label: 'PTH', keys: ['pth'] },
    { label: 'Phosphorus', keys: ['phosphorus'] },
  ],
  charts: [
    { title: 'HbA1c', unit: '%', lines: [{ name: 'HbA1c', key: 'hba1c' }] },
    { title: 'Creatinine', unit: 'mg/dL', lines: [{ name: 'Creatinine', key: 'creatinine' }] },
    { title: 'eGFR', unit: 'mL/min/1.73m²', lines: [{ name: 'eGFR', key: 'egfr' }] },
    { title: 'LDL cholesterol', unit: 'mg/dL', lines: [{ name: 'LDL cholesterol', key: 'ldlCholesterol' }] },
    { title: 'Hemoglobin', unit: 'g/dL', lines: [{ name: 'Hemoglobin', key: 'hemoglobin' }] },
  ],
};

/** Every flowsheet the EHR offers, in side-list (alphabetical) order. */
export const FLOWSHEETS: FlowsheetDefinition[] = [growth, labResults, newbornBilirubin, thyroid, vitals].sort((a, b) =>
  a.title.localeCompare(b.title)
);
