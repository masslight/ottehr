import { z } from 'zod';
import { Secrets } from '../../../secrets';

const requiredDefaultTextMessage = (label: string): string => `${label} default text is required`;

export const VITALS_UNIT_INPUT_ORDERS = ['metric-imperial', 'imperial-metric'] as const;
export type VitalsUnitInputOrder = (typeof VITALS_UNIT_INPUT_ORDERS)[number];

export const DEFAULT_VITALS_UNIT_INPUT_ORDER: VitalsUnitInputOrder = 'metric-imperial';

export const SIGN_REVIEW_PROMPT_MAX_LENGTH = 4000;

export const VITALS_UNIT_INPUT_ORDER_LABELS: Record<VitalsUnitInputOrder, string> = {
  'metric-imperial': 'Metric / Imperial',
  'imperial-metric': 'Imperial / Metric',
};

export const VITALS_HEADER_UNIT_SYSTEMS = ['metric', 'imperial'] as const;
export type VitalsHeaderUnitSystem = (typeof VITALS_HEADER_UNIT_SYSTEMS)[number];

export const VITALS_HEADER_UNIT_SYSTEM_LABELS: Record<VitalsHeaderUnitSystem, string> = {
  metric: 'Metric',
  imperial: 'Imperial',
};

/**
 * The header followed the input order before it had its own setting, so a config saved without one
 * keeps showing the units its customer already sees.
 */
export const getDefaultVitalsHeaderUnitSystem = (inputOrder: VitalsUnitInputOrder): VitalsHeaderUnitSystem =>
  inputOrder === 'imperial-metric' ? 'imperial' : 'metric';

export interface ProgressNoteConfig {
  mdmRequired: boolean;
  medicalDecisionDefaultText: string;
  pcpNoTypeDispositionDefaultText: string;
  anotherDispositionDefaultText: string;
  edDispositionDefaultText: string;
  vitalsUnitInputOrder: VitalsUnitInputOrder;
  /** Units the visit header shows vitals in, independent of the order they are entered in. */
  vitalsHeaderUnitSystem: VitalsHeaderUnitSystem;
  /** AI note-review prompt shown at signing; empty/absent disables the feature. Edited by customer support only. */
  signReviewPrompt?: string;
}

export type GetProgressNoteConfigInput = Record<string, never>;
export type GetProgressNoteConfigOutput = ProgressNoteConfig;

export const UpdateProgressNoteConfigInputSchema = z.object({
  mdmRequired: z.boolean(),
  medicalDecisionDefaultText: z.string().trim().min(1, requiredDefaultTextMessage('Medical Decision Making')),
  pcpNoTypeDispositionDefaultText: z.string().trim().min(1, requiredDefaultTextMessage('Primary Care Physician')),
  anotherDispositionDefaultText: z.string().trim().min(1, requiredDefaultTextMessage('Transfer to Another Location')),
  edDispositionDefaultText: z.string().trim().min(1, requiredDefaultTextMessage('ED Transfer')),
  // Optional with a default so older Admin clients/scripts that omit this field keep working;
  // the read path applies the same default for stored configs that predate this setting.
  vitalsUnitInputOrder: z.enum(VITALS_UNIT_INPUT_ORDERS).default(DEFAULT_VITALS_UNIT_INPUT_ORDER),
  // Absent means "leave the stored setting alone", so an older client can't reset it.
  vitalsHeaderUnitSystem: z.enum(VITALS_HEADER_UNIT_SYSTEMS).optional(),
  // Bounded because the value is stored on a FHIR extension and prepended to every note-review
  // call; absent means "leave the stored prompt alone", an empty string is a deliberate clear.
  signReviewPrompt: z.string().max(SIGN_REVIEW_PROMPT_MAX_LENGTH).optional(),
});
export type UpdateProgressNoteConfigInput = z.infer<typeof UpdateProgressNoteConfigInputSchema>;

export const UpdateProgressNoteConfigInputValidatedSchema = UpdateProgressNoteConfigInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
  userToken: z.string(),
});
export type UpdateProgressNoteConfigInputValidated = z.infer<typeof UpdateProgressNoteConfigInputValidatedSchema>;
