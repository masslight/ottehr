import z from 'zod';

export const EmCodeOptionSchema = z.object({
  code: z.string(),
  display: z.string(),
});

export const EmCodeOptionsSchema = z.array(EmCodeOptionSchema);

export const ProviderConfigSchema = z.object({
  assessment: z.object({
    emCodeOptions: EmCodeOptionsSchema,
  }),
});

export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
