import * as z from 'zod';
import ChartDataSource from '../../../.ottehr_config/clinical-chart';
import { VitalAlertCriticality, VitalBloodPressureComponents, VitalVisionComponents } from '../../types/api';

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

export const ConstraintSchema = z.union([ValueConstraintSchema, AgeFunctionConstraintSchema]).refine(
  (data) => {
    // Ensure that if a value is provided, it is a number
    if ('value' in data) {
      return typeof data.value === 'number';
    } else if ('ageFunction' in data) {
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

// this will can be expanded to include things like out-of-range / invalid values
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

// currently we only define alerts for vitals that are specified so these can all be optional
// the time may come when some or all of these are required
export const VitalsMapSchema = z.object({
  'vital-temperature': VitalsObjectSchema.optional(),
  'vital-heartbeat': VitalsObjectSchema.optional(),
  'vital-oxygen-sat': VitalsObjectSchema.optional(),
  'vital-respiration-rate': VitalsObjectSchema.optional(),
  'vital-weight': VitalsObjectSchema.optional(),
  'vital-height': VitalsObjectSchema.optional(),
  'vital-blood-pressure': VitalsBloodPressureSchema.optional(),
  'vital-vision': VitalsVisionSchema.optional(),
});
export const ChartDataSchema = z.object({
  components: z.object({
    vitals: z.object({
      components: VitalsMapSchema,
    }),
  }),
});
const ChartDataDef = Object.freeze(ChartDataSchema.parse(ChartDataSource));

export type ChartData = z.infer<typeof ChartDataSchema>;
export type Vitals = ChartData['components']['vitals']['components'];

export const VitalsDef = (chartDataSource?: ChartData): Vitals => {
  if (chartDataSource) {
    return Object.freeze(ChartDataSchema.parse(chartDataSource)).components.vitals.components;
  }
  return ChartDataDef.components.vitals.components;
};

export type AlertThreshold = z.infer<typeof AlertThresholdSchema>;

export type AlertRule = ReturnType<typeof ConstraintSchema.parse>;
