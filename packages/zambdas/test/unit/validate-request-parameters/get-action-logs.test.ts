import { describe, expect, it } from 'vitest';
import { validateRequestParameters } from '../../../src/ehr/get-action-logs/validateRequestParameters';
import { createMockZambdaInput } from './helpers';

describe('get-action-logs validation', () => {
  it('defaults to the first page and accepts a channel', () => {
    expect(validateRequestParameters(createMockZambdaInput({ channel: 'fax' }))).toMatchObject({
      channel: 'fax',
      pageIndex: 0,
    });
  });

  it('rejects unsupported channels', () => {
    expect(() => validateRequestParameters(createMockZambdaInput({ channel: 'sms' }))).toThrow();
  });
});
