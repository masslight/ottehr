import { SIGN_REVIEW_PROMPT_MAX_LENGTH } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { DEFAULT_PROGRESS_NOTE_CONFIG } from 'utils/lib/utils/progress-note-config';
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

  test('should return the provided vitalsHeaderUnitSystem', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      vitalsHeaderUnitSystem: 'imperial',
    });
    expect(validateRequestParameters(input).vitalsHeaderUnitSystem).toBe('imperial');
  });

  test('should leave vitalsHeaderUnitSystem undefined when omitted, so the stored setting is left alone', () => {
    const { vitalsHeaderUnitSystem: _vitalsHeaderUnitSystem, ...bodyWithoutHeaderUnits } = DEFAULT_PROGRESS_NOTE_CONFIG;
    const input = createMockZambdaInput(bodyWithoutHeaderUnits);
    expect(validateRequestParameters(input).vitalsHeaderUnitSystem).toBeUndefined();
  });

  test('should throw when vitalsHeaderUnitSystem is not a valid option', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      vitalsHeaderUnitSystem: 'cubits',
    });
    expect(() => validateRequestParameters(input)).toThrow('vitalsHeaderUnitSystem');
  });

  test('should leave signReviewPrompt undefined when omitted, so the stored prompt is left alone', () => {
    const { signReviewPrompt: _signReviewPrompt, ...bodyWithoutPrompt } = DEFAULT_PROGRESS_NOTE_CONFIG;
    const input = createMockZambdaInput(bodyWithoutPrompt);
    expect(validateRequestParameters(input).signReviewPrompt).toBeUndefined();
  });

  test('should leave specialtyTransferOptions undefined when omitted, so the stored list is left alone', () => {
    const { specialtyTransferOptions: _specialtyTransferOptions, ...bodyWithoutSpecialties } =
      DEFAULT_PROGRESS_NOTE_CONFIG;
    const input = createMockZambdaInput(bodyWithoutSpecialties);
    expect(validateRequestParameters(input).specialtyTransferOptions).toBeUndefined();
  });

  test('should trim specialtyTransferOptions entries', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      specialtyTransferOptions: ['  Urology ', 'ENT'],
    });
    expect(validateRequestParameters(input).specialtyTransferOptions).toEqual(['Urology', 'ENT']);
  });

  test('should collapse runs of whitespace inside specialtyTransferOptions entries', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      specialtyTransferOptions: ['Sports  Medicine', ' Ear\t\tNose \n Throat '],
    });
    expect(validateRequestParameters(input).specialtyTransferOptions).toEqual(['Sports Medicine', 'Ear Nose Throat']);
  });

  test('should throw when specialties differ only in inner whitespace and case', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      specialtyTransferOptions: ['Sports Medicine', 'sports  medicine'],
    });
    expect(() => validateRequestParameters(input)).toThrow('Specialty is already in the list');
  });

  test('should throw when a specialty is blank', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      specialtyTransferOptions: ['Urology', '  '],
    });
    expect(() => validateRequestParameters(input)).toThrow('Specialty is required');
  });

  test('should throw when specialtyTransferOptions is empty', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      specialtyTransferOptions: [],
    });
    expect(() => validateRequestParameters(input)).toThrow('At least one specialty is required');
  });

  test('should throw when a specialty is listed twice, ignoring case', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      specialtyTransferOptions: ['ENT', 'ent'],
    });
    expect(() => validateRequestParameters(input)).toThrow('Specialty is already in the list');
  });

  test('should throw when "Other" is listed, since it is always offered', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      specialtyTransferOptions: ['ENT', 'other'],
    });
    expect(() => validateRequestParameters(input)).toThrow('"Other" is always offered');
  });

  test('should throw when signReviewPrompt exceeds the maximum length', () => {
    const input = createMockZambdaInput({
      ...DEFAULT_PROGRESS_NOTE_CONFIG,
      signReviewPrompt: 'x'.repeat(SIGN_REVIEW_PROMPT_MAX_LENGTH + 1),
    });
    expect(() => validateRequestParameters(input)).toThrow('signReviewPrompt');
  });
});
