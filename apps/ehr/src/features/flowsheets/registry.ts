import { FlowsheetId } from 'utils/lib/types/api/flowsheets.types';

export interface FlowsheetRow {
  label: string;
  /** Measure keys of the get-flowsheet response shown in this row, joined with "/" (e.g. systolic/diastolic). */
  keys: string[];
  /** Decimal places for numeric values; text values (e.g. medication names) and unrounded numbers omit it. */
  digits?: number;
}

export interface FlowsheetChart {
  title: string;
  unit: string;
  lines: { name: string; key: string }[];
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
// visit's weight and height. Percentile rows are text ("88th", "<1st", "implausible") computed by the server. The
// growth chart cards (GrowthCharts.tsx) take the place of trend charts, from the server's growth data.
const growth: FlowsheetDefinition = {
  id: 'growth',
  title: 'Growth',
  rows: [
    { label: 'Age', keys: ['age'] },
    { label: 'Weight (kg)', keys: ['weight'], digits: 2 },
    { label: 'Weight percentile', keys: ['weightPercentile'] },
    { label: 'Height / length (cm)', keys: ['height'], digits: 1 },
    { label: 'Height / length percentile', keys: ['heightPercentile'] },
    { label: 'BMI (kg/m²)', keys: ['bmi'], digits: 1 },
    { label: 'BMI percentile', keys: ['bmiPercentile'] },
    { label: 'Weight-for-length percentile', keys: ['weightForLengthPercentile'] },
    { label: 'Head circumference (cm)', keys: ['headCircumference'], digits: 1 },
    { label: 'Head circumference percentile', keys: ['headCircumferencePercentile'] },
  ],
  charts: [],
};

/** Every flowsheet the EHR offers, in side-list (alphabetical) order. */
export const FLOWSHEETS: FlowsheetDefinition[] = [vitals, growth].sort((a, b) => a.title.localeCompare(b.title));
