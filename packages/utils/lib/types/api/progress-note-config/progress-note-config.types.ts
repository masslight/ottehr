import { z } from 'zod';
import { Secrets } from '../../../secrets';

const requiredDefaultTextMessage = (label: string): string => `${label} default text is required`;

export interface ProgressNoteConfig {
  mdmRequired: boolean;
  medicalDecisionDefaultText: string;
  pcpNoTypeDispositionDefaultText: string;
  anotherDispositionDefaultText: string;
  edDispositionDefaultText: string;
}

export type GetProgressNoteConfigInput = Record<string, never>;
export type GetProgressNoteConfigOutput = ProgressNoteConfig;

export const UpdateProgressNoteConfigInputSchema = z.object({
  mdmRequired: z.boolean(),
  medicalDecisionDefaultText: z.string().trim().min(1, requiredDefaultTextMessage('Medical Decision Making')),
  pcpNoTypeDispositionDefaultText: z.string().trim().min(1, requiredDefaultTextMessage('Primary Care Physician')),
  anotherDispositionDefaultText: z.string().trim().min(1, requiredDefaultTextMessage('Transfer to Another Location')),
  edDispositionDefaultText: z.string().trim().min(1, requiredDefaultTextMessage('ED Transfer')),
});
export type UpdateProgressNoteConfigInput = z.infer<typeof UpdateProgressNoteConfigInputSchema>;

export const UpdateProgressNoteConfigInputValidatedSchema = UpdateProgressNoteConfigInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
  userToken: z.string(),
});
export type UpdateProgressNoteConfigInputValidated = z.infer<typeof UpdateProgressNoteConfigInputValidatedSchema>;
