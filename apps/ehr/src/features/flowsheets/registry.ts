import { FlowsheetId } from 'utils/lib/types/api/flowsheets.types';

export interface FlowsheetRow {
  label: string;
  /** Measure keys of the get-flowsheet response shown in this row, joined with "/" (e.g. systolic/diastolic). */
  keys: string[];
  /** Decimal places for numeric values; text values (e.g. medication names) and unrounded numbers omit it. */
  digits?: number;
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
    { label: 'Weight (kg)', keys: ['weight'], digits: 1 },
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
    { label: 'Weight (kg)', keys: ['weight'], digits: 1 },
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

/** Every flowsheet the EHR offers, in side-list (alphabetical) order. */
export const FLOWSHEETS: FlowsheetDefinition[] = [growth, newbornBilirubin, thyroid, vitals].sort((a, b) =>
  a.title.localeCompare(b.title)
);
