import z from 'zod';

export const EmCodeOptionSchema = z.object({
  code: z.string(),
  display: z.string(),
});

export const EmCodesSchema = z.array(EmCodeOptionSchema);

export const ProviderConfigSchema = z.object({
  assessment: z.object({
    emCodes: EmCodesSchema,
  }),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
