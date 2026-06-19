import { DateTime } from 'luxon';
import { describe, expect, test } from 'vitest';
import {
  MAX_DATE_RANGE_DAYS,
  validateRequestParameters,
} from '../../../src/ehr/get-appointments/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-appointments - validateRequestParameters', () => {
  const validBody = {
    searchDateFrom: '2024-01-15',
    searchDateTo: '2024-01-15',
    timezone: 'America/New_York',
    locationIds: ['550e8400-e29b-41d4-a716-446655440000'],
    visitType: ['in-person-walk-in'],
  };

  test('should return validated params with locationIds', () => {
    const input = createMockZambdaInput(validBody);
    const result = validateRequestParameters(input);

    expect(result.searchDateFrom).toBe('2024-01-15');
    expect(result.searchDateTo).toBe('2024-01-15');
    expect(result.timezone).toBe('America/New_York');
    expect(result.locationIds).toEqual(['550e8400-e29b-41d4-a716-446655440000']);
    expect(result.visitType).toEqual(['in-person-walk-in']);
    expect(result.supervisorApprovalEnabled).toBe(false);
    expect(result.secrets).toBeNull();
  });

  test('should accept providerIds instead of locationIds', () => {
    const input = createMockZambdaInput({
      searchDateFrom: '2024-01-15',
      searchDateTo: '2024-01-15',
      timezone: 'America/New_York',
      providerIds: ['a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d', 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'],
      visitType: ['virtual-walk-in'],
    });
    const result = validateRequestParameters(input);

    expect(result.providerIds).toEqual([
      'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    ]);
    expect(result.locationIds).toBeUndefined();
  });

  test('should accept serviceCategories instead of locationIds', () => {
    const input = createMockZambdaInput({
      searchDateFrom: '2024-01-15',
      searchDateTo: '2024-01-15',
      timezone: 'America/New_York',
      serviceCategories: ['urgent-care'],
      visitType: ['in-person-walk-in'],
    });
    const result = validateRequestParameters(input);

    expect(result.serviceCategories).toEqual(['urgent-care']);
  });

  test('should accept supervisorApprovalEnabled as true', () => {
    const input = createMockZambdaInput({ ...validBody, supervisorApprovalEnabled: true });
    const result = validateRequestParameters(input);

    expect(result.supervisorApprovalEnabled).toBe(true);
  });

  test('should throw when supervisorApprovalEnabled is not a boolean', () => {
    const input = createMockZambdaInput({ ...validBody, supervisorApprovalEnabled: 'yes' });
    expect(() => validateRequestParameters(input)).toThrow('supervisorApprovalEnabled');
  });

  test('should default supervisorApprovalEnabled to false when omitted', () => {
    const { ...body } = validBody;
    const input = createMockZambdaInput(body);
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

  test('should throw when no date fields are provided', () => {
    const { searchDateFrom: _searchDateFrom, searchDateTo: _searchDateTo, ...rest } = validBody;
    const input = createMockZambdaInput(rest);
    expect(() => validateRequestParameters(input)).toThrow('searchDateFrom');
  });

  test('should throw when searchDateFrom is not a valid date string', () => {
    const input = createMockZambdaInput({ ...validBody, searchDateFrom: 'not-a-date' });
    expect(() => validateRequestParameters(input)).toThrow('searchDateFrom');
  });

  test('should throw when searchDateTo is not a valid date string', () => {
    const input = createMockZambdaInput({ ...validBody, searchDateTo: 'not-a-date' });
    expect(() => validateRequestParameters(input)).toThrow('searchDateTo');
  });

  test('should throw when searchDateFrom is a number', () => {
    const input = createMockZambdaInput({ ...validBody, searchDateFrom: 12345 });
    expect(() => validateRequestParameters(input)).toThrow('searchDateFrom');
  });

  test('should throw when searchDateTo is a number', () => {
    const input = createMockZambdaInput({ ...validBody, searchDateTo: 12345 });
    expect(() => validateRequestParameters(input)).toThrow('searchDateTo');
  });

  test('should throw when searchDateFrom is after searchDateTo', () => {
    const input = createMockZambdaInput({ ...validBody, searchDateFrom: '2024-01-16', searchDateTo: '2024-01-15' });
    expect(() => validateRequestParameters(input)).toThrow('searchDateTo');
  });

  test('should throw when the date range exceeds the maximum allowed span', () => {
    const searchDateFrom = '2024-01-01';
    const overMax = DateTime.fromISO(searchDateFrom, { zone: 'utc' })
      .plus({ days: MAX_DATE_RANGE_DAYS + 1 })
      .toISODate()!;
    const input = createMockZambdaInput({ ...validBody, searchDateFrom, searchDateTo: overMax });
    expect(() => validateRequestParameters(input)).toThrow(`${MAX_DATE_RANGE_DAYS} days`);
  });

  test('should accept a date range at the maximum allowed span', () => {
    const searchDateFrom = '2024-01-01';
    const atMax = DateTime.fromISO(searchDateFrom, { zone: 'utc' }).plus({ days: MAX_DATE_RANGE_DAYS }).toISODate()!;
    const input = createMockZambdaInput({ ...validBody, searchDateFrom, searchDateTo: atMax });
    const result = validateRequestParameters(input);
    expect(result.searchDateFrom).toBe(searchDateFrom);
    expect(result.searchDateTo).toBe(atMax);
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
    const input = createMockZambdaInput({ ...validBody, visitType: 'in-person-walk-in' });
    expect(() => validateRequestParameters(input)).toThrow('visitType');
  });

  test('should throw when visitType contains invalid values', () => {
    const input = createMockZambdaInput({ ...validBody, visitType: ['invalid-type'] });
    expect(() => validateRequestParameters(input)).toThrow('visitType');
  });

  test('should throw when none of locationIds, providerIds, or serviceCategories is provided', () => {
    const input = createMockZambdaInput({
      searchDateFrom: '2024-01-15',
      searchDateTo: '2024-01-15',
      timezone: 'America/New_York',
      visitType: ['in-person-walk-in'],
    });
    expect(() => validateRequestParameters(input)).toThrow();
  });

  test('should throw when locationIds is not an array', () => {
    const input = createMockZambdaInput({
      ...validBody,
      locationIds: '550e8400-e29b-41d4-a716-446655440000',
    });
    expect(() => validateRequestParameters(input)).toThrow('locationIds');
  });

  test('should throw when locationIds contains non-UUID strings', () => {
    const input = createMockZambdaInput({ ...validBody, locationIds: ['not-a-uuid'] });
    expect(() => validateRequestParameters(input)).toThrow('locationIds');
  });

  test('should throw when providerIds is not an array', () => {
    const input = createMockZambdaInput({
      searchDateFrom: '2024-01-15',
      searchDateTo: '2024-01-15',
      timezone: 'America/New_York',
      providerIds: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
      visitType: ['in-person-walk-in'],
    });
    expect(() => validateRequestParameters(input)).toThrow('providerIds');
  });

  test('should throw when providerIds contains non-UUID strings', () => {
    const input = createMockZambdaInput({
      searchDateFrom: '2024-01-15',
      searchDateTo: '2024-01-15',
      timezone: 'America/New_York',
      providerIds: ['not-a-uuid'],
      visitType: ['in-person-walk-in'],
    });
    expect(() => validateRequestParameters(input)).toThrow('providerIds');
  });

  test('should throw when serviceCategories is not an array', () => {
    const input = createMockZambdaInput({
      searchDateFrom: '2024-01-15',
      searchDateTo: '2024-01-15',
      timezone: 'America/New_York',
      serviceCategories: 'urgent',
      visitType: ['in-person-walk-in'],
    });
    expect(() => validateRequestParameters(input)).toThrow('serviceCategories');
  });

  test('should accept all valid visit type combinations', () => {
    const allVisitTypes = [
      'in-person-walk-in',
      'in-person-pre-booked',
      'in-person-post-telemed',
      'virtual-walk-in',
      'virtual-pre-booked',
      'virtual-post-telemed',
    ];
    const input = createMockZambdaInput({ ...validBody, visitType: allVisitTypes });
    const result = validateRequestParameters(input);
    expect(result.visitType).toEqual(allVisitTypes);
  });
});
