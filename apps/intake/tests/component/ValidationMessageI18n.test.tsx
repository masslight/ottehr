import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { translateValidationMessage } from '../../src/features/paperwork/validationMessages';
import i18n from '../../src/lib/i18n';

beforeEach(async () => {
  await i18n.changeLanguage('en');
});

afterEach(async () => {
  await i18n.changeLanguage('en');
});

describe('per-field validation message translation', () => {
  test('translates known yup schema messages to Spanish', async () => {
    await i18n.changeLanguage('es');
    expect(translateValidationMessage(i18n.t, 'This field is required')).toBe('Este campo es requierido');
    expect(translateValidationMessage(i18n.t, 'Please enter a valid date')).toBe('Por favor, provea una fecha válida');
  });

  test('returns English when the active language is English', () => {
    expect(translateValidationMessage(i18n.t, 'This field is required')).toBe('This field is required');
  });

  test('passes through unmapped or empty messages unchanged', async () => {
    await i18n.changeLanguage('es');
    expect(translateValidationMessage(i18n.t, 'Some bespoke server error')).toBe('Some bespoke server error');
    expect(translateValidationMessage(i18n.t, undefined)).toBeUndefined();
  });
});
