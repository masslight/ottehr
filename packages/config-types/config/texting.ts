import z from 'zod';

/**
 * Texting Configuration Types
 *
 * Defines the contract for SMS texting configurations,
 * including invoicing messages and telemed invites.
 */

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
}

/**
 * Full texting configuration
 */
export interface TextingConfig {
  invoicing: TextingInvoicingConfig;
  telemed: TextingTelemedConfig;
}

export const TextingConfigSchema: z.ZodType<TextingConfig, z.ZodTypeDef, unknown> = z.object({
  invoicing: z.object({
    smsMessage: z.string(),
    stripeMemoMessage: z.string(),
    dueDateInDays: z.number(),
  }),
  telemed: z.object({
    inviteSms: z.string(),
  }),
});
