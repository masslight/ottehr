import { describe, expect, test } from 'vitest';
import { validateInput, validateSecrets } from '../../../src/ehr/get-patient-balances/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-patient-balances - validateInput', () => {
  const validUUID = '550e8400-e29b-41d4-a716-446655440000';

  test('should return validated params for a valid request', async () => {
    const input = createMockZambdaInput({ patientId: validUUID });
    const result = await validateInput(input);

    expect(result).toEqual({
      body: { patientId: validUUID },
      callerAccessToken: 'test-token',
    });
  });

  test('should throw when body is missing', async () => {
    const input = createMockZambdaInput(null);
    await expect(validateInput(input)).rejects.toThrow();
  });

  test('should throw when patientId is missing', async () => {
    const input = createMockZambdaInput({});
    await expect(validateInput(input)).rejects.toThrow();
  });

  test('should throw when patientId is not a string', async () => {
    const input = createMockZambdaInput({ patientId: 123 });
    await expect(validateInput(input)).rejects.toThrow();
  });

  test('should throw when patientId is not a valid UUID', async () => {
    const input = createMockZambdaInput({ patientId: 'not-a-uuid' });
    await expect(validateInput(input)).rejects.toThrow();
  });

  test('should throw when Authorization header is missing', async () => {
    const input = createMockZambdaInput({ patientId: validUUID }, { headers: {} as any });
    await expect(validateInput(input)).rejects.toThrow();
  });

  test('should strip extra fields from body', async () => {
    const input = createMockZambdaInput({ patientId: validUUID, extra: 'field' });
    const result = await validateInput(input);

    expect(result.body).toEqual({ patientId: validUUID });
    expect((result.body as any).extra).toBeUndefined();
  });
});

describe('get-patient-balances - validateSecrets', () => {
  const allRequiredSecrets = {
    AUTH0_ENDPOINT: 'https://auth0.endpoint',
    AUTH0_CLIENT: 'auth0-client',
    AUTH0_SECRET: 'auth0-secret',
    AUTH0_AUDIENCE: 'auth0-audience',
    FHIR_API: 'https://fhir.api',
    PROJECT_API: 'https://project.api',
    CANDID_CLIENT_ID: 'candid-id',
    CANDID_CLIENT_SECRET: 'candid-secret',
    CANDID_ENV: 'test',
  };

  test('should return validated secrets when all are present', () => {
    const result = validateSecrets(allRequiredSecrets);
    expect(result).toEqual(allRequiredSecrets);
  });

  test('should throw when secrets are null', () => {
    expect(() => validateSecrets(null)).toThrow('Secrets are required');
  });

  const requiredKeys = [
    'AUTH0_ENDPOINT',
    'AUTH0_CLIENT',
    'AUTH0_SECRET',
    'AUTH0_AUDIENCE',
    'FHIR_API',
    'PROJECT_API',
    'CANDID_CLIENT_ID',
    'CANDID_CLIENT_SECRET',
    'CANDID_ENV',
  ];

  for (const key of requiredKeys) {
    test(`should throw when ${key} is missing`, () => {
      const secrets = { ...allRequiredSecrets, [key]: '' };
      expect(() => validateSecrets(secrets)).toThrow('Missing required secrets');
    });
  }
});
