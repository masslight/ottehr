import { inspect } from 'node:util';
import { APIGatewayProxyResult } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, MockInstance, vi } from 'vitest';
import { wrapHandler } from '../../src/shared/sentry';
import { ZambdaInput } from '../../src/shared/types/common';

const makeInput = (body: string | null): ZambdaInput =>
  ({
    headers: { Authorization: 'Bearer token-123' },
    body,
    secrets: { ENVIRONMENT: 'local', AUTH0_SECRET: 'super-secret' },
  }) as unknown as ZambdaInput;

// vitest.setup.ts stubs the Sentry SDK with pass-through scope and span helpers, so the wrapper body runs directly.
const invoke = async (
  input: ZambdaInput,
  handler?: (input: ZambdaInput) => Promise<APIGatewayProxyResult>
): Promise<void> => {
  const wrapped = wrapHandler('test-zambda', handler ?? (async () => ({ statusCode: 200, body: '' }))) as unknown as (
    input: ZambdaInput
  ) => Promise<APIGatewayProxyResult>;
  await wrapped(input);
};

describe('wrapHandler input logging', () => {
  let logSpy: MockInstance<typeof console.log>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const inputLogs = (): string[] =>
    logSpy.mock.calls.map((call) => call.join(' ')).filter((line) => line.startsWith('Input body'));

  it('logs the input body exactly once', async () => {
    await invoke(makeInput(JSON.stringify({ appointmentId: 'appt-1' })));

    expect(inputLogs()).toHaveLength(1);
    expect(inputLogs()[0]).toContain('appt-1');
  });

  it('never logs secrets or headers', async () => {
    await invoke(makeInput(JSON.stringify({ appointmentId: 'appt-1' })));

    const [logged] = inputLogs();
    expect(logged).not.toContain('super-secret');
    expect(logged).not.toContain('token-123');
    expect(logged).not.toContain('Authorization');
  });

  it('truncates a long body to 500 characters', async () => {
    const body = 'x'.repeat(2000);
    await invoke(makeInput(body));

    const [logged] = inputLogs();
    expect(logged).toBe(`Input body: ${'x'.repeat(500)}... [truncated, 2000 chars total]`);
  });

  it('logs a body at the limit in full, without a truncation notice', async () => {
    await invoke(makeInput('y'.repeat(500)));

    const [logged] = inputLogs();
    expect(logged).not.toContain('truncated');
    expect(logged).toBe(`Input body: ${'y'.repeat(500)}`);
  });

  it('handles an absent body', async () => {
    await invoke(makeInput(null));

    expect(inputLogs()).toEqual(['Input body: <empty>']);
  });

  it('logs the body before a throwing handler is reached', async () => {
    await invoke(makeInput('{"a":1}'), async () => {
      throw new Error('boom');
    });

    expect(inputLogs()).toHaveLength(1);
  });

  it('leaves secrets and headers out of JSON.stringify of the input inside the handler', async () => {
    let serialized = '';
    await invoke(makeInput('{"a":1}'), async (input) => {
      serialized = JSON.stringify(input);
      return { statusCode: 200, body: '' };
    });

    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('token-123');
    expect(JSON.parse(serialized)).toEqual({ body: '{"a":1}' });
  });

  it('leaves secrets and headers out of console output of the input inside the handler', async () => {
    let printed = '';
    await invoke(makeInput('{"a":1}'), async (input) => {
      printed = inspect(input);
      return { statusCode: 200, body: '' };
    });

    expect(printed).not.toContain('super-secret');
    expect(printed).not.toContain('token-123');
    expect(printed).toContain('{"a":1}');
  });

  it('still hands the handler its secrets and headers, also through a spread copy', async () => {
    const seen: { input?: ZambdaInput; copy?: ZambdaInput } = {};
    await invoke(makeInput('{"a":1}'), async (input) => {
      seen.input = input;
      seen.copy = { ...input };
      return { statusCode: 200, body: '' };
    });

    expect(seen.input?.secrets?.AUTH0_SECRET).toBe('super-secret');
    expect(seen.input?.headers.Authorization).toBe('Bearer token-123');
    expect(seen.copy?.secrets?.AUTH0_SECRET).toBe('super-secret');
  });
});
