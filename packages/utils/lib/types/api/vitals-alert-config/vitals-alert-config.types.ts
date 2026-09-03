import { z } from 'zod';
import { VitalsAge, VitalsAgeSchema } from '../../../config-helpers/vitals';
import { Secrets } from '../../../secrets';

/** Vitals whose alert levels an admin can configure. Excludes BMI/LMP/vision, which never alert. */
export const VITAL_ALERT_TYPES = [
  'vital-weight',
  'vital-height',
  'vital-temperature',
  'vital-heartbeat',
  'vital-respiration-rate',
  'vital-blood-pressure',
  'vital-oxygen-sat',
] as const;
export type VitalAlertType = (typeof VITAL_ALERT_TYPES)[number];

export const VitalAlertTypeSchema = z.enum(VITAL_ALERT_TYPES);

export const MAX_VITAL_ALERT_AGE_RANGES = 15;

/** Written verbatim into the engine config's `units` field; must match the strings in `VitalsConfigData`. */
export const VITAL_ALERT_UNITS: Record<VitalAlertType, string> = {
  'vital-weight': 'kg',
  'vital-height': 'cm',
  'vital-temperature': 'celsius',
  'vital-heartbeat': 'bpm',
  'vital-respiration-rate': '',
  'vital-blood-pressure': 'mmHg',
  'vital-oxygen-sat': '%',
};

export const VITAL_ALERT_LABELS: Record<VitalAlertType, string> = {
  'vital-weight': 'Weight',
  'vital-height': 'Height',
  'vital-temperature': 'Temperature',
  'vital-heartbeat': 'Heart rate',
  'vital-respiration-rate': 'Respiration rate',
  'vital-blood-pressure': 'Blood pressure (systolic)',
  'vital-oxygen-sat': 'SpO2',
};

export const VITAL_ALERT_LEVELS = ['criticalLow', 'abnormalLow', 'abnormalHigh', 'criticalHigh'] as const;
export type VitalAlertLevel = (typeof VITAL_ALERT_LEVELS)[number];

export const VITAL_ALERT_LEVEL_LABELS: Record<VitalAlertLevel, string> = {
  criticalLow: 'Critical Low',
  abnormalLow: 'Low',
  abnormalHigh: 'High',
  criticalHigh: 'Critical High',
};

export interface VitalAlertAgeRange {
  /** Also the `thresholds` lookup key. */
  id: string;
  minAge: VitalsAge;
  /** Omitted means open-ended. */
  maxAge?: VitalsAge;
}

/** An absent level means no alert at that level. */
export interface VitalAlertLevels {
  criticalLow?: number;
  abnormalLow?: number;
  abnormalHigh?: number;
  criticalHigh?: number;
}

export interface VitalsAlertConfig {
  ageRanges: VitalAlertAgeRange[];
  thresholds: Record<VitalAlertType, Record<string, VitalAlertLevels>>;
}

/** Boundaries are compared in months so that `{months: 24}` and `{years: 2}` are equal. */
export const vitalAlertAgeToMonths = (age: VitalsAge): number => {
  switch (age.unit) {
    case 'years':
      return age.value * 12;
    case 'months':
      return age.value;
    case 'days':
      return age.value / 30.4375;
  }
};

/** Forms materialize `maxAge` once its inputs register, so an absent end age arrives as `{}`. */
const OptionalMaxAgeSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'object') {
    const candidate = value as { value?: unknown };
    if (candidate.value === undefined || candidate.value === null || candidate.value === '') {
      return undefined;
    }
  }
  return value;
}, VitalsAgeSchema.optional());

export const VitalAlertAgeRangeSchema = z.object({
  id: z.string().min(1),
  minAge: VitalsAgeSchema,
  maxAge: OptionalMaxAgeSchema,
});

