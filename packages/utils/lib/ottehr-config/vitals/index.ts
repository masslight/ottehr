import * as z from 'zod';
import { VITALS_OVERRIDES } from '../../../ottehr-config-overrides';
import { VitalAlertCriticality, VitalBloodPressureComponents, VitalVisionComponents } from '../../types/api';

const VitalsConfig = {
  'vital-temperature': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'celsius', value: 36.5 },
          { type: 'max', units: 'celsius', value: 37.9 },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 2 },
      },
      {
        rules: [
          { type: 'min', units: 'celsius', value: 36 },
          { type: 'max', units: 'celsius', value: 37.9 },
        ],
        minAge: { unit: 'months', value: 2 },
        maxAge: { unit: 'months', value: 144 },
      },
      {
        rules: [
          { type: 'min', units: 'celsius', value: 36 },
          { type: 'max', units: 'celsius', value: 37.9 },
        ],
        minAge: { unit: 'months', value: 144 },
      },
    ],
  },
  'vital-heartbeat': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'bpm', value: 113 },
          { type: 'max', units: 'bpm', value: 171 },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 2 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 108 },
          { type: 'max', units: 'bpm', value: 167 },
        ],
        minAge: { unit: 'months', value: 3 },
        maxAge: { unit: 'months', value: 5 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 104 },
          { type: 'max', units: 'bpm', value: 160 },
        ],
        minAge: { unit: 'months', value: 6 },
        maxAge: { unit: 'months', value: 8 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 101 },
          { type: 'max', units: 'bpm', value: 160 },
        ],
        minAge: { unit: 'months', value: 9 },
        maxAge: { unit: 'months', value: 11 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 97 },
          { type: 'max', units: 'bpm', value: 157 },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'months', value: 17 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 92 },
          { type: 'max', units: 'bpm', value: 154 },
        ],
        minAge: { unit: 'months', value: 18 },
        maxAge: { unit: 'months', value: 23 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 87 },
          { type: 'max', units: 'bpm', value: 150 },
        ],
        minAge: { unit: 'months', value: 24 },
        maxAge: { unit: 'months', value: 35 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 82 },
          { type: 'max', units: 'bpm', value: 146 },
        ],
        minAge: { unit: 'months', value: 36 },
        maxAge: { unit: 'months', value: 47 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 77 },
          { type: 'max', units: 'bpm', value: 142 },
        ],
        minAge: { unit: 'months', value: 48 },
        maxAge: { unit: 'months', value: 71 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 71 },
          { type: 'max', units: 'bpm', value: 137 },
        ],
        minAge: { unit: 'months', value: 72 },
        maxAge: { unit: 'months', value: 95 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 66 },
          { type: 'max', units: 'bpm', value: 129 },
        ],
        minAge: { unit: 'months', value: 96 },
        maxAge: { unit: 'months', value: 143 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 61 },
          { type: 'max', units: 'bpm', value: 121 },
        ],
        minAge: { unit: 'months', value: 144 },
        maxAge: { unit: 'months', value: 179 },
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
          { type: 'min', units: '', value: 25 },
          { type: 'max', units: '', value: 60 },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 2 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 28 },
          { type: 'max', units: '', value: 52 },
        ],
        minAge: { unit: 'months', value: 3 },
        maxAge: { unit: 'months', value: 5 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 26 },
          { type: 'max', units: '', value: 49 },
        ],
        minAge: { unit: 'months', value: 6 },
        maxAge: { unit: 'months', value: 8 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 24 },
          { type: 'max', units: '', value: 46 },
        ],
        minAge: { unit: 'months', value: 9 },
        maxAge: { unit: 'months', value: 11 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 23 },
          { type: 'max', units: '', value: 43 },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'months', value: 17 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 21 },
          { type: 'max', units: '', value: 40 },
        ],
        minAge: { unit: 'months', value: 18 },
        maxAge: { unit: 'months', value: 23 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 20 },
          { type: 'max', units: '', value: 37 },
        ],
        minAge: { unit: 'months', value: 24 },
        maxAge: { unit: 'months', value: 35 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 19 },
          { type: 'max', units: '', value: 35 },
        ],
        minAge: { unit: 'months', value: 36 },
        maxAge: { unit: 'months', value: 47 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 18 },
          { type: 'max', units: '', value: 33 },
        ],
        minAge: { unit: 'months', value: 48 },
        maxAge: { unit: 'months', value: 71 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 17 },
          { type: 'max', units: '', value: 31 },
        ],
        minAge: { unit: 'months', value: 72 },
        maxAge: { unit: 'months', value: 95 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 16 },
          { type: 'max', units: '', value: 28 },
        ],
        minAge: { unit: 'months', value: 96 },
        maxAge: { unit: 'months', value: 143 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 15 },
          { type: 'max', units: '', value: 25 },
        ],
        minAge: { unit: 'months', value: 144 },
        maxAge: { unit: 'months', value: 179 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 14 },
          { type: 'max', units: '', value: 23 },
        ],
        minAge: { unit: 'months', value: 180 },
        maxAge: { unit: 'months', value: 215 },
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
        rules: [
          { type: 'min', units: '', value: 94 },
          { type: 'max', units: '', value: 101 },
        ],
      },
    ],
  },
  'vital-blood-pressure': {
    components: {
      'systolic-pressure': {
        alertThresholds: [
          {
            rules: [{ type: 'max', units: '', value: 140 }],
          },
          {
            rules: [{ type: 'min', units: '', value: 59 }],
            minAge: { unit: 'months', value: 0 },
            maxAge: { unit: 'months', value: 2 },
          },
          {
            rules: [{ type: 'min', units: '', value: 69 }],
            minAge: { unit: 'months', value: 3 },
            maxAge: { unit: 'months', value: 11 },
          },
          {
            rules: [{ type: 'min', units: '', value: 72 }],
            minAge: { unit: 'months', value: 12 },
            maxAge: { unit: 'months', value: 23 },
          },
          {
            rules: [{ type: 'min', units: '', value: 74 }],
            minAge: { unit: 'months', value: 24 },
            maxAge: { unit: 'months', value: 35 },
          },
          {
            rules: [{ type: 'min', units: '', value: 76 }],
            minAge: { unit: 'months', value: 36 },
            maxAge: { unit: 'months', value: 47 },
          },
          {
            rules: [{ type: 'min', units: '', value: 78 }],
            minAge: { unit: 'months', value: 48 },
            maxAge: { unit: 'months', value: 71 },
          },
          {
            rules: [{ type: 'min', units: '', value: 82 }],
            minAge: { unit: 'months', value: 72 },
            maxAge: { unit: 'months', value: 95 },
          },
          {
            rules: [{ type: 'min', units: '', value: 86 }],
            minAge: { unit: 'months', value: 96 },
            maxAge: { unit: 'months', value: 143 },
          },
          {
            rules: [{ type: 'min', units: '', value: 90 }],
            minAge: { unit: 'months', value: 144 },
            maxAge: { unit: 'months', value: 215 },
          },
          {
            rules: [{ type: 'min', units: '', value: 90 }],
            minAge: { unit: 'months', value: 216 },
          },
        ],
      },
    },
  },
  'vital-weight': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'kg', value: 2.4 },
          { type: 'max', units: 'kg', value: 6.9 },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 2 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 4.7 },
          { type: 'max', units: 'kg', value: 9.3 },
        ],
        minAge: { unit: 'months', value: 3 },
        maxAge: { unit: 'months', value: 5 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 6.7 },
          { type: 'max', units: 'kg', value: 10.9 },
        ],
        minAge: { unit: 'months', value: 6 },
        maxAge: { unit: 'months', value: 8 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 6.9 },
          { type: 'max', units: 'kg', value: 12.2 },
        ],
        minAge: { unit: 'months', value: 9 },
        maxAge: { unit: 'months', value: 11 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 7.8 },
          { type: 'max', units: 'kg', value: 13.9 },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'months', value: 17 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 9.2 },
          { type: 'max', units: 'kg', value: 15.1 },
        ],
        minAge: { unit: 'months', value: 18 },
        maxAge: { unit: 'months', value: 23 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 10.1 },
          { type: 'max', units: 'kg', value: 17.3 },
        ],
        minAge: { unit: 'months', value: 24 },
        maxAge: { unit: 'months', value: 35 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 11.9 },
          { type: 'max', units: 'kg', value: 20 },
        ],
        minAge: { unit: 'months', value: 36 },
        maxAge: { unit: 'months', value: 47 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 13.5 },
          { type: 'max', units: 'kg', value: 26.7 },
        ],
        minAge: { unit: 'months', value: 48 },
        maxAge: { unit: 'months', value: 71 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 16.9 },
          { type: 'max', units: 'kg', value: 34.9 },
        ],
        minAge: { unit: 'months', value: 72 },
        maxAge: { unit: 'months', value: 95 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 21 },
          { type: 'max', units: 'kg', value: 58.7 },
        ],
        minAge: { unit: 'months', value: 96 },
        maxAge: { unit: 'months', value: 143 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 30.5 },
          { type: 'max', units: 'kg', value: 78.3 },
        ],
        minAge: { unit: 'months', value: 144 },
        maxAge: { unit: 'months', value: 179 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 43 },
          { type: 'max', units: 'kg', value: 92 },
        ],
        minAge: { unit: 'months', value: 180 },
        maxAge: { unit: 'months', value: 215 },
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
        rules: [
          { type: 'min', units: 'cm', value: 45 },
          { type: 'max', units: 'cm', value: 64 },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 2 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 56.4 },
          { type: 'max', units: 'cm', value: 70.8 },
        ],
        minAge: { unit: 'months', value: 3 },
        maxAge: { unit: 'months', value: 5 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 61.8 },
          { type: 'max', units: 'cm', value: 75.8 },
        ],
        minAge: { unit: 'months', value: 6 },
        maxAge: { unit: 'months', value: 8 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 66 },
          { type: 'max', units: 'cm', value: 80 },
        ],
        minAge: { unit: 'months', value: 9 },
        maxAge: { unit: 'months', value: 11 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 69.5 },
          { type: 'max', units: 'cm', value: 86.9 },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'months', value: 17 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 75.4 },
          { type: 'max', units: 'cm', value: 92.6 },
        ],
        minAge: { unit: 'months', value: 18 },
        maxAge: { unit: 'months', value: 23 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 79.3 },
          { type: 'max', units: 'cm', value: 100.6 },
        ],
        minAge: { unit: 'months', value: 24 },
        maxAge: { unit: 'months', value: 35 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 87.8 },
          { type: 'max', units: 'cm', value: 108.3 },
        ],
        minAge: { unit: 'months', value: 36 },
        maxAge: { unit: 'months', value: 47 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 94 },
          { type: 'max', units: 'cm', value: 123.3 },
        ],
        minAge: { unit: 'months', value: 48 },
        maxAge: { unit: 'months', value: 71 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 106.9 },
          { type: 'max', units: 'cm', value: 130.4 },
        ],
        minAge: { unit: 'months', value: 72 },
        maxAge: { unit: 'months', value: 95 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 118.5 },
          { type: 'max', units: 'cm', value: 155.1 },
        ],
        minAge: { unit: 'months', value: 96 },
        maxAge: { unit: 'months', value: 143 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 118.5 },
          { type: 'max', units: 'cm', value: 176.5 },
        ],
        minAge: { unit: 'months', value: 144 },
        maxAge: { unit: 'months', value: 179 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 151.3 },
          { type: 'max', units: 'cm', value: 187.8 },
        ],
        minAge: { unit: 'months', value: 180 },
        maxAge: { unit: 'months', value: 215 },
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
