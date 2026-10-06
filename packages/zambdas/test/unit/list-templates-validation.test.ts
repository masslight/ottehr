import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../../src/ehr/list-templates/validateRequestParameters';
import { ZambdaInput } from '../../src/shared/types/common';

const input = (body: Record<string, unknown>): ZambdaInput => ({
  body: JSON.stringify(body),
  headers: { Authorization: 'Bearer test-token' },
  secrets: { AUTH0_SECRET: 'test-secret' },
});

describe('list-templates validateRequestParameters', () => {
  it('passes includeDiagnoses through, so an HTTP caller gets the diagnoses it asked for', () => {
    expect(validateRequestParameters(input({ includeVersionData: false, includeDiagnoses: true }))).toMatchObject({
      includeVersionData: false,
      includeDiagnoses: true,
    });
  });

  it('leaves includeDiagnoses out when the caller did not send it', () => {
    expect(validateRequestParameters(input({ includeVersionData: true }))).not.toHaveProperty('includeDiagnoses');
  });

  it('rejects an includeDiagnoses that is not a boolean', () => {
    expect(() => validateRequestParameters(input({ includeVersionData: true, includeDiagnoses: 'yes' }))).toThrow();
  });
});
