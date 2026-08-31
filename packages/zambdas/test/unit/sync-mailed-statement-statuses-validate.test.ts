import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../../src/ehr/sync-mailed-statement-statuses/validateRequestParameters';
import type { ZambdaInput } from '../../src/shared/types/common';

function makeInput(secrets: Record<string, string> | null): ZambdaInput {
  return {
    headers: null,
    body: null,
    secrets,
  };
}

describe('sync-mailed-statement-statuses validateRequestParameters', () => {
  it('returns validated params when secrets are provided', () => {
    const secrets = { MY_SECRET: 'value' };
    const result = validateRequestParameters(makeInput(secrets));
    expect(result).toEqual({ secrets });
  });

  it('throws when secrets are missing', () => {
    expect(() => validateRequestParameters(makeInput(null))).toThrow(
      'The request was missing secrets required to process it'
    );
  });
});
