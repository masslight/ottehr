import _ from 'lodash';
import { TEXTING_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides';

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
  },
});

type TextingDefaults = typeof TEXTING_DEFAULTS_BASE;

const overrides: Partial<TextingDefaults> = OVERRIDES || {};

// todo: use mergeAndFreezeConfigObjects from helpers.ts
export const textingConfig = _.merge({ ...TEXTING_DEFAULTS_BASE }, { ...overrides });
