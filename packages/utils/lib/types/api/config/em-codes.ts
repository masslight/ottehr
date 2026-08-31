import { z } from 'zod';

export const EmCodeOptionSchema = z.object({
  code: z.string(),
  display: z.string(),
});

export const CreateEmCodeInputSchema = z.object({
  code: z.string().trim().min(1, 'code is required'),
  display: z.string().trim().min(1, 'display is required'),
});

export const UpdateEmCodeInputSchema = z.object({
  code: z.string().trim().min(1, 'code is required'),
  display: z.string().trim().min(1, 'display is required'),
});

export const DeleteEmCodeInputSchema = z.object({
  code: z.string().trim().min(1, 'code is required'),
});

export type CreateEmCodeInput = z.infer<typeof CreateEmCodeInputSchema>;
export type UpdateEmCodeInput = z.infer<typeof UpdateEmCodeInputSchema>;
export type DeleteEmCodeInput = z.infer<typeof DeleteEmCodeInputSchema>;
export type EmCodeOption = z.infer<typeof EmCodeOptionSchema>;

export interface EmCodeOutput {
  codes: EmCodeOption[];
}
