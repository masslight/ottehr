//import fs from 'fs';
import _ from 'lodash';
import * as z from 'zod';
import { OVERRIDES } from '../../../.ottehr_config';

// this is relative to the deploy folder where tf runs
const PATH_PREFIX = '../packages/utils/lib';

const SENDGRID_DEFAULTS = Object.freeze({
  templates: {
    errorReport: {
      templateName: 'Error Report',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: `${PATH_PREFIX}/configuration/sendgrid/template_html/error-report.html`,
      subject: '⚠️ An error occurred in {{environment}}', // done
      templateIdSecretName: 'SENDGRID_ERROR_REPORT_TEMPLATE_ID',
      dynamicTemplateData: ['environment', 'error-message', 'timestamp'],
    },
    inPersonCancelation: {
      templateName: 'In-Person Cancellation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: `${PATH_PREFIX}/configuration/sendgrid/template_html/in-person-cancelation.html`,
      subject: 'Visit canceled', // done
      templateIdSecretName: 'SENDGRID_IN_PERSON_CANCELATION_TEMPLATE_ID',
      dynamicTemplateData: ['location', 'time', 'address', 'book-again-url', 'address-url'],
    },
    inPersonConfirmation: {
      templateName: 'In-Person Confirmation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: `${PATH_PREFIX}/configuration/sendgrid/template_html/in-person-confirmation.html`,
      subject: 'Visit confirmed on {{{time}}}', // done
      templateIdSecretName: 'SENDGRID_IN_PERSON_CONFIRMATION_TEMPLATE_ID',
      dynamicTemplateData: [
        'location',
        'time',
        'address',
        'address-url',
        'modify-visit-url',
        'cancel-visit-url',
        'paperwork-url',
      ],
    },
    inPersonCompletion: {
      templateName: 'In-Person Completion',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: `${PATH_PREFIX}/configuration/sendgrid/template_html/in-person-completion.html`,
      subject: 'Visit completed. See visit note', // done
      templateIdSecretName: 'SENDGRID_IN_PERSON_COMPLETION_TEMPLATE_ID',
      dynamicTemplateData: ['location', 'time', 'address', 'visit-note-url', 'address-url'],
    },
    inPersonReminder: {
      templateName: 'In-Person Reminder',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: `${PATH_PREFIX}/configuration/sendgrid/template_html/in-person-reminder.html`,
      subject: 'Upcoming visit on {{{time}}}', // done
      templateIdSecretName: 'SENDGRID_IN_PERSON_REMINDER_TEMPLATE_ID',
      dynamicTemplateData: [
        'location',
        'time',
        'address',
        'modify-visit-url',
        'cancel-visit-url',
        'address-url',
        'paperwork-url',
      ],
    },
    telemedCancelation: {
      templateName: 'Telemed Cancelation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: `${PATH_PREFIX}/configuration/sendgrid/template_html/telemed-cancelation.html`,
      subject: 'Visit canceled', // done
      templateIdSecretName: 'SENDGRID_TELEMED_CANCELATION_TEMPLATE_ID',
      dynamicTemplateData: ['location', 'book-again-url'],
    },
    telemedConfirmation: {
      templateName: 'Telemed Confirmation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: `${PATH_PREFIX}/configuration/sendgrid/template_html/telemed-confirmation.html`,
      subject: 'Join virtual visit', // done
      templateIdSecretName: 'SENDGRID_TELEMED_CONFIRMATION_TEMPLATE_ID',
      dynamicTemplateData: ['location', 'join-visit-url', 'cancel-visit-url', 'paperwork-url'],
    },
    telemedCompletion: {
      templateName: 'Telemed Completion',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: `${PATH_PREFIX}/configuration/sendgrid/template_html/telemed-completion.html`,
      subject: 'Visit completed. See visit note', // done
      templateIdSecretName: 'SENDGRID_TELEMED_COMPLETION_TEMPLATE_ID',
      dynamicTemplateData: ['location', 'visit-note-url'],
    },
    telemedInvitation: {
      templateName: 'Telemed Invitation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: `${PATH_PREFIX}/configuration/sendgrid/template_html/telemed-invitation.html`,
      subject: 'Join virtual visit with {{patient-name}}', // done
      templateIdSecretName: 'SENDGRID_TELEMED_INVITATION_TEMPLATE_ID',
      dynamicTemplateData: ['patient-name', 'join-visit-url'],
    },
  },
});

const overrides: any = OVERRIDES.sendgrid || {};

const mergedSendgridConfig = _.merge({ ...SENDGRID_DEFAULTS }, { ...overrides });
// console.log('Merged SendGrid config:', mergedSendgridConfig);

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
  dynamicTemplateData: z.array(z.string()).default([]).optional(),
});

const ErrorReportSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_ERROR_REPORT_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
  dynamicTemplateData: z.array(z.enum(mergedSendgridConfig.templates.errorReport.dynamicTemplateData)),
});
const InPersonCancelationSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_IN_PERSON_CANCELATION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
  dynamicTemplateData: z.array(z.enum(mergedSendgridConfig.templates.inPersonCancelation.dynamicTemplateData)),
});
const InPersonConfirmationSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_IN_PERSON_CONFIRMATION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
  dynamicTemplateData: z.array(z.enum(mergedSendgridConfig.templates.inPersonConfirmation.dynamicTemplateData)),
});
const InPersonCompletionSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_IN_PERSON_COMPLETION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
  dynamicTemplateData: z.array(z.enum(mergedSendgridConfig.templates.inPersonCompletion.dynamicTemplateData)),
});
const InPersonReminderSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_IN_PERSON_REMINDER_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
  dynamicTemplateData: z.array(z.enum(mergedSendgridConfig.templates.inPersonReminder.dynamicTemplateData)),
});
const TelemedCancelationSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_TELEMED_CANCELATION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
  dynamicTemplateData: z.array(z.enum(mergedSendgridConfig.templates.telemedCancelation.dynamicTemplateData)),
});
const TelemedConfirmationSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_TELEMED_CONFIRMATION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
  dynamicTemplateData: z.array(z.enum(mergedSendgridConfig.templates.telemedConfirmation.dynamicTemplateData)),
});
const TelemedCompletionSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_TELEMED_COMPLETION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
  dynamicTemplateData: z.array(z.enum(mergedSendgridConfig.templates.telemedCompletion.dynamicTemplateData)),
});
const TelemedInvitationSchema = TemplateVersionSchema.extend({
  templateIdSecretName: z.literal('SENDGRID_TELEMED_INVITATION_TEMPLATE_ID'),
  disabled: z.boolean().default(false),
  dynamicTemplateData: z.array(z.enum(mergedSendgridConfig.templates.telemedInvitation.dynamicTemplateData)),
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

const SENDGRID_CONFIG_SCHEMA = z.object({
  templates: DefaultTemplates,
  featureFlag: z.boolean().default(false),
});

export const SENDGRID_CONFIG = Object.freeze(SENDGRID_CONFIG_SCHEMA.parse(mergedSendgridConfig));
export type SendgridConfig = z.infer<typeof SENDGRID_CONFIG_SCHEMA>;
export type EmailTemplate = SendgridConfig['templates'][keyof SendgridConfig['templates']];

export type DynamicTemplateDataRecord<T extends EmailTemplate> = Record<
  Extract<T['dynamicTemplateData'] extends Array<infer K> ? K : never, string>,
  string
>;
