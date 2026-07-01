import { z } from 'zod';
import { Secrets } from '../../../secrets';

const requiredDefaultTextMessage = (label: string): string => `${label} default text is required`;

export const VITALS_UNIT_INPUT_ORDERS = ['metric-imperial', 'imperial-metric'] as const;
export type VitalsUnitInputOrder = (typeof VITALS_UNIT_INPUT_ORDERS)[number];

export const DEFAULT_VITALS_UNIT_INPUT_ORDER: VitalsUnitInputOrder = 'metric-imperial';

export const VITALS_UNIT_INPUT_ORDER_LABELS: Record<VitalsUnitInputOrder, string> = {
  'metric-imperial': 'Metric / Imperial',
  'imperial-metric': 'Imperial / Metric',
};

export interface ProgressNoteConfig {
  mdmRequired: boolean;
  medicalDecisionDefaultText: string;
  pcpNoTypeDispositionDefaultText: string;
  anotherDispositionDefaultText: string;
  edDispositionDefaultText: string;
  vitalsUnitInputOrder: VitalsUnitInputOrder;
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
});
export type UpdateProgressNoteConfigInput = z.infer<typeof UpdateProgressNoteConfigInputSchema>;

export const UpdateProgressNoteConfigInputValidatedSchema = UpdateProgressNoteConfigInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
  userToken: z.string(),
});
export type UpdateProgressNoteConfigInputValidated = z.infer<typeof UpdateProgressNoteConfigInputValidatedSchema>;
