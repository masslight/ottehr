import * as z from 'zod';
import { VitalAlertCriticality, VitalFieldNames } from '../api';
import ChartData from './chart';

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

const VitalsObjectSchema = z.object({
  alertThresholds: z.array(AlertThresholdSchema),
});

export const VitalsMapSchema = z.record(z.nativeEnum(VitalFieldNames), VitalsObjectSchema);
export const ChartDataSchema = z.object({
  vitals: VitalsMapSchema,
});
const ChartDataDef = ChartDataSchema.parse(ChartData);

export const VitalsDef = Object.freeze(ChartDataDef.vitals);

export type AlertRule = ReturnType<typeof ConstraintSchema.parse>;
