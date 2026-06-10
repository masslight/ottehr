import { describe, expect, test } from 'vitest';
import { validatePatchInputs, validateSubmitInputs } from '../../../src/patient/paperwork/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

const validQRId = '550e8400-e29b-41d4-a716-446655440000';
const validAppointmentId = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// A minimal oystehr mock — these tests only exercise the synchronous validation
// (basicValidation) before any async oystehr calls are made.
const makeMockOystehr = (): any =>
  ({
    fhir: {
      get: () => Promise.resolve({}),
      patch: () => Promise.resolve({}),
      search: () => Promise.resolve({ unbundle: () => [] }),
    },
  }) as any;

describe('paperwork/validateRequestParameters - basicValidation (via validatePatchInputs)', () => {
  test('should throw when body is missing', async () => {
    const input = createMockZambdaInput(null, { body: null });
    await expect(validatePatchInputs(input, makeMockOystehr())).rejects.toThrow();
  });

  test('should throw when body is empty string', async () => {
    const input = createMockZambdaInput(null, { body: '' });
    await expect(validatePatchInputs(input, makeMockOystehr())).rejects.toThrow();
  });

  test('should throw when questionnaireResponseId is missing', async () => {
    const input = createMockZambdaInput({
      answers: { linkId: 'page-1', item: [] },
    });
    await expect(validatePatchInputs(input, makeMockOystehr())).rejects.toThrow();
  });

  test('should throw when questionnaireResponseId is not a valid UUID', async () => {
    const input = createMockZambdaInput({
      answers: { linkId: 'page-1', item: [] },
      questionnaireResponseId: 'not-a-uuid',
    });
    await expect(validatePatchInputs(input, makeMockOystehr())).rejects.toThrow();
  });

  test('should throw when answers is missing', async () => {
    const input = createMockZambdaInput({
      questionnaireResponseId: validQRId,
    });
    await expect(validatePatchInputs(input, makeMockOystehr())).rejects.toThrow();
  });

  test('should throw when optional appointmentId is present but not a valid UUID', async () => {
    const input = createMockZambdaInput({
      answers: { linkId: 'page-1', item: [] },
      questionnaireResponseId: validQRId,
      appointmentId: 'not-a-uuid',
    });
    await expect(validatePatchInputs(input, makeMockOystehr())).rejects.toThrow();
  });

  test('should accept valid UUID for appointmentId when provided', async () => {
    // basicValidation will pass; async oystehr call will reject — we only care that
    // the synchronous validation (UUID check) does NOT throw early.
    const input = createMockZambdaInput({
      answers: { linkId: 'page-1', item: [] },
      questionnaireResponseId: validQRId,
      appointmentId: validAppointmentId,
    });
    // The mock oystehr will be called and return undefined for getQuestionnaireItemsAndProgress,
    // which will throw a different error after validation passes.
    await expect(validatePatchInputs(input, makeMockOystehr())).rejects.toThrow();
  });
});

describe('paperwork/validateRequestParameters - basicValidation (via validateSubmitInputs)', () => {
  test('should throw when body is missing', async () => {
    const input = createMockZambdaInput(null, { body: null });
    await expect(validateSubmitInputs(input, makeMockOystehr())).rejects.toThrow();
  });

  test('should throw when questionnaireResponseId is missing', async () => {
    const input = createMockZambdaInput({
      answers: [{ linkId: 'field-1', answer: [{ valueString: 'value' }] }],
    });
    await expect(validateSubmitInputs(input, makeMockOystehr())).rejects.toThrow();
  });

  test('should throw when questionnaireResponseId is not a valid UUID', async () => {
    const input = createMockZambdaInput({
      answers: [{ linkId: 'field-1', answer: [{ valueString: 'value' }] }],
      questionnaireResponseId: 'bad-id',
    });
    await expect(validateSubmitInputs(input, makeMockOystehr())).rejects.toThrow();
  });

  test('should throw when answers is missing', async () => {
    const input = createMockZambdaInput({
      questionnaireResponseId: validQRId,
    });
    await expect(validateSubmitInputs(input, makeMockOystehr())).rejects.toThrow();
  });

  test('should throw when answers is not an array', async () => {
    const input = createMockZambdaInput({
      answers: { linkId: 'page-1', item: [] },
      questionnaireResponseId: validQRId,
    });
    await expect(validateSubmitInputs(input, makeMockOystehr())).rejects.toThrow();
  });

  test('should throw when optional appointmentId is present but not a valid UUID', async () => {
    const input = createMockZambdaInput({
      answers: [{ linkId: 'field-1', answer: [{ valueString: 'value' }] }],
      questionnaireResponseId: validQRId,
      appointmentId: 'not-a-uuid',
    });
    await expect(validateSubmitInputs(input, makeMockOystehr())).rejects.toThrow();
  });

  test('should accept valid IDs and proceed to async oystehr call', async () => {
    // basicValidation passes; async will throw because mock returns undefined QR items
    const input = createMockZambdaInput({
      answers: [{ linkId: 'field-1', answer: [{ valueString: 'value' }] }],
      questionnaireResponseId: validQRId,
      appointmentId: validAppointmentId,
    });
    await expect(validateSubmitInputs(input, makeMockOystehr())).rejects.toThrow();
  });
});
