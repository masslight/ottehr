import { DEFAULT_PROGRESS_NOTE_CONFIG } from 'utils';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/progress-note-config/admin-update-progress-note-config/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('admin-update-progress-note-config - validateRequestParameters', () => {
  test('should return validated params when all required progress note fields are provided', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      mdmRequired: false,
      medicalDecisionDefaultText: 'Updated MDM default.',
    });
    const result = validateRequestParameters(input);

    expect(result.mdmRequired).toBe(false);
    expect(result.medicalDecisionDefaultText).toBe('Updated MDM default.');
    expect(result.pcpNoTypeDispositionDefaultText).toBe(DEFAULT_PROGRESS_NOTE_CONFIG.pcpNoTypeDispositionDefaultText);
    expect(result.anotherDispositionDefaultText).toBe(DEFAULT_PROGRESS_NOTE_CONFIG.anotherDispositionDefaultText);
    expect(result.edDispositionDefaultText).toBe(DEFAULT_PROGRESS_NOTE_CONFIG.edDispositionDefaultText);
    expect(result.secrets).toBeNull();
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when mdmRequired is missing', () => {
    const { mdmRequired: _mdmRequired, ...bodyWithoutMdmRequired } = DEFAULT_PROGRESS_NOTE_CONFIG;
    const input = createMockZambdaInput(bodyWithoutMdmRequired);
    expect(() => validateRequestParameters(input)).toThrow('mdmRequired');
  });

  test('should throw when mdmRequired is not a boolean', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      mdmRequired: 'yes',
    });
    expect(() => validateRequestParameters(input)).toThrow('mdmRequired');
  });

  test('should pass secrets through from input', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput(DEFAULT_PROGRESS_NOTE_CONFIG, { secrets });
    const result = validateRequestParameters(input);
    expect(result.secrets).toEqual(secrets);
  });

  test('should throw when a required default text field is blank', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      medicalDecisionDefaultText: '   ',
    });
    expect(() => validateRequestParameters(input)).toThrow('default text is required');
  });

  test('should return the provided vitalsUnitInputOrder', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      vitalsUnitInputOrder: 'imperial-metric',
    });
    const result = validateRequestParameters(input);
    expect(result.vitalsUnitInputOrder).toBe('imperial-metric');
  });

  test('should default vitalsUnitInputOrder to metric-imperial when omitted (backward compatible)', () => {
    const { vitalsUnitInputOrder: _vitalsUnitInputOrder, ...bodyWithoutOrder } = DEFAULT_PROGRESS_NOTE_CONFIG;
    const input = createMockZambdaInput(bodyWithoutOrder);
    const result = validateRequestParameters(input);
    expect(result.vitalsUnitInputOrder).toBe('metric-imperial');
  });

  test('should throw when vitalsUnitInputOrder is not a valid option', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      vitalsUnitInputOrder: 'something-else',
    });
    expect(() => validateRequestParameters(input)).toThrow('vitalsUnitInputOrder');
  });
});
