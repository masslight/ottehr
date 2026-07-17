import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/upload-dot-vision-document/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('upload-dot-vision-document - validateRequestParameters', () => {
  const secrets = createMockSecrets();
  const appointmentID = 'appointment-1';
  const z3URL = 'https://z3/upload/referral.pdf';

  test('returns validated params for a valid request', () => {
    const input = createMockZambdaInput({ appointmentID, z3URL, title: 'referral.pdf' }, { secrets });
    expect(validateRequestParameters(input)).toEqual({
      appointmentID,
      z3URL,
      title: 'referral.pdf',
      secrets,
    });
  });

  test('title is optional and defaults to undefined', () => {
    const input = createMockZambdaInput({ appointmentID, z3URL }, { secrets });
    expect(validateRequestParameters(input).title).toBeUndefined();
  });

  test('throws when appointmentID is missing', () => {
    const input = createMockZambdaInput({ z3URL }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws when z3URL is missing', () => {
    const input = createMockZambdaInput({ appointmentID }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws when appointmentID is not a string', () => {
    const input = createMockZambdaInput({ appointmentID: 42, z3URL }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws when title is provided but not a string', () => {
    const input = createMockZambdaInput({ appointmentID, z3URL, title: 123 }, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws when the body is missing', () => {
    const input = createMockZambdaInput(null, { secrets });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('throws when secrets are missing', () => {
    const input = createMockZambdaInput({ appointmentID, z3URL }, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow();
  });
});
