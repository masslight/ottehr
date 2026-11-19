import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/lab/in-house/create-in-house-lab-order/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const validBody = {
  encounterId: 'enc-1',
  testItems: [{ adUrl: 'https://example.com/ad', adVersion: '1' }],
  diagnosesAll: [],
  diagnosesNew: [],
};

const validate = (body: Record<string, unknown>): ReturnType<typeof validateRequestParameters> =>
  validateRequestParameters(createMockZambdaInput(body, { secrets: createMockSecrets() }));

describe('create-in-house-lab-order - validateRequestParameters', () => {
  test.each(['', '   ', '\n\t'])('drops blank notes (%j)', (notes) => {
    expect(validate({ ...validBody, notes }).notes).toBeUndefined();
  });

  test('keeps notes with surrounding spaces as typed', () => {
    expect(validate({ ...validBody, notes: '  repeat if hemolyzed ' }).notes).toBe('  repeat if hemolyzed ');
  });

  test('leaves notes undefined when not sent', () => {
    expect(validate(validBody).notes).toBeUndefined();
  });

  test('rejects notes that are not a string', () => {
    expect(() => validate({ ...validBody, notes: 42 })).toThrow('must be a string');
  });
});
