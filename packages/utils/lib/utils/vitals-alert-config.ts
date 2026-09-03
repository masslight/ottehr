import { z } from 'zod';
import { VitalsAge } from '../config-helpers/vitals';
import { VitalsDef, VitalsSchema } from '../helpers/vitals/config-schema';
import { VitalAlertCriticality } from '../types/api/chart-data/chart-data.constants';
import {
  VITAL_ALERT_TYPES,
  VITAL_ALERT_UNITS,
  VitalAlertAgeRange,
  VitalAlertLevels,
  VitalAlertType,
  VitalsAlertConfig,
  VitalsAlertConfigSchema,
} from '../types/api/vitals-alert-config/vitals-alert-config.types';

export const VITALS_ALERT_CONFIG_BASIC_TAG = {
  system: 'vitals-alert-config',
  code: 'vitals-alert-config',
};

export const VITALS_ALERT_CONFIG_JSON_EXTENSION_URL = 'https://fhir.ottehr.com/Extension/vitals-alert-config-json';

/**
 * Mirrors the bands in `ottehr-config/vitals`. Vitals defined there over coarser bands repeat their
 * values across the finer ranges here.
 */
export const DEFAULT_VITAL_ALERT_AGE_RANGES: VitalAlertAgeRange[] = [
  { id: '0-3mo', minAge: { unit: 'months', value: 0 }, maxAge: { unit: 'months', value: 3 } },
  { id: '3-6mo', minAge: { unit: 'months', value: 3 }, maxAge: { unit: 'months', value: 6 } },
  { id: '6-9mo', minAge: { unit: 'months', value: 6 }, maxAge: { unit: 'months', value: 9 } },
  { id: '9-12mo', minAge: { unit: 'months', value: 9 }, maxAge: { unit: 'months', value: 12 } },
  { id: '12-18mo', minAge: { unit: 'months', value: 12 }, maxAge: { unit: 'months', value: 18 } },
  { id: '18-24mo', minAge: { unit: 'months', value: 18 }, maxAge: { unit: 'months', value: 24 } },
  { id: '2-3y', minAge: { unit: 'years', value: 2 }, maxAge: { unit: 'years', value: 3 } },
  { id: '3-4y', minAge: { unit: 'years', value: 3 }, maxAge: { unit: 'years', value: 4 } },
  { id: '4-6y', minAge: { unit: 'years', value: 4 }, maxAge: { unit: 'years', value: 6 } },
  { id: '6-8y', minAge: { unit: 'years', value: 6 }, maxAge: { unit: 'years', value: 8 } },
  { id: '8-12y', minAge: { unit: 'years', value: 8 }, maxAge: { unit: 'years', value: 12 } },
  { id: '12-15y', minAge: { unit: 'years', value: 12 }, maxAge: { unit: 'years', value: 15 } },
  { id: '15-18y', minAge: { unit: 'years', value: 15 }, maxAge: { unit: 'years', value: 18 } },
  { id: '18+y', minAge: { unit: 'years', value: 18 } },
];

