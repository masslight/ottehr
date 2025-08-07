//import fs from 'fs';
import _ from 'lodash';
import * as z from 'zod';
import { CONFIG } from '../../../.ottehr_config';

const SENDGRID_DEFAULTS = Object.freeze({
  errorReport: {
    template: {
      templateName: 'Error Report',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './template_html/error-report.html',
      subject: '⚠️ An error occurred in {{environment}}', // done
      templateIdSecretName: 'SENDGRID_ERROR_REPORT_TEMPLATE_ID',
    },
  },
  inPersonCancelation: {
    template: {
      templateName: 'In-Person Cancellation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './configuration/sendgrid/template_html/in-person-cancelation.html',
      subject: 'Visit canceled', // done
      templateIdSecretName: 'SENDGRID_IN_PERSON_CANCELATION_TEMPLATE_ID',
    },
  },
  inPersonConfirmation: {
    template: {
      templateName: 'In-Person Confirmation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './configuration/sendgrid/template_html/in-person-confirmation.html',
      subject: 'Visit confirmed on {{readableTime}}', // done
      templateIdSecretName: 'SENDGRID_IN_PERSON_CONFIRMATION_TEMPLATE_ID',
    },
  },
  inPersonCompletion: {
    template: {
      templateName: 'In-Person Completion',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './configuration/sendgrid/template_html/in-person-completion.html',
      subject: 'Visit completed. See visit note', // done
      templateIdSecretName: 'SENDGRID_IN_PERSON_COMPLETION_TEMPLATE_ID',
    },
  },
  inPersonReminder: {
    template: {
      templateName: 'In-Person Reminder',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: 'packages/utils/configuration/sendgrid/template_html/in-person-reminder.html',
      subject: 'Upcoming visit on {{readableTime}}', // done
      templateIdSecretName: 'SENDGRID_IN_PERSON_REMINDER_TEMPLATE_ID',
    },
  },
  telemedCancelation: {
    template: {
      templateName: 'Telemed Cancelation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './template_html/telemed-cancelation.html',
      subject: 'Visit canceled', // done
      templateIdSecretName: 'SENDGRID_TELEMED_CANCELATION_TEMPLATE_ID',
    },
  },
  telemedConfirmation: {
    template: {
      templateName: 'Telemed Confirmation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './template_html/telemed-confirmation.html',
      subject: 'Join virtual visit', // done
      templateIdSecretName: 'SENDGRID_TELEMED_CONFIRMATION_TEMPLATE_ID',
    },
  },
  telemedCompletion: {
    template: {
      templateName: 'Telemed Completion',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './template_html/telemed-completion.html',
      subject: 'Visit completed. See visit note', // done
      templateIdSecretName: 'SENDGRID_TELEMED_COMPLETION_TEMPLATE_ID',
    },
  },
  telemedInvitation: {
    template: {
      templateName: 'Telemed Invitation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './template_html/telemed-invitation.html',
      subject: 'Join virtual visit with {{patientName}}', // done
      templateIdSecretName: 'SENDGRID_TELEMED_INVITATION_TEMPLATE_ID',
    },
  },
});

const TemplateVersionSchema = z.object({
  templateName: z.string().min(1, { message: 'Template name cannot be empty' }),
  templateVersionName: z.string().min(1, { message: 'Template version name cannot be empty' }),
  active: z.boolean().default(true),
  htmlFilePath: z.string().refine(
    (path) => {
      try {
        return path.endsWith('.html');
      } catch (e) {
        console.error('Error checking HTML file path:', e, path);
        return false;
      }
    },
    { message: 'No valid HTML file found at path' }
  ),
  subject: z.string().min(1, { message: 'Subject cannot be empty' }),
});

const ErrorReportSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_ERROR_REPORT_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
});
const InPersonCancelationSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_IN_PERSON_CANCELATION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
});
const InPersonConfirmationSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_IN_PERSON_CONFIRMATION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
});
const InPersonCompletionSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_IN_PERSON_COMPLETION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
});
const InPersonReminderSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_IN_PERSON_REMINDER_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
});
const TelemedCancelationSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_TELEMED_CANCELATION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
});
const TelemedConfirmationSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_TELEMED_CONFIRMATION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
});
const TelemedCompletionSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_TELEMED_COMPLETION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
});
const TelemedInvitationSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_TELEMED_INVITATION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
});

/*
const CustomEmailResourceSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.string().min(1, { message: 'Template ID secret name cannot be empty' }),
  disabled: z.boolean().default(false),
});
*/

const DefaultTemplates = z.object({
  errorReport: ErrorReportSchema,
  inPersonCancelation: InPersonCancelationSchema,
  inPersonConfirmation: InPersonConfirmationSchema,
  inPersonCompletion: InPersonCompletionSchema,
  inPersonReminder: InPersonReminderSchema,
  telemedCancelation: TelemedCancelationSchema,
  telemedConfirmation: TelemedConfirmationSchema,
  telemedCompletion: TelemedCompletionSchema,
  telemedInvitation: TelemedInvitationSchema,
});

const validatedSendgridDefaults = DefaultTemplates.parse(SENDGRID_DEFAULTS);

const overrides: any = CONFIG.sendgrid || {};

console.log('SendGrid overrides:', overrides);

const mergedSendgridConfig = _.merge(validatedSendgridDefaults, overrides);

export const SENDGRID_CONFIG = Object.freeze(DefaultTemplates.parse(mergedSendgridConfig));

console.log('Validated SendGrid defaults:', SENDGRID_CONFIG);
