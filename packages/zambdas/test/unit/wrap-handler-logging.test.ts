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

// @sentry/aws-serverless is mocked as a pass-through in vitest.setup.ts, so the wrapper body runs directly.
const invoke = async (input: ZambdaInput, handler?: () => Promise<APIGatewayProxyResult>): Promise<void> => {
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
    expect(logged).toBe(`Input body (truncated to 500 of 2000 chars): ${'x'.repeat(500)}`);
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
});