export const DEFAULT_VITALS_ALERT_CONFIG: VitalsAlertConfig = {
  ageRanges: DEFAULT_VITAL_ALERT_AGE_RANGES,
  thresholds: {
    'vital-weight': {
      '0-3mo': { criticalLow: 2.4, abnormalLow: 2.8, abnormalHigh: 7.1, criticalHigh: 7.9 },
      '3-6mo': { criticalLow: 4.8, abnormalLow: 5.5, abnormalHigh: 9.6, criticalHigh: 10.5 },
      '6-9mo': { criticalLow: 5.9, abnormalLow: 6.7, abnormalHigh: 11, criticalHigh: 12 },
      '9-12mo': { criticalLow: 6.6, abnormalLow: 7.5, abnormalHigh: 12.3, criticalHigh: 13.5 },
      '12-18mo': { criticalLow: 7.1, abnormalLow: 7.9, abnormalHigh: 14.2, criticalHigh: 15.6 },
      '18-24mo': { criticalLow: 7.9, abnormalLow: 8.8, abnormalHigh: 15.4, criticalHigh: 17 },
      '2-3y': { criticalLow: 9.6, abnormalLow: 10.8, abnormalHigh: 18, criticalHigh: 20 },
      '3-4y': { criticalLow: 10.1, abnormalLow: 11.4, abnormalHigh: 21.5, criticalHigh: 24 },
      '4-6y': { criticalLow: 11.6, abnormalLow: 13.2, abnormalHigh: 27.5, criticalHigh: 31.5 },
      '6-8y': { criticalLow: 13.8, abnormalLow: 15.8, abnormalHigh: 37, criticalHigh: 43 },
      '8-12y': { criticalLow: 17, abnormalLow: 19.5, abnormalHigh: 58, criticalHigh: 68 },
      '12-15y': { criticalLow: 22.5, abnormalLow: 26.5, abnormalHigh: 80, criticalHigh: 93 },
      '15-18y': { criticalLow: 32, abnormalLow: 37.5, abnormalHigh: 91, criticalHigh: 105 },
      '18+y': { criticalLow: 39, abnormalLow: 45, abnormalHigh: 93, criticalHigh: 108 },
    },
    'vital-height': {
      '0-3mo': { criticalLow: 40, abnormalLow: 45, abnormalHigh: 64, criticalHigh: 66 },
      '3-6mo': { criticalLow: 52, abnormalLow: 56.4, abnormalHigh: 70.8, criticalHigh: 74 },
      '6-9mo': { criticalLow: 56, abnormalLow: 61.8, abnormalHigh: 75.8, criticalHigh: 79 },
      '9-12mo': { criticalLow: 61, abnormalLow: 66, abnormalHigh: 80, criticalHigh: 83 },
      '12-18mo': { criticalLow: 64, abnormalLow: 69.5, abnormalHigh: 86.9, criticalHigh: 89 },
      '18-24mo': { criticalLow: 69, abnormalLow: 75.4, abnormalHigh: 92.6, criticalHigh: 95 },
      '2-3y': { criticalLow: 74, abnormalLow: 79.3, abnormalHigh: 100.6, criticalHigh: 105 },
      '3-4y': { criticalLow: 80, abnormalLow: 87.8, abnormalHigh: 108.3, criticalHigh: 113 },
      '4-6y': { criticalLow: 87, abnormalLow: 94, abnormalHigh: 123.3, criticalHigh: 127 },
      '6-8y': { criticalLow: 98, abnormalLow: 106.9, abnormalHigh: 130.4, criticalHigh: 143 },
      '8-12y': { criticalLow: 108, abnormalLow: 118.5, abnormalHigh: 155.1, criticalHigh: 163 },
      '12-15y': { criticalLow: 118, abnormalLow: 125, abnormalHigh: 176.5, criticalHigh: 182 },
      '15-18y': { criticalLow: 122, abnormalLow: 130, abnormalHigh: 187.8, criticalHigh: 195 },
      '18+y': { criticalLow: 122, abnormalLow: 152.5, abnormalHigh: 188, criticalHigh: 206 },
    },
    'vital-temperature': {
      '0-3mo': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 39 },
      '3-6mo': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 39 },
      '6-9mo': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 39 },
      '9-12mo': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 39 },
      '12-18mo': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 39 },
      '18-24mo': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 39 },
      '2-3y': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 41 },
      '3-4y': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 41 },
      '4-6y': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 41 },
      '6-8y': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 41 },
      '8-12y': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 41 },
      '12-15y': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 41 },
      '15-18y': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 41 },
      '18+y': { criticalLow: 35, abnormalLow: 36, abnormalHigh: 38, criticalHigh: 41 },
    },
    'vital-heartbeat': {
      '0-3mo': { criticalLow: 107, abnormalLow: 113, abnormalHigh: 171, criticalHigh: 181 },
      '3-6mo': { criticalLow: 104, abnormalLow: 108, abnormalHigh: 167, criticalHigh: 175 },
      '6-9mo': { criticalLow: 98, abnormalLow: 104, abnormalHigh: 160, criticalHigh: 168 },
      '9-12mo': { criticalLow: 93, abnormalLow: 101, abnormalHigh: 150, criticalHigh: 161 },
      '12-18mo': { criticalLow: 88, abnormalLow: 97, abnormalHigh: 148, criticalHigh: 156 },
      '18-24mo': { criticalLow: 82, abnormalLow: 92, abnormalHigh: 142, criticalHigh: 149 },
      '2-3y': { criticalLow: 76, abnormalLow: 87, abnormalHigh: 135, criticalHigh: 142 },
      '3-4y': { criticalLow: 70, abnormalLow: 82, abnormalHigh: 130, criticalHigh: 136 },
      '4-6y': { criticalLow: 65, abnormalLow: 77, abnormalHigh: 124, criticalHigh: 131 },
      '6-8y': { criticalLow: 59, abnormalLow: 71, abnormalHigh: 117, criticalHigh: 123 },
      '8-12y': { criticalLow: 52, abnormalLow: 66, abnormalHigh: 109, criticalHigh: 115 },
      '12-15y': { criticalLow: 47, abnormalLow: 61, abnormalHigh: 102, criticalHigh: 108 },
      '15-18y': { criticalLow: 43, abnormalLow: 57, abnormalHigh: 100, criticalHigh: 115 },
      '18+y': { criticalLow: 40, abnormalLow: 57, abnormalHigh: 100, criticalHigh: 115 },
    },
    'vital-respiration-rate': {
      '0-3mo': { criticalLow: 25, abnormalLow: 30, abnormalHigh: 60, criticalHigh: 66 },
      '3-6mo': { criticalLow: 24, abnormalLow: 28, abnormalHigh: 52, criticalHigh: 64 },
      '6-9mo': { criticalLow: 23, abnormalLow: 26, abnormalHigh: 49, criticalHigh: 61 },
      '9-12mo': { criticalLow: 22, abnormalLow: 24, abnormalHigh: 46, criticalHigh: 58 },
      '12-18mo': { criticalLow: 21, abnormalLow: 23, abnormalHigh: 43, criticalHigh: 53 },
      '18-24mo': { criticalLow: 19, abnormalLow: 21, abnormalHigh: 40, criticalHigh: 46 },
      '2-3y': { criticalLow: 18, abnormalLow: 20, abnormalHigh: 36, criticalHigh: 38 },
      '3-4y': { criticalLow: 17, abnormalLow: 19, abnormalHigh: 31, criticalHigh: 33 },
      '4-6y': { criticalLow: 17, abnormalLow: 18, abnormalHigh: 28, criticalHigh: 29 },
      '6-8y': { criticalLow: 16, abnormalLow: 17, abnormalHigh: 25, criticalHigh: 27 },
      '8-12y': { criticalLow: 14, abnormalLow: 16, abnormalHigh: 23, criticalHigh: 25 },
      '12-15y': { criticalLow: 12, abnormalLow: 15, abnormalHigh: 22, criticalHigh: 25 },
      '15-18y': { criticalLow: 11, abnormalLow: 14, abnormalHigh: 21, criticalHigh: 25 },
      '18+y': { criticalLow: 8, abnormalLow: 11, abnormalHigh: 21, criticalHigh: 25 },
    },
    'vital-blood-pressure': {
      '0-3mo': { criticalLow: 55, abnormalLow: 60, abnormalHigh: 105, criticalHigh: 115 },
      '3-6mo': { criticalLow: 60, abnormalLow: 65, abnormalHigh: 110, criticalHigh: 120 },
      '6-9mo': { criticalLow: 65, abnormalLow: 70, abnormalHigh: 115, criticalHigh: 120 },
      '9-12mo': { criticalLow: 68, abnormalLow: 73, abnormalHigh: 118, criticalHigh: 130 },
      '12-18mo': { criticalLow: 70, abnormalLow: 75, abnormalHigh: 120, criticalHigh: 130 },
      '18-24mo': { criticalLow: 72, abnormalLow: 77, abnormalHigh: 122, criticalHigh: 130 },
      '2-3y': { criticalLow: 74, abnormalLow: 79, abnormalHigh: 124, criticalHigh: 140 },
      '3-4y': { criticalLow: 76, abnormalLow: 81, abnormalHigh: 126, criticalHigh: 140 },
      '4-6y': { criticalLow: 78, abnormalLow: 83, abnormalHigh: 128, criticalHigh: 140 },
      '6-8y': { criticalLow: 82, abnormalLow: 87, abnormalHigh: 130, criticalHigh: 150 },
      '8-12y': { criticalLow: 86, abnormalLow: 91, abnormalHigh: 130, criticalHigh: 150 },
      '12-15y': { criticalLow: 90, abnormalLow: 97, abnormalHigh: 130, criticalHigh: 160 },
      '15-18y': { criticalLow: 90, abnormalLow: 100, abnormalHigh: 130, criticalHigh: 180 },
      '18+y': { criticalLow: 90, abnormalLow: 100, abnormalHigh: 130, criticalHigh: 180 },
    },
    'vital-oxygen-sat': {
      '0-3mo': { criticalLow: 88, abnormalLow: 91, abnormalHigh: 101 },
      '3-6mo': { criticalLow: 88, abnormalLow: 91, abnormalHigh: 101 },
      '6-9mo': { criticalLow: 88, abnormalLow: 91, abnormalHigh: 101 },
      '9-12mo': { criticalLow: 88, abnormalLow: 91, abnormalHigh: 101 },
      '12-18mo': { criticalLow: 89, abnormalLow: 92, abnormalHigh: 101 },
      '18-24mo': { criticalLow: 89, abnormalLow: 92, abnormalHigh: 101 },
      '2-3y': { criticalLow: 89, abnormalLow: 92, abnormalHigh: 101 },
      '3-4y': { criticalLow: 89, abnormalLow: 92, abnormalHigh: 101 },
      '4-6y': { criticalLow: 89, abnormalLow: 92, abnormalHigh: 101 },
      '6-8y': { criticalLow: 89, abnormalLow: 92, abnormalHigh: 101 },
      '8-12y': { criticalLow: 89, abnormalLow: 92, abnormalHigh: 101 },
      '12-15y': { criticalLow: 89, abnormalLow: 92, abnormalHigh: 101 },
      '15-18y': { criticalLow: 89, abnormalLow: 92, abnormalHigh: 101 },
      '18+y': { criticalLow: 90, abnormalLow: 95, abnormalHigh: 101 },
    },
  },
};

