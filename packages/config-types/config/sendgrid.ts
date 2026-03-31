import z from 'zod';

/**
 * SendGrid Email Template Configuration Types
 *
 * These types define the contract for email template configurations.
 * The actual validation schemas remain in utils because they use runtime
 * values for enum validation (e.g., dynamicTemplateData fields).
 */

/**
 * Template ID secret names - literal union of all supported template IDs
 */
export type SendgridTemplateIdSecretName =
  | 'SENDGRID_ERROR_REPORT_TEMPLATE_ID'
  | 'SENDGRID_IN_PERSON_CANCELATION_TEMPLATE_ID'
  | 'SENDGRID_IN_PERSON_CONFIRMATION_TEMPLATE_ID'
  | 'SENDGRID_IN_PERSON_COMPLETION_TEMPLATE_ID'
  | 'SENDGRID_IN_PERSON_REMINDER_TEMPLATE_ID'
  | 'SENDGRID_IN_PERSON_RECEIPT_TEMPLATE_ID'
  | 'SENDGRID_TELEMED_CANCELATION_TEMPLATE_ID'
  | 'SENDGRID_TELEMED_CONFIRMATION_TEMPLATE_ID'
  | 'SENDGRID_TELEMED_COMPLETION_TEMPLATE_ID'
  | 'SENDGRID_TELEMED_INVITATION_TEMPLATE_ID'
  | 'SENDGRID_ORDER_RESULT_ALERT_TEMPLATE_ID';

/**
 * Base email template configuration
 */
export interface EmailTemplateBase {
  templateName: string;
  templateVersionName: string;
  active: boolean;
  htmlFilePath: string;
  subject: string;
  templateIdSecretName: SendgridTemplateIdSecretName;
  dynamicTemplateData: string[];
  supportsAttachments?: boolean;
  disabled?: boolean;
}

/**
 * Schema for validating the base template structure
 */
export const EmailTemplateBaseSchema: z.ZodType<EmailTemplateBase, z.ZodTypeDef, unknown> = z.object({
  templateName: z.string().min(1),
  templateVersionName: z.string().min(1),
  active: z.boolean().default(true),
  htmlFilePath: z.string(),
  subject: z.string().min(1),
  templateIdSecretName: z.enum([
    'SENDGRID_ERROR_REPORT_TEMPLATE_ID',
    'SENDGRID_IN_PERSON_CANCELATION_TEMPLATE_ID',
    'SENDGRID_IN_PERSON_CONFIRMATION_TEMPLATE_ID',
    'SENDGRID_IN_PERSON_COMPLETION_TEMPLATE_ID',
    'SENDGRID_IN_PERSON_REMINDER_TEMPLATE_ID',
    'SENDGRID_IN_PERSON_RECEIPT_TEMPLATE_ID',
    'SENDGRID_TELEMED_CANCELATION_TEMPLATE_ID',
    'SENDGRID_TELEMED_CONFIRMATION_TEMPLATE_ID',
    'SENDGRID_TELEMED_COMPLETION_TEMPLATE_ID',
    'SENDGRID_TELEMED_INVITATION_TEMPLATE_ID',
    'SENDGRID_ORDER_RESULT_ALERT_TEMPLATE_ID',
  ]),
  dynamicTemplateData: z.array(z.string()),
  supportsAttachments: z.boolean().optional(),
  disabled: z.boolean().optional(),
});

/**
 * SendGrid templates configuration - known template keys
 */
export interface SendgridTemplates {
  errorReport: EmailTemplateBase;
  inPersonCancelation: EmailTemplateBase;
  inPersonConfirmation: EmailTemplateBase;
  inPersonCompletion: EmailTemplateBase;
  inPersonReminder: EmailTemplateBase;
  inPersonReceipt: EmailTemplateBase;
  telemedCancelation: EmailTemplateBase;
  telemedConfirmation: EmailTemplateBase;
  telemedCompletion: EmailTemplateBase;
  telemedInvitation: EmailTemplateBase;
  orderResultAlert: EmailTemplateBase;
}

/**
 * Full SendGrid configuration
 */
export interface SendgridConfig {
  templates: SendgridTemplates;
  featureFlag: boolean;
}

/**
 * Schema for SendgridTemplates
 */
export const SendgridTemplatesSchema: z.ZodType<SendgridTemplates, z.ZodTypeDef, unknown> = z.object({
  errorReport: EmailTemplateBaseSchema,
  inPersonCancelation: EmailTemplateBaseSchema,
  inPersonConfirmation: EmailTemplateBaseSchema,
  inPersonCompletion: EmailTemplateBaseSchema,
  inPersonReminder: EmailTemplateBaseSchema,
  inPersonReceipt: EmailTemplateBaseSchema,
  telemedCancelation: EmailTemplateBaseSchema,
  telemedConfirmation: EmailTemplateBaseSchema,
  telemedCompletion: EmailTemplateBaseSchema,
  telemedInvitation: EmailTemplateBaseSchema,
  orderResultAlert: EmailTemplateBaseSchema,
});

/**
 * Schema for SendgridConfig
 */
export const SendgridConfigSchema: z.ZodType<SendgridConfig, z.ZodTypeDef, unknown> = z.object({
  templates: SendgridTemplatesSchema,
  featureFlag: z.boolean().default(false),
});

/**
 * Utility type to create a record from dynamic template data fields
 * This maps each field name to a string value
 */
export type DynamicTemplateDataRecord<T extends EmailTemplateBase> = {
  [K in T['dynamicTemplateData'][number]]: string;
};

/**
 * Union type for any email template
 */
export type EmailTemplate = SendgridTemplates[keyof SendgridTemplates];
