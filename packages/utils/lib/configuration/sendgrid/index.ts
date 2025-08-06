//import fs from 'fs';
import _ from 'lodash';
import * as z from 'zod';
import { CONFIG } from '../../../.ottehr_config';

const SENDGRID_DEFAULTS = Object.freeze({
  errorReport: {
    template: {
      templateId: 'error-report',
      templateName: 'Error Report',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './template_html/error-report.html',
      subject: '⚠️ An error occurred in {{environment}}', // done
    },
  },
  inPersonCancelation: {
    template: {
      templateId: 'in-person-cancelation',
      templateName: 'In-Person Cancellation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './configuration/sendgrid/template_html/in-person-cancelation.html',
      subject: 'Visit canceled', // done
    },
  },
  inPersonConfirmation: {
    template: {
      templateId: 'in-person-confirmation',
      templateName: 'In-Person Confirmation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './configuration/sendgrid/template_html/in-person-confirmation.html',
      subject: 'Visit confirmed on {{readableTime}}', // done
    },
  },
  inPersonCompletion: {
    template: {
      templateId: 'in-person-completion',
      templateName: 'In-Person Completion',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './configuration/sendgrid/template_html/in-person-completion.html',
      subject: 'Visit completed. See visit note', // done
    },
  },
  inPersonReminder: {
    template: {
      templateId: 'in-person-reminder',
      templateName: 'In-Person Reminder',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: 'packages/utils/configuration/sendgrid/template_html/in-person-reminder.html',
      subject: 'Upcoming visit on {{readableTime}}', // done
    },
  },
  telemedCancelation: {
    template: {
      templateId: 'telemed-cancelation',
      templateName: 'Telemed Cancelation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './template_html/telemed-cancelation.html',
      subject: 'Visit canceled', // done
    },
  },
  telemedConfirmation: {
    template: {
      templateId: 'telemed-confirmation',
      templateName: 'Telemed Confirmation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './template_html/telemed-confirmation.html',
      subject: 'Join virtual visit', // done
    },
  },
  telemedCompletion: {
    template: {
      templateId: 'telemed-completion',
      templateName: 'Telemed Completion',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './template_html/telemed-completion.html',
      subject: 'Visit completed. See visit note', // done
    },
  },
  telemedInvitation: {
    template: {
      templateId: 'telemed-invitation',
      templateName: 'Telemed Invitation',
      templateVersionName: '1.0.0',
      active: true,
      htmlFilePath: './template_html/telemed-invitation.html',
      subject: 'Join virtual visit with {{patientName}}', // done
    },
  },
});

const TemplateVersionSchema = z.object({
  templateId: z.string().min(1, { message: 'Template ID cannot be empty' }),
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

const EmailResourceSchema = z.object({
  template: TemplateVersionSchema,
  disabled: z.boolean().default(false),
});

const DefaultTemplates = z.object({
  errorReport: EmailResourceSchema,
  inPersonCancelation: EmailResourceSchema,
  inPersonConfirmation: EmailResourceSchema,
  inPersonCompletion: EmailResourceSchema,
  inPersonReminder: EmailResourceSchema,
  telemedCancelation: EmailResourceSchema,
  telemedConfirmation: EmailResourceSchema,
  telemedCompletion: EmailResourceSchema,
  telemedInvitation: EmailResourceSchema,
});

const validatedSendgridDefaults = DefaultTemplates.parse(SENDGRID_DEFAULTS);

const overrides: any = CONFIG.sendgrid || {};

console.log('SendGrid overrides:', overrides);

const mergedSendgridConfig = _.merge(validatedSendgridDefaults, overrides);

export const SENDGRID_CONFIG = Object.freeze(DefaultTemplates.parse(mergedSendgridConfig));

console.log('Validated SendGrid defaults:', SENDGRID_CONFIG);
