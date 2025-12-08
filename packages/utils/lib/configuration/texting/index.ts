import _ from 'lodash';
import { TEXTING_OVERRIDES as OVERRIDES } from '../../../.ottehr_config';

const TEXTING_DEFAULTS_BASE = Object.freeze({
  invoicing: {
    smsMessage:
      'Thank you for visiting <clinic>. You have a balance of <amount>$. 💳 If we have your card on file, it will be billed on <due-date>. To use a different payment method, please pay the invoice before due date: <invoice-link>.',
    stripeMemoMessage:
      "Thank you for visiting <clinic>! 💳 If we have your card on file, it will be billed on <due-date>, and no action is needed. If you'd like to use a different payment method, please pay the invoice with your preferred method before due date.",
    dueDateInDays: 30,
  },
});

type TextingDefaults = typeof TEXTING_DEFAULTS_BASE;

const overrides: Partial<TextingDefaults> = OVERRIDES || {};

// todo: use mergeAndFreezeConfigObjects from helpers.ts
export const textingConfig = _.merge({ ...TEXTING_DEFAULTS_BASE }, { ...overrides });
