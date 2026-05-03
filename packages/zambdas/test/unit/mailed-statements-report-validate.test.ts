import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../../src/ehr/mailed-statements-report/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

function makeInput(
  body: Record<string, unknown> | null,
  secrets: Record<string, string> | null = { key: 'val' }
): ZambdaInput {
  return {
    headers: null,
    body: body ? JSON.stringify(body) : (null as unknown as string),
    secrets,
  };
}

describe('mailed-statements-report validateRequestParameters', () => {
  const validDateRange = { start: '2025-01-01', end: '2025-01-31' };

  it('returns validated params for valid input', () => {
    const result = validateRequestParameters(makeInput({ dateRange: validDateRange }));
    expect(result).toMatchObject({
      dateRange: validDateRange,
    });
    expect(result.secrets).toEqual({ key: 'val' });
  });

  it('throws when body is missing', () => {
    expect(() => validateRequestParameters(makeInput(null))).toThrow('Missing request body');
  });

  it('throws when dateRange is missing', () => {
    expect(() => validateRequestParameters(makeInput({}))).toThrow('Missing dateRange parameter');
  });

  it('throws when dateRange.start is missing', () => {
    expect(() => validateRequestParameters(makeInput({ dateRange: { end: '2025-01-31' } }))).toThrow(
      'dateRange must include both start and end dates'
    );
  });

  it('throws when dateRange.end is missing', () => {
    expect(() => validateRequestParameters(makeInput({ dateRange: { start: '2025-01-01' } }))).toThrow(
      'dateRange must include both start and end dates'
    );
  });

  it('throws when dateRange.start is not a valid date', () => {
    expect(() =>
      validateRequestParameters(makeInput({ dateRange: { start: 'not-a-date', end: '2025-01-31' } }))
    ).toThrow('dateRange.start must be a valid ISO date string');
  });

  it('throws when dateRange.end is not a valid date', () => {
    expect(() =>
      validateRequestParameters(makeInput({ dateRange: { start: '2025-01-01', end: 'not-a-date' } }))
    ).toThrow('dateRange.end must be a valid ISO date string');
  });

  it('throws when secrets are missing', () => {
    expect(() => validateRequestParameters(makeInput({ dateRange: validDateRange }, null))).toThrow(
      'Input did not have any secrets'
    );
  });
});