const levelsToRules = (levels: VitalAlertLevels, units: string): Record<string, unknown>[] => {
  const rules: Record<string, unknown>[] = [];
  if (levels.criticalLow !== undefined) {
    rules.push({ type: 'min', units, value: levels.criticalLow, criticality: VitalAlertCriticality.Critical });
  }
  if (levels.abnormalLow !== undefined) {
    rules.push({ type: 'min', units, value: levels.abnormalLow, criticality: VitalAlertCriticality.Abnormal });
  }
  if (levels.abnormalHigh !== undefined) {
    rules.push({ type: 'max', units, value: levels.abnormalHigh, criticality: VitalAlertCriticality.Abnormal });
  }
  if (levels.criticalHigh !== undefined) {
    rules.push({ type: 'max', units, value: levels.criticalHigh, criticality: VitalAlertCriticality.Critical });
  }
  return rules;
};

const alertThresholdsForVital = (config: VitalsAlertConfig, vital: VitalAlertType): Record<string, unknown>[] => {
  const units = VITAL_ALERT_UNITS[vital];
  return config.ageRanges.flatMap((range) => {
    const rules = levelsToRules(config.thresholds[vital]?.[range.id] ?? {}, units);
    if (rules.length === 0) return [];
    return [
      {
        rules,
        minAge: range.minAge,
        ...(range.maxAge ? { maxAge: range.maxAge } : {}),
      },
    ];
  });
};

