import { BMI_DISPLAY_PRECISION } from 'utils/lib/helpers/vitals/vitals-bmi.helper';
import {
  HEIGHT_CM_DISPLAY_PRECISION,
  HEIGHT_INCHES_DISPLAY_PRECISION,
  HeightMeasurement,
} from 'utils/lib/helpers/vitals/vitals-height.helper';
import { celsiusToFahrenheit } from 'utils/lib/helpers/vitals/vitals-temperature.helper';
import { kgToLbs, WEIGHT_DISPLAY_PRECISION } from 'utils/lib/helpers/vitals/vitals-weight.helper';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { FlowsheetId, FlowsheetMeasureKey, FlowsheetVitalField } from 'utils/lib/types/api/flowsheets.types';

export interface FlowsheetUnit {
  label: string;
  digits: number;
  hoverLabel?: string;
  fromMetric?: (value: number) => number;
}

export interface FlowsheetMeasure {
  key: FlowsheetMeasureKey;
  title: string;
  metric: FlowsheetUnit;
  imperial?: FlowsheetUnit;
}

export type FlowsheetChartRange =
  | { kind: 'span'; span: number }
  | { kind: 'fixed'; min: number; max: number; step?: number }
  | { kind: 'aroundMedian'; fraction: number };

export interface FlowsheetChart extends FlowsheetMeasure {
  lines: string[];
  range: FlowsheetChartRange;
}

export interface FlowsheetDefinition {
  id: FlowsheetId;
  title: string;
  rows: FlowsheetMeasure[];
  charts: FlowsheetChart[];
}

const CM: FlowsheetUnit = { label: 'cm', digits: HEIGHT_CM_DISPLAY_PRECISION };
const INCHES: FlowsheetUnit = {
  label: 'in',
  digits: HEIGHT_INCHES_DISPLAY_PRECISION,
  fromMetric: (cm) => HeightMeasurement.fromCm(cm).getInches(),
};
const PER_MINUTE: FlowsheetUnit = { label: '/min', digits: 0 };

const measure = (
  key: FlowsheetVitalField,
  title: string,
  metric: FlowsheetUnit,
  imperial?: FlowsheetUnit
): FlowsheetMeasure => ({ key, title, metric, imperial });

const VITALS: Record<FlowsheetVitalField, FlowsheetMeasure> = {
  [VitalFieldNames.VitalTemperature]: measure(
    VitalFieldNames.VitalTemperature,
    'Temperature',
    { label: '°C', hoverLabel: 'C', digits: 1 },
    { label: '°F', hoverLabel: 'F', digits: 1, fromMetric: celsiusToFahrenheit }
  ),
  [VitalFieldNames.VitalHeartbeat]: measure(VitalFieldNames.VitalHeartbeat, 'Heart rate', PER_MINUTE),
  [VitalFieldNames.VitalRespirationRate]: measure(VitalFieldNames.VitalRespirationRate, 'Respiratory rate', PER_MINUTE),
  [VitalFieldNames.VitalOxygenSaturation]: measure(VitalFieldNames.VitalOxygenSaturation, 'SpO₂', {
    label: '%',
    digits: 0,
  }),
  [VitalFieldNames.VitalBloodPressure]: measure(VitalFieldNames.VitalBloodPressure, 'Blood pressure', {
    label: 'mm Hg',
    digits: 0,
  }),
  [VitalFieldNames.VitalWeight]: measure(
    VitalFieldNames.VitalWeight,
    'Weight',
    { label: 'kg', digits: WEIGHT_DISPLAY_PRECISION },
    { label: 'lbs', digits: WEIGHT_DISPLAY_PRECISION, fromMetric: kgToLbs }
  ),
  [VitalFieldNames.VitalHeight]: measure(VitalFieldNames.VitalHeight, 'Height', CM, INCHES),
  [VitalFieldNames.VitalHeadCircumference]: measure(
    VitalFieldNames.VitalHeadCircumference,
    'Head circumference',
    CM,
    INCHES
  ),
  [VitalFieldNames.VitalBMI]: measure(VitalFieldNames.VitalBMI, 'BMI', {
    label: 'kg/m²',
    digits: BMI_DISPLAY_PRECISION,
  }),
};

const AROUND_MEDIAN: FlowsheetChartRange = { kind: 'aroundMedian', fraction: 0.1 };

const chart = (key: FlowsheetVitalField, range: FlowsheetChartRange, lines?: string[]): FlowsheetChart => ({
  ...VITALS[key],
  range,
  lines: lines ?? [VITALS[key].title],
});

const vitals: FlowsheetDefinition = {
  id: 'vitals',
  title: 'Vitals',
  rows: [
    VITALS[VitalFieldNames.VitalTemperature],
    VITALS[VitalFieldNames.VitalHeartbeat],
    VITALS[VitalFieldNames.VitalRespirationRate],
    VITALS[VitalFieldNames.VitalOxygenSaturation],
    VITALS[VitalFieldNames.VitalBloodPressure],
    VITALS[VitalFieldNames.VitalWeight],
    VITALS[VitalFieldNames.VitalHeight],
    VITALS[VitalFieldNames.VitalHeadCircumference],
    VITALS[VitalFieldNames.VitalBMI],
  ],
  charts: [
    chart(VitalFieldNames.VitalHeartbeat, { kind: 'span', span: 40 }),
    chart(VitalFieldNames.VitalRespirationRate, { kind: 'span', span: 20 }),
    chart(VitalFieldNames.VitalOxygenSaturation, { kind: 'fixed', min: 85, max: 100, step: 5 }),
    chart(VitalFieldNames.VitalTemperature, { kind: 'fixed', min: 35, max: 40, step: 1 }),
    chart(VitalFieldNames.VitalWeight, AROUND_MEDIAN),
    chart(VitalFieldNames.VitalBMI, AROUND_MEDIAN),
    chart(VitalFieldNames.VitalBloodPressure, AROUND_MEDIAN, ['Systolic', 'Diastolic']),
  ],
};

export const FLOWSHEETS: FlowsheetDefinition[] = [vitals];
