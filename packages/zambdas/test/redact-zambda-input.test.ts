import { describe, expect, it } from 'vitest';
import { redactZambdaInputForLogging } from '../src/shared/errors';
import { ZambdaInput } from '../src/shared/types/common';

const buildInput = (): ZambdaInput => ({
  body: JSON.stringify({ encounterId: 'enc-123', note: 'patient reports headache' }),
  headers: {
    authorization: 'Bearer fake-token-lower',
    Authorization: 'Bearer fake-token-upper',
    'x-custom-token': 'Bearer fake-token-odd-name',
    'content-type': 'application/json',
    host: 'localhost:3000',
  },
  secrets: {
    AUTH0_SECRET: 'fake-auth0-secret',
    ANTHROPIC_API_KEY: 'fake-anthropic-key',
    ENVIRONMENT: 'local',
  },
});

describe('redactZambdaInputForLogging', () => {
  it('redacts every secret value but keeps the key names', () => {
    const redacted = redactZambdaInputForLogging(buildInput());
    expect(redacted.secrets).toEqual({
      AUTH0_SECRET: '<redacted>',
      ANTHROPIC_API_KEY: '<redacted>',
      ENVIRONMENT: '<redacted>',
    });
  });

  it('redacts authorization headers case-insensitively', () => {
    const redacted = redactZambdaInputForLogging(buildInput());
    expect(redacted.headers.authorization).toBe('<redacted>');
    expect(redacted.headers.Authorization).toBe('<redacted>');
  });

  it('redacts any header whose value starts with "Bearer " regardless of name', () => {
    const redacted = redactZambdaInputForLogging(buildInput());
    expect(redacted.headers['x-custom-token']).toBe('<redacted>');
  });

  it('passes the body and non-credential headers through byte-for-byte', () => {
    const input = buildInput();
    const redacted = redactZambdaInputForLogging(input);
    expect(redacted.body).toBe(input.body);
    expect(redacted.headers['content-type']).toBe('application/json');
    expect(redacted.headers.host).toBe('localhost:3000');
  });

  it('does not mutate the original input', () => {
    const input = buildInput();
    const snapshot = JSON.parse(JSON.stringify(input));
    redactZambdaInputForLogging(input);
    expect(input).toEqual(snapshot);
  });

  it('leaves null headers and secrets as-is', () => {
    const redacted = redactZambdaInputForLogging({ body: null, headers: null, secrets: null });
    expect(redacted).toEqual({ body: null, headers: null, secrets: null });
  });

  it('never leaks a secret or bearer value through JSON.stringify of the redacted input', () => {
    const serialized = JSON.stringify(redactZambdaInputForLogging(buildInput()));
    expect(serialized).not.toContain('fake-auth0-secret');
    expect(serialized).not.toContain('fake-anthropic-key');
    expect(serialized).not.toContain('fake-token');
  });
});
