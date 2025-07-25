import * as z from 'zod';
import ChartData from '../../../.ottehr_config/clinical-chart';
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

export const ConstraintSchema = z.union([ValueConstraintSchema, AgeFunctionConstraintSchema]);
const AlertThresholdSchema = z
  .object({
    rules: z.array(ConstraintSchema),
    minAge: AgeSchema.optional(),
    maxAge: AgeSchema.optional(),
  })
  .refine((data) => {
    if (data.minAge && data.maxAge) {
      return data.minAge.value <= data.maxAge.value;
    }
    return true;
  });

// this will can be expanded to include things like out-of-range / invalid values
const VitalsObjectSchema = z.object({
  alertThresholds: z.array(AlertThresholdSchema).optional(),
});
const VitalsVisionSchema = VitalsObjectSchema.extend({
  components: z.record(z.nativeEnum(VitalVisionComponents), VitalsObjectSchema),
}).refine((data) => {
  if (data.alertThresholds) {
    return { message: 'vital-vision object may only define components' };
  }
  return true;
});
const VitalsBloodPressureSchema = VitalsObjectSchema.extend({
  components: z.record(z.nativeEnum(VitalBloodPressureComponents), VitalsObjectSchema),
}).refine((data) => {
  if (data.alertThresholds) {
    return { message: 'vital-blood-pressure object may only define components' };
  }
  return true;
});

// currently we only define alerts for vitals that are specified so these can all be optional currently
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
  vitals: VitalsMapSchema,
});
const ChartDataDef = ChartDataSchema.parse(ChartData);

export const VitalsDef = Object.freeze(ChartDataDef.vitals);

export type AlertThreshold = z.infer<typeof AlertThresholdSchema>;

export type AlertRule = ReturnType<typeof ConstraintSchema.parse>;
