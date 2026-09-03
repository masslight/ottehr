import { VitalsAlertConfig } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { DEFAULT_VITALS_ALERT_CONFIG } from 'utils/lib/utils/vitals-alert-config';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/vitals-alert-config/admin-update-vitals-alert-config/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const cloneDefault = (): VitalsAlertConfig => JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));

describe('admin-update-vitals-alert-config - validateRequestParameters', () => {
  test('should return the validated config when the body is well formed', () => {
    const config = cloneDefault();
    config.thresholds['vital-heartbeat']['18+y'] = { abnormalLow: 55, abnormalHigh: 95 };

    const result = validateRequestParameters(createMockZambdaInput({ config }));

    expect(result.config.thresholds['vital-heartbeat']['18+y']).toEqual({ abnormalLow: 55, abnormalHigh: 95 });
    expect(result.config.ageRanges).toHaveLength(DEFAULT_VITALS_ALERT_CONFIG.ageRanges.length);
    expect(result.secrets).toBeNull();
  });

  test('should throw when body is missing', () => {
    expect(() => validateRequestParameters(createMockZambdaInput(null, { body: '' }))).toThrow();
  });

  test('should throw when the config key is missing', () => {
    expect(() => validateRequestParameters(createMockZambdaInput(cloneDefault()))).toThrow('config');
  });

  test('should throw when there are no age ranges', () => {
    const config = cloneDefault();
    config.ageRanges = [];
    expect(() => validateRequestParameters(createMockZambdaInput({ config }))).toThrow();
  });

  test('should accept a gap between age ranges', () => {
    const config = cloneDefault();
    config.ageRanges[1].minAge = { unit: 'months', value: 4 };
    expect(() => validateRequestParameters(createMockZambdaInput({ config }))).not.toThrow();
  });

  test('should throw when age ranges overlap', () => {
    const config = cloneDefault();
    config.ageRanges[0].maxAge = { unit: 'months', value: 5 };
    expect(() => validateRequestParameters(createMockZambdaInput({ config }))).toThrow('must not overlap');
  });

  test('should throw when alert levels are out of ascending order', () => {
    const config = cloneDefault();
    config.thresholds['vital-heartbeat']['18+y'] = { abnormalLow: 120, abnormalHigh: 100 };
    expect(() => validateRequestParameters(createMockZambdaInput({ config }))).toThrow();
  });

  test('should accept a bounded last age range, leaving older patients unconfigured', () => {
    const config = cloneDefault();
    config.ageRanges[config.ageRanges.length - 1].maxAge = { unit: 'years', value: 99 };
    expect(() => validateRequestParameters(createMockZambdaInput({ config }))).not.toThrow();
  });

  test('should throw when more than 15 age ranges are supplied', () => {
    const config = cloneDefault();
    // Append 2 contiguous ranges onto the 14 defaults to exceed the cap.
    config.ageRanges[config.ageRanges.length - 1].maxAge = { unit: 'years', value: 20 };
    config.ageRanges.push(
      { id: 'r15', minAge: { unit: 'years', value: 20 }, maxAge: { unit: 'years', value: 30 } },
      { id: 'r16', minAge: { unit: 'years', value: 30 } }
    );
    expect(() => validateRequestParameters(createMockZambdaInput({ config }))).toThrow();
  });

  test('should pass secrets through from input', () => {
    const secrets = createMockSecrets();
    const result = validateRequestParameters(createMockZambdaInput({ config: cloneDefault() }, { secrets }));
    expect(result.secrets).toEqual(secrets);
  });

  test('should extract the user token from the auth header', () => {
    const result = validateRequestParameters(createMockZambdaInput({ config: cloneDefault() }));
    expect(result.userToken).not.toContain('Bearer');
    expect(result.userToken.length).toBeGreaterThan(0);
  });
});
