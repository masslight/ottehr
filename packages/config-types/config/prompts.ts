import z from 'zod';

export interface PromptsConfig {
  HPI_SUGGESTION: string;
}

export const PromptsConfigSchema: z.ZodType<PromptsConfig, z.ZodTypeDef, unknown> = z.object({
  HPI_SUGGESTION: z.string(),
});
