import * as z from 'zod';
import { VitalsConfigData } from '../../ottehr-config/vitals';
import {
  VitalAlertCriticality,
  VitalBloodPressureComponents,
  VitalVisionComponents,
} from '../../types/api/chart-data/chart-data.constants';

/**
 * Schema and accessors for the vitals alert config.
 *
 * Kept out of `ottehr-config/vitals`, which is replaced per customer at build time: only the data
 * there varies, so holding the schema here means a change to it reaches every customer immediately
 * instead of waiting for each profile's copy to be regenerated.
 */

const AgeSchema = z.object({
  unit: z.enum(['years', 'months', 'days']),
  value: z.number().int().nonnegative(),
});

function ageToDays(age: z.infer<typeof AgeSchema>): number {
  switch (age.unit) {
    case 'years':
      return age.value * 365;
    case 'months':
      return age.value * 30;
    case 'days':
      return age.value;
  }
}
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
            if (
              rule.type === otherRule.type &&
              'value' in rule &&
              'value' in otherRule &&
              rule.criticality === otherRule.criticality
            ) {
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
        return ageToDays(data.minAge) <= ageToDays(data.maxAge);
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

export const DefaultVitalsConfig = Object.freeze(VitalsMap.parse(VitalsConfigData));

export type VitalsSchema = z.infer<typeof VitalsMap>;

export const VitalsDef = (config?: any): VitalsSchema => {
  if (config) {
    return Object.freeze(VitalsMap.parse(config));
  }
  return DefaultVitalsConfig;
};

export type AlertThreshold = z.infer<typeof AlertThresholdSchema>;

export type AlertRule = ReturnType<typeof ConstraintSchema.parse>;

export const vitalsConfig = VitalsDef();