export const VitalAlertLevelsSchema = z
  .object({
    criticalLow: z.number().optional(),
    abnormalLow: z.number().optional(),
    abnormalHigh: z.number().optional(),
    criticalHigh: z.number().optional(),
  })
  .superRefine((levels, ctx) => {
    const ordered = VITAL_ALERT_LEVELS.map((level) => ({ level, value: levels[level] })).filter(
      (entry): entry is { level: VitalAlertLevel; value: number } => entry.value !== undefined
    );
    for (let i = 1; i < ordered.length; i++) {
      const previous = ordered[i - 1];
      const current = ordered[i];
      if (previous.value > current.value) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [current.level],
          message: `${VITAL_ALERT_LEVEL_LABELS[current.level]} must be greater than or equal to ${
            VITAL_ALERT_LEVEL_LABELS[previous.level]
          }`,
        });
      }
    }
  });

const AgeRangesSchema = z
  .array(VitalAlertAgeRangeSchema)
  .min(1, 'At least one age range is required')
  .max(MAX_VITAL_ALERT_AGE_RANGES, `No more than ${MAX_VITAL_ALERT_AGE_RANGES} age ranges are allowed`)
  .superRefine((ranges, ctx) => {
    const ids = new Set<string>();
    ranges.forEach((range, index) => {
      if (ids.has(range.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'id'],
          message: 'Age range ids must be unique',
        });
      }
      ids.add(range.id);

      const isLast = index === ranges.length - 1;
      if (!range.maxAge && !isLast) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'maxAge'],
          message: 'Only the last age range may be open-ended',
        });
      }
      if (range.maxAge && vitalAlertAgeToMonths(range.maxAge) <= vitalAlertAgeToMonths(range.minAge)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'maxAge'],
          message: 'End age must be greater than start age',
        });
      }
      if (index === 0) return;

      const previous = ranges[index - 1];
      if (!previous.maxAge) return; // already reported above
      // Gaps are intentionally allowed: an uncovered span has no alert rules.
      if (vitalAlertAgeToMonths(range.minAge) < vitalAlertAgeToMonths(previous.maxAge)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'minAge'],
          message: 'Age ranges must not overlap — start age must be at or after the previous range’s end age',
        });
      }
    });
  });

export const VitalsAlertConfigSchema = z
  .object({
    ageRanges: AgeRangesSchema,
    thresholds: z.record(VitalAlertTypeSchema, z.record(z.string(), VitalAlertLevelsSchema)),
  })
  .superRefine((config, ctx) => {
    const rangeIds = new Set(config.ageRanges.map((range) => range.id));
    VITAL_ALERT_TYPES.forEach((vital) => {
      const perRange = config.thresholds[vital];
      if (!perRange) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['thresholds', vital],
          message: `Thresholds are missing for ${VITAL_ALERT_LABELS[vital]}`,
        });
        return;
      }
      Object.keys(perRange).forEach((rangeId) => {
        if (!rangeIds.has(rangeId)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['thresholds', vital, rangeId],
            message: 'Thresholds reference an age range that does not exist',
          });
        }
      });
    });
  })
  // `z.record` with an enum key produces a partial type; the refinement above proves every vital
  // is present.
  .transform((config): VitalsAlertConfig => config as VitalsAlertConfig);

export type GetVitalsAlertConfigInput = Record<string, never>;
export type GetVitalsAlertConfigOutput = VitalsAlertConfig;

/** Wrapped in a `config` key so the validated input can add `secrets`/`userToken` without collision. */
export const UpdateVitalsAlertConfigInputSchema = z.object({
  config: VitalsAlertConfigSchema,
});
export type UpdateVitalsAlertConfigInput = { config: VitalsAlertConfig };

export const UpdateVitalsAlertConfigInputValidatedSchema = UpdateVitalsAlertConfigInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
  userToken: z.string(),
});
export type UpdateVitalsAlertConfigInputValidated = z.infer<typeof UpdateVitalsAlertConfigInputValidatedSchema>;
