import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/search-patients/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('search-patients validation', () => {
  it('throws when the Authorization header is missing', () => {
    expect(() =>
      validateRequestParameters(createMockZambdaInput({ name: 'Ada' }, { headers: null, secrets: createMockSecrets() }))
    ).toThrow();
  });

  it('throws when secrets are missing', () => {
    expect(() => validateRequestParameters(createMockZambdaInput({ name: 'Ada' }, { secrets: null }))).toThrow();
  });

  it('accepts a request with no body', () => {
    const result = validateRequestParameters(createMockZambdaInput(null, { secrets: createMockSecrets() }));
    expect(result.name).toBeUndefined();
    expect(result.secrets).toEqual(createMockSecrets());
  });

  it('accepts name, dateOfBirth, phone, and email filters', () => {
    const result = validateRequestParameters(
      createMockZambdaInput(
        { name: 'Example Patient', dateOfBirth: '1990-01-01', phone: '+15555555555', email: 'example@masslight.com' },
        { secrets: createMockSecrets() }
      )
    );
    expect(result).toMatchObject({
      name: 'Example Patient',
      dateOfBirth: '1990-01-01',
      phone: '+15555555555',
      email: 'example@masslight.com',
    });
  });

  it('accepts an offset', () => {
    const result = validateRequestParameters(createMockZambdaInput({ offset: 30 }, { secrets: createMockSecrets() }));
    expect(result.offset).toBe(30);
  });

  it('rejects a negative offset', () => {
    expect(() =>
      validateRequestParameters(createMockZambdaInput({ offset: -1 }, { secrets: createMockSecrets() }))
    ).toThrow();
  });

  it('rejects an empty-string name', () => {
    expect(() =>
      validateRequestParameters(createMockZambdaInput({ name: '' }, { secrets: createMockSecrets() }))
    ).toThrow();
  });
});
