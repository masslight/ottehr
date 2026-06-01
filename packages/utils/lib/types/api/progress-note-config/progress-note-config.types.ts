import { z } from 'zod';
import { Secrets } from '../../../secrets';

export interface ProgressNoteConfig {
  mdmRequired: boolean;
}

export type GetProgressNoteConfigInput = Record<string, never>;
export type GetProgressNoteConfigOutput = ProgressNoteConfig;

export const UpdateProgressNoteConfigInputSchema = z.object({
  mdmRequired: z.boolean(),
});
export type UpdateProgressNoteConfigInput = z.infer<typeof UpdateProgressNoteConfigInputSchema>;
export type UpdateProgressNoteConfigOutput = void;

export const UpdateProgressNoteConfigInputValidatedSchema = UpdateProgressNoteConfigInputSchema.extend({
  secrets: z.custom<Secrets>().nullable(),
});
export type UpdateProgressNoteConfigInputValidated = z.infer<typeof UpdateProgressNoteConfigInputValidatedSchema>;
