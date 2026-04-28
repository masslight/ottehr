import z from 'zod';

export const VisionAutoCptCodesSchema = z.array(z.string());

export const ProviderConfigSchema = z.object({
  assessment: z.object({
    visionAutoCptCodes: VisionAutoCptCodesSchema.optional(),
  }),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
