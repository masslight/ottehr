import type { TextingConfig } from 'config-types';
import { deepFreezeObject } from '../../utils/objects';

const TEXTING_DATA: TextingConfig = {
  invoicing: {
    smsMessage:
      "Thank you, <patient-full-name>, for visiting <clinic> at <location> on <visit-date>! \u{1F4B3} If we have your card on file, it will be billed on <due-date>, and no action is needed. If you'd like to use a different payment method, please pay the invoice with your preferred method before due date: <invoice-link>",
    stripeMemoMessage:
      "Thank you, <patient-full-name>, for visiting <clinic> at <location> on <visit-date>! \u{1F4B3} If we have your card on file, it will be billed on <due-date>, and no action is needed. If you'd like to use a different payment method, please pay the invoice with your preferred method before the due date. For more details about the visit, please, visit your patient portal, <url-to-patient-portal>",
    dueDateInDays: 30,
  },
  telemed: {
    inviteSms: `You have been invited to join a telemedicine visit with <patientName>. Please click <inviteUrl> to join.`,
  },
};

export const TEXTING_CONFIG = deepFreezeObject(TEXTING_DATA);
