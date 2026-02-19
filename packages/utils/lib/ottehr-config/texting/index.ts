import _ from 'lodash';
import { BRANDING_CONFIG, replaceTemplateVariablesArrows } from 'utils';
import { z } from 'zod';
import { TEXTING_OVERRIDES } from '../../../ottehr-config-overrides';
import { mergeAndFreezeConfigObjects } from '../helpers';

const I18nQuickTextSchema = z.object({
  english: z.string(),
  spanish: z.string().optional(),
  when: z
    .object({
      appointmentTypes: z.array(z.string()).optional(),
    })
    .optional(),
});

const TextingConfigSchema = z.object({
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

const TEXTING_DEFAULTS_BASE = Object.freeze({
  invoicing: {
    smsMessage:
      "Thank you, <patient-full-name>, for visiting <clinic> at <location> on <visit-date>! 💳 If we have your card on file, it will be billed on <due-date>, and no action is needed. If you'd like to use a different payment method, please pay the invoice with your preferred method before due date: <invoice-link>",
    stripeMemoMessage:
      "Thank you, <patient-full-name>, for visiting <clinic> at <location> on <visit-date>! 💳 If we have your card on file, it will be billed on <due-date>, and no action is needed. If you'd like to use a different payment method, please pay the invoice with your preferred method before the due date. For more details about the visit, please, visit your patient portal, <url-to-patient-portal>",
    dueDateInDays: 30,
  },
  telemed: {
    inviteSms: `You have been invited to join a telemedicine visit with <patientName>. Please click <inviteUrl> to join.`,
    quickTexts: [
      `Hello from <projectName> Telemedicine. A provider will see you soon. Please have your child with you, seated & in a quiet room. Please be in an area where you have strong wifi connection sufficient for video use. Have your video turned on. Questions? Call <phone><supportPhone></phone>`,
      `Hello from <projectName> Telemedicine. Due to high volumes our providers are busier than usual. A provider will message you when they have an update or are ready to see you. We apologize for the delay. Questions? Call <phone><supportPhone></phone>`,
      `Hello from <projectName> Telemedicine. We tried connecting, you seem to be having trouble connecting. If you still want a visit, log out then log back in. Click “Return to call” and we will connect with you in 5-10 minutes. If you are still having trouble, call <phone><supportPhone></phone>`,
      `Hello from <projectName> Telemedicine. We are sorry you canceled your visit. If accidental, please request a new visit. We will be sure to see you. If you are experiencing technical difficulties, call <phone><supportPhone></phone>`,
    ],
  },
  inPerson: {
    quickTexts: [
      {
        english: `Please complete the paperwork and sign consent forms to avoid a delay in check-in. For <patientName>, click here: <visitUrl>`,
        // cSpell:disable-next Spanish
        spanish: `Complete la documentación y firme los formularios de consentimiento para evitar demoras en el registro. Para <patientName>, haga clic aquí: <visitUrl>`,
      },
      {
        english:
          'To prevent any delays with your pre-booked visit, please complete the digital paperwork fully in our new system.',
        spanish:
          // cSpell:disable-next Spanish
          'Para evitar demoras en su visita preprogramada, complete toda la documentación digital en nuestro nuevo sistema.',
      },
      {
        english: 'We are now ready to check you in. Please head to the front desk to complete the process.',
        // cSpell:disable-next Spanish
        spanish: 'Ahora estamos listos para registrarlo. Diríjase a la recepción para completar el proceso.',
      },
      {
        english: 'We are ready for the patient to be seen, please enter the facility.',
        // cSpell:disable-next Spanish
        spanish: 'Estamos listos para atender al paciente; ingrese al centro.',
      },
      {
        english: `<projectName> is trying to get ahold of you. Please call us at <officePhone> or respond to this text message.`,
        // cSpell:disable-next Spanish
        spanish: `<projectName> está intentando comunicarse con usted. Llámenos al <officePhone> o responda a este mensaje de texto.`,
      },
      {
        english: `<projectName> hopes you are feeling better. Please call us with any questions at <officePhone>.`,
        // cSpell:disable-next Spanish
        spanish: `<projectName> espera que se sienta mejor. Llámenos si tiene alguna pregunta al <officePhone>.`,
      },
      {
        english: `Please complete a brief AI chat session for <patientName> to help your provider prepare for your visit: <aiInterviewUrl>`,
        spanish: undefined,
      },
    ],
  },
} as const);

const mergedTextingConfig = mergeAndFreezeConfigObjects(TEXTING_DEFAULTS_BASE, TEXTING_OVERRIDES);

export const TEXTING_CONFIG = TextingConfigSchema.parse(mergedTextingConfig);

type InPersonQuickTextContext = {
  patientAppUrl?: string;
  patientName?: string;
  visitId: string;
  locationName?: string;
  start?: string;
  appointmentType?: string;
  officePhone?: string;
};

const matchesWhen = (when: { appointmentTypes?: string[] } | undefined, appointmentType?: string): boolean => {
  if (!when?.appointmentTypes) return true;
  return when.appointmentTypes.includes(appointmentType ?? '');
};

export const getInPersonQuickTexts = (
  ctx: InPersonQuickTextContext
): { english: string | undefined; spanish: string | undefined }[] => {
  const vars = {
    patientName: ctx.patientName ?? '',
    visitUrl: `${ctx.patientAppUrl}/visit/${ctx.visitId}`,
    aiInterviewUrl: `${ctx.patientAppUrl}/visit/${ctx.visitId}/ai-interview-start`,
    projectName: BRANDING_CONFIG.projectName,
    locationName: ctx.locationName ?? '',
    start: ctx.start ?? '',
    officePhone: ctx.officePhone ?? '',
  };

  return TEXTING_CONFIG.inPerson.quickTexts
    .filter((text) => matchesWhen(text.when, ctx.appointmentType))
    .map((text) => ({
      english: text.english ? replaceTemplateVariablesArrows(text.english, vars) : undefined,
      spanish: text.spanish ? replaceTemplateVariablesArrows(text.spanish, vars) : undefined,
    }));
};
