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

/** Every flowsheet the EHR offers, in side-list (alphabetical) order. */
export const FLOWSHEETS: FlowsheetDefinition[] = [thyroid, vitals].sort((a, b) => a.title.localeCompare(b.title));
