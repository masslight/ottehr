import {
  captureMessage,
  continueTrace,
  flush,
  setContext,
  startSpan,
  withIsolationScope,
} from '@sentry/node-core/light';
import { APIGatewayProxyResult, Context } from 'aws-lambda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SENTRY_FLUSH_TIMEOUT_MS, TIMEOUT_WARNING_LEAD_MS, wrapHandler } from '../../src/shared/sentry';
import { ZambdaInput } from '../../src/shared/types/common';

// vitest.setup.ts stubs the Sentry SDK; these tests check what wrapHandler asks of it.

type Invoke = (input: ZambdaInput, context?: Context) => Promise<APIGatewayProxyResult>;

const wrap = (handler: () => Promise<APIGatewayProxyResult>): Invoke =>
  wrapHandler('test-zambda', handler) as unknown as Invoke;

const ok = async (): Promise<APIGatewayProxyResult> => ({ statusCode: 200, body: '' });

const makeInput = (headers: Record<string, string> = {}): ZambdaInput =>
  ({ headers, body: '{}', secrets: { ENVIRONMENT: 'local' } }) as unknown as ZambdaInput;

const makeLambdaContext = (remainingMs: number): Context =>
  ({
    awsRequestId: 'request-1',
    functionName: 'zambda-function',
    functionVersion: '$LATEST',
    invokedFunctionArn: 'arn:aws:lambda:us-east-1:000000000000:function:zambda-function',
    logGroupName: '/aws/lambda/zambda-function',
    logStreamName: 'stream-1',
    callbackWaitsForEmptyEventLoop: true,
    getRemainingTimeInMillis: () => remainingMs,
  }) as unknown as Context;

describe('wrapHandler Sentry reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('flushes queued events before returning', async () => {
    const result = await wrap(ok)(makeInput());

    expect(result.statusCode).toBe(200);
    expect(flush).toHaveBeenCalledWith(SENTRY_FLUSH_TIMEOUT_MS);
  });

  it('still flushes when the handler throws', async () => {
    const result = await wrap(async () => {
      throw new Error('boom');
    })(makeInput());

    expect(result.statusCode).toBe(500);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('returns the handler result when flushing fails', async () => {
    vi.mocked(flush).mockRejectedValueOnce(new Error('network down'));

    const result = await wrap(ok)(makeInput());

    expect(result.statusCode).toBe(200);
  });

  it('runs each invocation in its own isolation scope and transaction', async () => {
    await wrap(ok)(makeInput());

    expect(withIsolationScope).toHaveBeenCalledTimes(1);
    expect(startSpan).toHaveBeenCalledWith({ name: 'test-zambda', op: 'function.aws.lambda' }, expect.any(Function));
  });

  it("continues the caller's trace", async () => {
    await wrap(ok)(makeInput({ 'sentry-trace': 'trace-id-span-id-1', baggage: 'sentry-environment=development' }));

    expect(continueTrace).toHaveBeenCalledWith(
      { sentryTrace: 'trace-id-span-id-1', baggage: 'sentry-environment=development' },
      expect.any(Function)
    );
  });

  it('attaches the Lambda context and names the transaction after the function', async () => {
    const context = makeLambdaContext(30_000);

    await wrap(ok)(makeInput(), context);

    expect(context.callbackWaitsForEmptyEventLoop).toBe(false);
    expect(setContext).toHaveBeenCalledWith(
      'aws.lambda',
      expect.objectContaining({ aws_request_id: 'request-1', function_name: 'zambda-function' })
    );
    expect(setContext).toHaveBeenCalledWith('aws.cloudwatch.logs', {
      log_group: '/aws/lambda/zambda-function',
      log_stream: 'stream-1',
    });
    expect(startSpan).toHaveBeenCalledWith(expect.objectContaining({ name: 'zambda-function' }), expect.any(Function));
  });

  it('warns shortly before the Lambda times out', async () => {
    vi.useFakeTimers();
    let finish!: () => void;
    const pending = wrap(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ statusCode: 200, body: '' });
        })
    )(makeInput(), makeLambdaContext(3_000));

    await vi.advanceTimersByTimeAsync(3_000 - TIMEOUT_WARNING_LEAD_MS);

    expect(captureMessage).toHaveBeenCalledWith('Possible function timeout: zambda-function', 'warning');
    finish();
    await pending;
  });

  it('cancels the timeout warning when the handler finishes in time', async () => {
    vi.useFakeTimers();

    await wrap(ok)(makeInput(), makeLambdaContext(3_000));
    await vi.advanceTimersByTimeAsync(10_000);

    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("skips the Lambda-only steps for the local server's empty context", async () => {
    vi.useFakeTimers();

    await wrap(ok)(makeInput(), {} as Context);
    await vi.advanceTimersByTimeAsync(60_000);

    expect(setContext).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
    expect(startSpan).toHaveBeenCalledWith(expect.objectContaining({ name: 'test-zambda' }), expect.any(Function));
  });
});
