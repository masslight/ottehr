import z from 'zod';

/**
 * Forms Configuration Types
 *
 * These types define the contract for downloadable forms configuration,
 * such as worker's compensation forms and other legal documents.
 */

/**
 * Individual form item
 */
export interface FormItem {
  title: string;
  link: string;
}

export const FormItemSchema: z.ZodType<FormItem, z.ZodTypeDef, unknown> = z.object({
  title: z.string(),
  link: z.string(),
});

/**
 * Full forms configuration
 */
export interface FormsConfig {
  forms: FormItem[];
}

export const FormsConfigSchema: z.ZodType<FormsConfig, z.ZodTypeDef, unknown> = z.object({
  forms: z.array(FormItemSchema),
});
