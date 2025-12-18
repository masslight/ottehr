import * as z from 'zod';
import { VITALS_OVERRIDES } from '../../../ottehr-config-overrides';
import { VitalAlertCriticality, VitalBloodPressureComponents, VitalVisionComponents } from '../../types/api';
import {
  getHeightPercentileHigh,
  getHeightPercentileLow,
  getWeightPercentileHigh,
  getWeightPercentileLow,
} from './weightPercentiles';

const VitalsConfig = {
  'vital-temperature': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'celsius', value: 36.5 },
          { type: 'max', units: 'celsius', value: 38 },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 2 },
      },
      {
        rules: [
          { type: 'min', units: 'celsius', value: 36 },
          { type: 'max', units: 'celsius', value: 38 },
        ],
        minAge: { unit: 'months', value: 2 },
        maxAge: { unit: 'months', value: 144 },
      },
      {
        rules: [
          { type: 'min', units: 'celsius', value: 36 },
          { type: 'max', units: 'celsius', value: 38 },
        ],
        minAge: { unit: 'months', value: 144 },
      },
    ],
  },
  'vital-heartbeat': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'bpm', value: 100 },
          { type: 'max', units: 'bpm', value: 200 },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 2 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 80 },
          { type: 'max', units: 'bpm', value: 160 },
        ],
        minAge: { unit: 'months', value: 2 },
        maxAge: { unit: 'months', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 70 },
          { type: 'max', units: 'bpm', value: 150 },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'months', value: 36 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 60 },
          { type: 'max', units: 'bpm', value: 150 },
        ],
        minAge: { unit: 'months', value: 36 },
        maxAge: { unit: 'months', value: 72 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 60 },
          { type: 'max', units: 'bpm', value: 140 },
        ],
        minAge: { unit: 'months', value: 72 },
        maxAge: { unit: 'months', value: 108 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 60 },
          { type: 'max', units: 'bpm', value: 130 },
        ],
        minAge: { unit: 'months', value: 108 },
        maxAge: { unit: 'months', value: 144 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 60 },
          { type: 'max', units: 'bpm', value: 120 },
        ],
        minAge: { unit: 'months', value: 144 },
        maxAge: { unit: 'months', value: 180 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 57 },
          { type: 'max', units: 'bpm', value: 115 },
        ],
        minAge: { unit: 'months', value: 180 },
      },
    ],
  },
  'vital-respiration-rate': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: '', value: 30 },
          { type: 'max', units: '', value: 60 },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 20 },
          { type: 'max', units: '', value: 50 },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'months', value: 36 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 20 },
          { type: 'max', units: '', value: 40 },
        ],
        minAge: { unit: 'months', value: 36 },
        maxAge: { unit: 'months', value: 72 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 15 },
          { type: 'max', units: '', value: 40 },
        ],
        minAge: { unit: 'months', value: 72 },
        maxAge: { unit: 'months', value: 108 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 15 },
          { type: 'max', units: '', value: 30 },
        ],
        minAge: { unit: 'months', value: 108 },
        maxAge: { unit: 'months', value: 144 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 15 },
          { type: 'max', units: '', value: 25 },
        ],
        minAge: { unit: 'months', value: 144 },
        maxAge: { unit: 'months', value: 180 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 14 },
          { type: 'max', units: '', value: 23 },
        ],
        minAge: { unit: 'months', value: 180 },
        maxAge: { unit: 'months', value: 216 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 11 },
          { type: 'max', units: '', value: 21 },
        ],
        minAge: { unit: 'months', value: 216 },
      },
    ],
  },
  'vital-oxygen-sat': {
    alertThresholds: [
      {
        rules: [{ type: 'min', units: '', value: 95 }],
      },
    ],
  },
  'vital-blood-pressure': {
    components: {
      'systolic-pressure': {
        alertThresholds: [
          {
            rules: [{ type: 'min', units: '', value: 70 }],
            minAge: { unit: 'months', value: 0 },
            maxAge: { unit: 'months', value: 12 },
          },
          {
            rules: [{ type: 'min', units: '', ageFunction: (ageInYears: number) => 70 + ageInYears * 2 }],
            minAge: { unit: 'months', value: 12 },
            maxAge: { unit: 'months', value: 108 },
          },
          {
            rules: [{ type: 'min', units: '', value: 90 }],
            minAge: { unit: 'months', value: 108 },
          },
          {
            rules: [{ type: 'max', units: '', value: 140 }],
            minAge: { unit: 'months', value: 216 },
          },
        ],
      },
    },
  },
  'vital-weight': {
    alertThresholds: [
      {
        rules: [{ type: 'min', units: 'kg', ageSexFunction: getWeightPercentileLow }],
        maxAge: { unit: 'months', value: 144 },
      },
      {
        rules: [{ type: 'max', units: 'kg', ageSexFunction: getWeightPercentileHigh }],
        maxAge: { unit: 'months', value: 144 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 30.5 },
          { type: 'max', units: 'kg', value: 78.3 },
        ],
        minAge: { unit: 'months', value: 144 },
        maxAge: { unit: 'months', value: 180 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 43 },
          { type: 'max', units: 'kg', value: 92 },
        ],
        minAge: { unit: 'months', value: 180 },
        maxAge: { unit: 'months', value: 216 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 50 },
          { type: 'max', units: 'kg', value: 150 },
        ],
        minAge: { unit: 'months', value: 216 },
      },
    ],
  },
  'vital-height': {
    alertThresholds: [
      {
        rules: [{ type: 'min', units: 'cm', ageSexFunction: getHeightPercentileLow }],
        maxAge: { unit: 'months', value: 144 },
      },
      {
        rules: [{ type: 'max', units: 'cm', ageSexFunction: getHeightPercentileHigh }],
        maxAge: { unit: 'months', value: 144 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 118.5 },
          { type: 'max', units: 'cm', value: 176.5 },
        ],
        minAge: { unit: 'months', value: 144 },
        maxAge: { unit: 'months', value: 180 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 151.3 },
          { type: 'max', units: 'cm', value: 187.8 },
        ],
        minAge: { unit: 'months', value: 180 },
        maxAge: { unit: 'months', value: 216 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 152.5 },
          { type: 'max', units: 'cm', value: 201 },
        ],
        minAge: { unit: 'months', value: 216 },
      },
    ],
  },
};

