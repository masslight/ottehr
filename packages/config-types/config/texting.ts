import z from 'zod';

/**
 * Texting Configuration Types
 *
 * These types define the contract for SMS texting configurations,
 * including invoicing messages, telemed invites, and quick text templates.
 */

/**
 * Conditional display configuration for quick texts
 */
export interface QuickTextWhen {
  appointmentTypes?: string[];
}

/**
 * Internationalized quick text with English and optional Spanish
 */
export interface I18nQuickText {
  english: string;
  spanish?: string;
  when?: QuickTextWhen;
}

export const I18nQuickTextSchema: z.ZodType<I18nQuickText, z.ZodTypeDef, unknown> = z.object({
  english: z.string(),
  spanish: z.string().optional(),
  when: z
    .object({
      appointmentTypes: z.array(z.string()).optional(),
    })
    .optional(),
});

/**
 * Invoicing SMS configuration
 */
export interface TextingInvoicingConfig {
  smsMessage: string;
  stripeMemoMessage: string;
  dueDateInDays: number;
}

/**
 * Telemed texting configuration
 */
export interface TextingTelemedConfig {
  inviteSms: string;
  quickTexts: string[];
}

/**
 * In-person texting configuration
 */
export interface TextingInPersonConfig {
  quickTexts: I18nQuickText[];
}

/**
 * Full texting configuration
 */
export interface TextingConfig {
  invoicing: TextingInvoicingConfig;
  telemed: TextingTelemedConfig;
  inPerson: TextingInPersonConfig;
}

export const TextingConfigSchema: z.ZodType<TextingConfig, z.ZodTypeDef, unknown> = z.object({
  invoicing: z.object({
    smsMessage: z.string(),
    stripeMemoMessage: z.string(),
    dueDateInDays: z.number(),
  }),
  telemed: z.object({
    inviteSms: z.string(),
    quickTexts: z.array(z.string()),
  }),
  inPerson: z.object({
    quickTexts: z.array(I18nQuickTextSchema),
  }),
});
