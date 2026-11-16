import { z } from 'zod';
import { PRIVATE_EXTENSION_BASE_URL } from '../../fhir/constants';

// Birth history is recorded once per patient, not per visit: one patient-level Observation (subject = the patient,
// no encounter) tagged with this system holds every field as a component. Every visit's Vitals screen reads and
// edits that same resource.
export const BIRTH_HISTORY_META_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/birth-history`;
export const BIRTH_HISTORY_CODE = 'birth-history';

/** Observation.component codes (system BIRTH_HISTORY_META_SYSTEM), one per field. */
export const BIRTH_HISTORY_COMPONENT_CODES = {
  timeOfBirth: 'time-of-birth',
  /** Weeks and days are stored as one quantity in days. */
  gestationalAge: 'gestational-age',
  birthWeightKg: 'birth-weight',
  birthLengthCm: 'birth-length',
  birthHeadCircumferenceCm: 'birth-head-circumference',
} as const;

/** Whole weeks the server takes for gestational age; the Vitals card checks the same limits. */
export const GESTATIONAL_AGE_WEEKS_MIN = 20;
export const GESTATIONAL_AGE_WEEKS_MAX = 45;

export const BirthHistorySchema = z
  .object({
    /** Local time of birth on the patient's birth date, 24-hour "HH:mm". */
    timeOfBirth: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    gestationalAgeWeeks: z.number().int().min(GESTATIONAL_AGE_WEEKS_MIN).max(GESTATIONAL_AGE_WEEKS_MAX).optional(),
    gestationalAgeDays: z.number().int().min(0).max(6).optional(),
    /** Stored metric, like the vitals; imperial is converted on entry. */
    birthWeightKg: z.number().positive().optional(),
    birthLengthCm: z.number().positive().optional(),
    birthHeadCircumferenceCm: z.number().positive().optional(),
  })
  .refine((value) => value.gestationalAgeDays === undefined || value.gestationalAgeWeeks !== undefined, {
    message: 'gestationalAgeDays needs gestationalAgeWeeks',
    path: ['gestationalAgeDays'],
  });
export type BirthHistory = z.infer<typeof BirthHistorySchema>;

export interface BirthHistoryDTO extends BirthHistory {
  resourceId?: string;
}

export const GetBirthHistoryInputSchema = z.object({ patientId: z.string().uuid() });
export type GetBirthHistoryInput = z.infer<typeof GetBirthHistoryInputSchema>;

export const SaveBirthHistoryInputSchema = GetBirthHistoryInputSchema.extend({ birthHistory: BirthHistorySchema });
export type SaveBirthHistoryInput = z.infer<typeof SaveBirthHistoryInputSchema>;

/** Both endpoints answer with the patient's birth history; absent until it is first saved. */
export interface BirthHistoryOutput {
  birthHistory?: BirthHistoryDTO;
}
