import { TFunction } from 'i18next';

/**
 * The patient paperwork yup schema (packages/utils/lib/helpers/paperwork/validation.ts) emits
 * English validation messages as plain strings, which surface as per-field errors. That package
 * is framework-agnostic and can't localize them, so we map the known messages to i18n keys here
 * and translate them at the render layer (useFieldError). Unmapped messages pass through
 * unchanged, falling back to English.
 */
const VALIDATION_MESSAGE_KEYS: Record<string, string> = {
  'This field is required': 'pageFormsErrors.fieldRequired',
  'Please enter a valid date': 'pageFormsErrors.invalidDate',
  'Date may not be in the future': 'pageFormsErrors.futureDate',
  'Emojis are not a valid character': 'pageFormsErrors.emojis',
  'Item not found': 'pageFormsErrors.notFound',
  'Phone number must be 10 digits in the format (xxx) xxx-xxxx': 'pageFormsErrors.numberFormat',
  'Email is not valid': 'pageFormsErrors.emailInvalid',
  'Value must be one of the provided answer options': 'pageFormsErrors.invalidSelection',
};

export const translateValidationMessage = (t: TFunction, message?: string): string | undefined => {
  if (!message) {
    return message;
  }
  const key = VALIDATION_MESSAGE_KEYS[message];
  return key ? t(key, { defaultValue: message }) : message;
};