const AgeSchema = z.object({
  unit: z.enum(['years', 'months', 'days']),
  value: z.number().int().nonnegative(),
});
const BaseConstraintSchema = z.object({
  type: z.enum(['min', 'max']),
  units: z.string().optional(),
  criticality: z.nativeEnum(VitalAlertCriticality).default(VitalAlertCriticality.Abnormal),
});
const ValueConstraintSchema = BaseConstraintSchema.extend({
  value: z.number(),
});
const AgeFunctionConstraintSchema = BaseConstraintSchema.extend({
  ageFunction: z.function().args(z.number()).returns(z.number()),
});
const AgeSexFunctionConstraintSchema = BaseConstraintSchema.extend({
  ageSexFunction: z
    .function()
    .args(z.number(), z.enum(['male', 'female']))
    .returns(z.number()),
});

export const ConstraintSchema = z
  .union([ValueConstraintSchema, AgeFunctionConstraintSchema, AgeSexFunctionConstraintSchema])
  .refine(
    (data) => {
      // Ensure that if a value is provided, it is a number
      if ('value' in data) {
        return typeof data.value === 'number';
      } else if ('ageFunction' in data || 'ageSexFunction' in data) {
        return true;
      } else {
        return false;
      }
    },
    { message: 'Constraint must have either a value or an ageFunction' }
  );
const AlertThresholdSchema = z
  .object({
    rules: z.array(ConstraintSchema).refine(
      (rulesList) => {
        const conflict = rulesList.some((rule, idx) => {
          const otherRules = rulesList.slice(idx + 1);
          const conflictingRule = otherRules.some((otherRule) => {
            if (rule.type === 'min' && otherRule.type === 'max' && 'value' in rule && 'value' in otherRule) {
              return rule.units === otherRule.units && rule.value > otherRule.value;
            }
            if (rule.type === 'max' && otherRule.type === 'min' && 'value' in rule && 'value' in otherRule) {
              return rule.units === otherRule.units && rule.value < otherRule.value;
            }
            if (rule.type === otherRule.type && 'value' in rule && 'value' in otherRule) {
              return rule.units === otherRule.units && rule.value !== otherRule.value;
            }
            return false;
          });
          if (conflictingRule) {
            return true;
          }
          return false;
        });
        return !conflict;
      },
      { message: 'Conflicting rules found' }
    ),
    minAge: AgeSchema.optional(),
    maxAge: AgeSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.minAge && data.maxAge) {
        return data.minAge.value <= data.maxAge.value;
      }
      return true;
    },
    { message: 'minAge must be less than or equal to maxAge in an alert threshold' }
  );

// this can be expanded to include things like out-of-range / invalid values
const VitalsObjectSchema = z.object({
  alertThresholds: z.array(AlertThresholdSchema).optional(),
});
const VitalsVisionSchema = VitalsObjectSchema.extend({
  components: z.record(z.nativeEnum(VitalVisionComponents), VitalsObjectSchema),
}).refine(
  (data) => {
    if (data.alertThresholds) {
      return false;
    }
    return true;
  },
  { message: 'vital-vision object may only define components' }
);
const VitalsBloodPressureSchema = VitalsObjectSchema.extend({
  components: z.record(z.nativeEnum(VitalBloodPressureComponents), VitalsObjectSchema),
}).refine(
  (data) => {
    if (data.alertThresholds) {
      return false;
    }
    return true;
  },
  { message: 'vital-blood-pressure object may only define components' }
);

const VitalsWeightSchema = VitalsObjectSchema.extend({
  unit: z
    .enum(['kg', 'lbs'] as const)
    .optional()
    .default('kg'),
});

export const VitalsMap = z.object({
  'vital-temperature': VitalsObjectSchema.optional(),
  'vital-heartbeat': VitalsObjectSchema.optional(),
  'vital-oxygen-sat': VitalsObjectSchema.optional(),
  'vital-respiration-rate': VitalsObjectSchema.optional(),
  'vital-weight': VitalsWeightSchema.optional().default({ unit: 'kg' }),
  'vital-height': VitalsObjectSchema.optional(),
  'vital-blood-pressure': VitalsBloodPressureSchema.optional(),
  'vital-vision': VitalsVisionSchema.optional(),
});

export const DefaultVitalsConfig = Object.freeze(VitalsMap.parse(VitalsConfig));

export type VitalsSchema = z.infer<typeof VitalsMap>;

export const VitalsDef = (config?: any): VitalsSchema => {
  if (config) {
    return Object.freeze(VitalsMap.parse(config));
  }
  return DefaultVitalsConfig;
};

export type AlertThreshold = z.infer<typeof AlertThresholdSchema>;

export type AlertRule = ReturnType<typeof ConstraintSchema.parse>;

export const vitalsConfig = VitalsDef(VITALS_OVERRIDES);