/**
 * Adapts the admin config to the engine's shape, parsing it through `VitalsDef` so the engine's own
 * validation applies.
 */
export const vitalsAlertConfigToVitalsDef = (config: VitalsAlertConfig): VitalsSchema => {
  const built: Record<string, unknown> = {
    // Not admin-configurable.
    'vital-weight': {
      unit: VitalsDef()['vital-weight'].unit,
      alertThresholds: alertThresholdsForVital(config, 'vital-weight'),
    },
    'vital-height': { alertThresholds: alertThresholdsForVital(config, 'vital-height') },
    'vital-temperature': { alertThresholds: alertThresholdsForVital(config, 'vital-temperature') },
    'vital-heartbeat': { alertThresholds: alertThresholdsForVital(config, 'vital-heartbeat') },
    'vital-respiration-rate': { alertThresholds: alertThresholdsForVital(config, 'vital-respiration-rate') },
    // The schema allows blood pressure to declare components only.
    'vital-blood-pressure': {
      components: {
        'systolic-pressure': { alertThresholds: alertThresholdsForVital(config, 'vital-blood-pressure') },
      },
    },
    'vital-oxygen-sat': { alertThresholds: alertThresholdsForVital(config, 'vital-oxygen-sat') },
  };
  return VitalsDef(built);
};

