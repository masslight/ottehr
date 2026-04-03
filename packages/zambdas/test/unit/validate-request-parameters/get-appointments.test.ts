import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-appointments/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-appointments - validateRequestParameters', () => {
  const validBody = {
    searchDate: '2024-01-15',
    timezone: 'America/New_York',
    locationIds: ['loc-123'],
    visitType: ['in-person'],
  };

  test('should return validated params with locationIds', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.searchDate).toBe('2024-01-15');
    expect(result.timezone).toBe('America/New_York');
    expect(result.locationIds).toEqual(['loc-123']);
    expect(result.visitType).toEqual(['in-person']);
    expect(result.supervisorApprovalEnabled).toBe(false);
    expect(result.secrets).toBeNull();
  });

  test('should accept providerIds instead of locationIds', () => {
    const input = createMockZambdaInput({
      searchDate: '2024-01-15',
      timezone: 'America/New_York',
      providerIds: ['prov-1', 'prov-2'],
      visitType: ['telemed'],
    });
    const result = validateRequestParameters(input);

    expect(result.providerIds).toEqual(['prov-1', 'prov-2']);
    expect(result.locationIds).toBeUndefined();
  });

  test('should accept serviceCategories instead of locationIds', () => {
    const input = createMockZambdaInput({
      searchDate: '2024-01-15',
      timezone: 'America/New_York',
      serviceCategories: ['urgent-care'],
      visitType: ['in-person'],
    });
    const result = validateRequestParameters(input);

    expect(result.serviceCategories).toEqual(['urgent-care']);
  });

  test('should accept supervisorApprovalEnabled as true', () => {
    const input = createMockZambdaInput({ ...validBody, supervisorApprovalEnabled: true });
    const result = validateRequestParameters(input);

    expect(result.supervisorApprovalEnabled).toBe(true);
  });

  test('should default supervisorApprovalEnabled to false when not boolean', () => {
    const input = createMockZambdaInput({ ...validBody, supervisorApprovalEnabled: 'yes' });
    const result = validateRequestParameters(input);

    expect(result.supervisorApprovalEnabled).toBe(false);
  });

  test('should throw when body is missing', () => {
    const input = createMockZambdaInput(null, { body: '' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when body is invalid JSON', () => {
    const input = createMockZambdaInput(null, { body: 'not-json' });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when searchDate is missing', () => {
    const { searchDate: _searchDate, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateRequestParameters(input)).toThrow('searchDate');
  });

  test('should throw when searchDate is not a string', () => {
    const input = createMockZambdaInput({ ...validBody, searchDate: 12345 });
    expect(() => validateRequestParameters(input)).toThrow('searchDate');
  });

  test('should throw when timezone is missing', () => {
    const { timezone: _timezone, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateRequestParameters(input)).toThrow('timezone');
  });

  test('should throw when timezone is not a string', () => {
    const input = createMockZambdaInput({ ...validBody, timezone: 12345 });
    expect(() => validateRequestParameters(input)).toThrow('timezone');
  });

  test('should throw when visitType is missing', () => {
    const { visitType: _visitType, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateRequestParameters(input)).toThrow('visitType');
  });

  test('should throw when visitType is not an array', () => {
    const input = createMockZambdaInput({ ...validBody, visitType: 'in-person' });
    expect(() => validateRequestParameters(input)).toThrow('visitType');
  });

  test('should throw when visitType contains non-strings', () => {
    const input = createMockZambdaInput({ ...validBody, visitType: [123] });
    expect(() => validateRequestParameters(input)).toThrow('visitType');
  });

  test('should throw when none of locationIds, providerIds, or serviceCategories is provided', () => {
    const input = createMockZambdaInput({
      searchDate: '2024-01-15',
      timezone: 'America/New_York',
      visitType: ['in-person'],
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when locationIds is not an array', () => {
    const input = createMockZambdaInput({ ...validBody, locationIds: 'loc-123' });
    expect(() => validateRequestParameters(input)).toThrow('locationIds');
  });

  test('should throw when locationIds contains non-strings', () => {
    const input = createMockZambdaInput({ ...validBody, locationIds: [123] });
    expect(() => validateRequestParameters(input)).toThrow('locationIds');
  });

  test('should throw when providerIds is not an array', () => {
    const input = createMockZambdaInput({
      searchDate: '2024-01-15',
      timezone: 'America/New_York',
      providerIds: 'prov-1',
      visitType: ['in-person'],
    });
    expect(() => validateRequestParameters(input)).toThrow('providerIds');
  });

  test('should throw when providerIds contains non-strings', () => {
    const input = createMockZambdaInput({
      searchDate: '2024-01-15',
      timezone: 'America/New_York',
      providerIds: [123],
      visitType: ['in-person'],
    });
    expect(() => validateRequestParameters(input)).toThrow('providerIds');
  });

  test('should throw when serviceCategories is not an array', () => {
    const input = createMockZambdaInput({
      searchDate: '2024-01-15',
      timezone: 'America/New_York',
      serviceCategories: 'urgent',
      visitType: ['in-person'],
    });
    expect(() => validateRequestParameters(input)).toThrow('serviceCategories');
  });
});
