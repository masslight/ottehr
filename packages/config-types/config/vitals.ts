import z from 'zod';

/**
 * Vitals Configuration Types
 *
 * These types define the contract for vital signs monitoring configuration,
 * including age-based alert thresholds and component configurations.
 */

/**
 * Alert criticality levels
 */
export type VitalAlertCriticality = 'critical' | 'abnormal';

export const VitalAlertCriticalitySchema = z.enum(['critical', 'abnormal']);

/**
 * Vision components
 */
export type VitalVisionComponent = 'left-eye' | 'right-eye';

export const VitalVisionComponentSchema = z.enum(['left-eye', 'right-eye']);

/**
 * Blood pressure components
 */
export type VitalBloodPressureComponent = 'systolic-pressure' | 'diastolic-pressure';

export const VitalBloodPressureComponentSchema = z.enum(['systolic-pressure', 'diastolic-pressure']);

/**
 * Age unit for thresholds
 */
export type AgeUnit = 'years' | 'months' | 'days';

export const AgeUnitSchema = z.enum(['years', 'months', 'days']);

/**
 * Age specification for threshold ranges
 */
export interface Age {
  unit: AgeUnit;
  value: number;
}

export const AgeSchema: z.ZodType<Age, z.ZodTypeDef, unknown> = z.object({
  unit: AgeUnitSchema,
  value: z.number().int().nonnegative(),
});

/**
 * Constraint type (min/max bounds)
 */
export type ConstraintType = 'min' | 'max';

export const ConstraintTypeSchema = z.enum(['min', 'max']);

/**
 * Base constraint properties shared by all constraint types
 */
export interface BaseConstraint {
  type: ConstraintType;
  units?: string;
  criticality?: VitalAlertCriticality;
}

/**
 * Value-based constraint with a static numeric value
 */
export interface ValueConstraint extends BaseConstraint {
  value: number;
}

/**
 * Function-based constraint that calculates value from age
 */
export interface AgeFunctionConstraint extends BaseConstraint {
  ageFunction: (ageInMonths: number) => number;
}

/**
 * Function-based constraint that calculates value from age and sex
 */
export interface AgeSexFunctionConstraint extends BaseConstraint {
  ageSexFunction: (ageInMonths: number, sex: 'male' | 'female') => number;
}

/**
 * Union of all constraint types
 */
export type AlertConstraint = ValueConstraint | AgeFunctionConstraint | AgeSexFunctionConstraint;

/**
 * Alert threshold - defines rules and age ranges for a vital alert
 */
export interface AlertThreshold {
  rules: AlertConstraint[];
  minAge?: Age;
  maxAge?: Age;
}

/**
 * Base vitals object with alert thresholds
 */
export interface VitalsObject {
  alertThresholds?: AlertThreshold[];
}

/**
 * Vitals weight configuration with unit option
 */
export interface VitalsWeight extends VitalsObject {
  unit?: 'kg' | 'lbs';
}

/**
 * Vitals with components (blood pressure, vision)
 */
export interface VitalsWithComponents {
  components: Record<string, VitalsObject>;
}

/**
 * Blood pressure vitals configuration
 */
export interface VitalsBloodPressure extends VitalsWithComponents {
  components: Partial<Record<VitalBloodPressureComponent, VitalsObject>>;
}

/**
 * Vision vitals configuration
 */
export interface VitalsVision extends VitalsWithComponents {
  components: Partial<Record<VitalVisionComponent, VitalsObject>>;
}

/**
 * Main vitals configuration schema - maps vital types to their configs
 */
export interface VitalsConfig {
  'vital-temperature'?: VitalsObject;
  'vital-heartbeat'?: VitalsObject;
  'vital-oxygen-sat'?: VitalsObject;
  'vital-respiration-rate'?: VitalsObject;
  'vital-weight'?: VitalsWeight;
  'vital-height'?: VitalsObject;
  'vital-blood-pressure'?: VitalsBloodPressure;
  'vital-vision'?: VitalsVision;
}

/**
 * Known vital type keys
 */
export type VitalType = keyof VitalsConfig;

export const VitalTypeSchema = z.enum([
  'vital-temperature',
  'vital-heartbeat',
  'vital-oxygen-sat',
  'vital-respiration-rate',
  'vital-weight',
  'vital-height',
  'vital-blood-pressure',
  'vital-vision',
]);