/**
 * Whether the engine will accept the config once adapted, returning a message if not. The engine
 * compares age boundaries in 30-day months and 365-day years, so it rejects some boundary pairs this
 * module's month comparison accepts.
 */
export const getVitalsAlertConfigEngineError = (config: VitalsAlertConfig): string | undefined => {
  try {
    vitalsAlertConfigToVitalsDef(config);
    return undefined;
  } catch (error) {
    const issues = error instanceof z.ZodError ? error.issues : undefined;
    const detail = issues?.map((issue) => issue.message).join('; ') ?? (error as Error).message;
    return `These alert thresholds cannot be applied: ${detail}. Try expressing the age range boundaries in the same unit.`;
  }
};

/** Parses a stored config, falling back to the defaults when absent or invalid. */
export const parseVitalsAlertConfigOrDefault = (raw: string | undefined): VitalsAlertConfig => {
  if (!raw) return DEFAULT_VITALS_ALERT_CONFIG;
  try {
    const parsed = VitalsAlertConfigSchema.safeParse(JSON.parse(raw));
    if (parsed.success) {
      const engineError = getVitalsAlertConfigEngineError(parsed.data);
      if (engineError) {
        console.error(
          'Stored vitals alert config is not loadable by the engine; falling back to defaults',
          engineError
        );
        return DEFAULT_VITALS_ALERT_CONFIG;
      }
      return parsed.data;
    }
    console.error('Stored vitals alert config failed validation; falling back to defaults', parsed.error.issues);
  } catch (error) {
    console.error('Stored vitals alert config is not valid JSON; falling back to defaults', error);
  }
  return DEFAULT_VITALS_ALERT_CONFIG;
};

export const emptyThresholdsForAgeRange = (): Record<VitalAlertType, VitalAlertLevels> =>
  Object.fromEntries(VITAL_ALERT_TYPES.map((vital) => [vital, {}])) as Record<VitalAlertType, VitalAlertLevels>;

const AGE_UNIT_ABBREVIATIONS: Record<VitalsAge['unit'], string> = {
  years: 'yr',
  months: 'mo',
  days: 'd',
};

/** Formats a range as "0-3 mo", "2-3 yr" or "18 yr and older". */
export const formatVitalAlertAgeRange = (range: VitalAlertAgeRange): string => {
  const minUnit = AGE_UNIT_ABBREVIATIONS[range.minAge.unit];
  if (!range.maxAge) {
    return `${range.minAge.value} ${minUnit} and older`;
  }
  const maxUnit = AGE_UNIT_ABBREVIATIONS[range.maxAge.unit];
  if (minUnit === maxUnit) {
    return `${range.minAge.value}-${range.maxAge.value} ${minUnit}`;
  }
  return `${range.minAge.value} ${minUnit} - ${range.maxAge.value} ${maxUnit}`;
};

/** Ids must be usable as react-hook-form field path segments, so no dots or brackets. */
export const makeVitalAlertAgeRangeId = (): string =>
  `range-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
