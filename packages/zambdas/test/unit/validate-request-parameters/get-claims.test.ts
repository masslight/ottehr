import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-claims/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

describe('get-claims - validateRequestParameters', () => {
  test('should return validated params with all filter fields', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput(
      {
        patient: 'John',
        visitId: 'visit-1',
        claimId: 'claim-1',
        teamMember: 'Dr. Smith',
        queue: 'billing',
        dayInQueue: 5,
        status: 'open',
        state: 'CA',
        facilityGroup: 'group-1',
        facility: 'facility-1',
        insurance: 'Aetna',
        balance: 100,
        dosFrom: '2024-01-01',
        dosTo: '2024-12-31',
        offset: 0,
        pageSize: 20,
      },
      { secrets }
    );
    const result = validateRequestParameters(input);

    expect(result.patient).toBe('John');
    expect(result.visitId).toBe('visit-1');
    expect(result.claimId).toBe('claim-1');
    expect(result.offset).toBe(0);
    expect(result.pageSize).toBe(20);
    expect(result.secrets).toEqual(secrets);
  });

  test('should return only secrets when body is missing', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput(null, { body: null as any, secrets });
    const result = validateRequestParameters(input);

    expect(result.secrets).toEqual(secrets);
    expect(result.patient).toBeUndefined();
  });

  test('should throw when PROJECT_API secret is missing', () => {
    const input = createMockZambdaInput({}, { secrets: null });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should return partial filters when only some are provided', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput({ patient: 'Jane', status: 'denied' }, { secrets });
    const result = validateRequestParameters(input);

    expect(result.patient).toBe('Jane');
    expect(result.status).toBe('denied');
    expect(result.visitId).toBeUndefined();
  });

  test('should pass through secrets from input', () => {
    const secrets = createMockSecrets();
    const input = createMockZambdaInput(null, { body: null as any, secrets });
    const result = validateRequestParameters(input);

    expect(result.secrets).toBe(secrets);
  });
});
