import { VitalsAlertConfig } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { DEFAULT_VITALS_ALERT_CONFIG } from 'utils/lib/utils/vitals-alert-config';
import { describe, expect, test } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/vitals-alert-config/admin-update-vitals-alert-config/validateRequestParameters';
import { createMockSecrets, createMockZambdaInput } from './helpers';

const cloneDefault = (): VitalsAlertConfig => JSON.parse(JSON.stringify(DEFAULT_VITALS_ALERT_CONFIG));

const secrets = createMockSecrets();
const inputFor = (body: unknown): ReturnType<typeof createMockZambdaInput> => createMockZambdaInput(body, { secrets });

describe('admin-update-vitals-alert-config - validateRequestParameters', () => {
  test('should return the validated config and secrets when the body is well formed', () => {
    const config = cloneDefault();
    config.thresholds['vital-heartbeat']['18+y'] = { abnormalLow: 55, abnormalHigh: 95 };

    const result = validateRequestParameters(inputFor({ config }));

    expect(result.config.thresholds['vital-heartbeat']['18+y']).toEqual({ abnormalLow: 55, abnormalHigh: 95 });
    expect(result.config.ageRanges).toHaveLength(DEFAULT_VITALS_ALERT_CONFIG.ageRanges.length);
    expect(result.secrets).toEqual(secrets);
  });

  test('should throw when the body is missing', () => {
    expect(() => validateRequestParameters(createMockZambdaInput(null, { body: '', secrets }))).toThrow(
      expect.objectContaining({ code: APIErrorCode.MISSING_REQUEST_BODY })
    );
  });

  test('should throw when secrets are missing', () => {
    expect(() => validateRequestParameters(createMockZambdaInput({ config: cloneDefault() }))).toThrow(
      expect.objectContaining({ code: APIErrorCode.MISSING_REQUEST_SECRETS })
    );
  });

  test('should throw when the config key is missing', () => {
    expect(() => validateRequestParameters(inputFor(cloneDefault()))).toThrow('config');
  });

  test('should reject a config the schema accepts but the vitals engine cannot compile', () => {
    const config = cloneDefault();
    config.ageRanges = [
      { id: 'a', minAge: { unit: 'years', value: 0 }, maxAge: { unit: 'years', value: 10 } },
      { id: 'b', minAge: { unit: 'years', value: 10 }, maxAge: { unit: 'months', value: 121 } },
      { id: 'c', minAge: { unit: 'months', value: 121 } },
    ];
    config.thresholds = Object.fromEntries(
      Object.keys(DEFAULT_VITALS_ALERT_CONFIG.thresholds).map((vital) => [
        vital,
        {
          a: { abnormalLow: 1, abnormalHigh: 2 },
          b: { abnormalLow: 1, abnormalHigh: 2 },
          c: { abnormalLow: 1, abnormalHigh: 2 },
        },
      ])
    ) as unknown as VitalsAlertConfig['thresholds'];

    expect(() => validateRequestParameters(inputFor({ config }))).toThrow(
      expect.objectContaining({ code: APIErrorCode.INVALID_INPUT })
    );
  });

  test('should reject a config the schema rejects', () => {
    const config = cloneDefault();
    config.ageRanges[0].maxAge = { unit: 'months', value: 5 };

    expect(() => validateRequestParameters(inputFor({ config }))).toThrow('must not overlap');
  });
});
