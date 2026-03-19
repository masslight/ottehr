import z from 'zod';

export const EmCodeOptionSchema = z.object({
  code: z.string(),
  display: z.string(),
});

export const EmCodeOptionsSchema = z.array(EmCodeOptionSchema);
export const VisionAutoCptCodesSchema = z.array(z.string());

export const ProviderConfigSchema = z.object({
  assessment: z.object({
    emCodeOptions: EmCodeOptionsSchema,
    visionAutoCptCodes: VisionAutoCptCodesSchema.optional().default([]),
  }),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
