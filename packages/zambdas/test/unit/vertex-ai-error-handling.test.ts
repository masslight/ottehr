import { APIGatewayProxyResult } from 'aws-lambda';
import { Secrets, SecretsKeys } from 'utils/lib/secrets';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { invokeChatbotVertexAI, VertexAIRequestError } from '../../src/shared/ai';
import { lambdaResponse } from '../../src/shared/lambda';
import { wrapHandler } from '../../src/shared/sentry';
import { ZambdaInput } from '../../src/shared/types/common';

// Stands in for the SDK the real handler wrapper is built on: captureException is the only call whose
// arguments matter here, the rest exist so `wrapHandler` runs its actual code instead of a stub.
const captureException = vi.fn();
vi.mock('@sentry/aws-serverless', () => ({
  captureException: (...args: unknown[]) => captureException(...args),
  captureMessage: vi.fn(),
  init: vi.fn(),
  isInitialized: vi.fn(() => true),
  setTag: vi.fn(),
  setTags: vi.fn(),
  wrapHandler: (handler: unknown) => handler, // the real one only adds tracing
}));

// Keyed off SecretsKeys so the test breaks if the code starts reading a different secret.
const secrets: Secrets = {
  [SecretsKeys.GOOGLE_CLOUD_PROJECT_ID]: 'test-project',
  [SecretsKeys.GOOGLE_CLOUD_API_KEY]: 'test-key',
};

// sendErrors drops events on 'local', so a deployed environment is what proves reporting still happens.
const deployedSecrets: Secrets = { ...secrets, [SecretsKeys.ENVIRONMENT]: 'development' };

const responseOf = (
  status: number,
  body: unknown
): { ok: boolean; status: number; statusText: string; text: () => Promise<string> } => ({
  ok: status >= 200 && status < 300,
  status,
  statusText: status === 400 ? 'Bad Request' : status === 429 ? 'Too Many Requests' : 'OK',
  text: async () => JSON.stringify(body),
});

const respondWith = (status: number, body: unknown): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => responseOf(status, body))
  );
};

// One entry per attempt, for the retry paths; the last entry repeats if the ladder runs longer.
const respondInSequence = (...responses: [number, unknown][]): void => {
  let attempt = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const [status, body] = responses[Math.min(attempt++, responses.length - 1)];
      return responseOf(status, body);
    })
  );
};

beforeEach(() => {
  captureException.mockClear();
  vi.useFakeTimers(); // the retry ladder sleeps up to ~6s between attempts
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// Drive the call and the retry ladder's timers together. The outcome is captured as a value before the
// timers run, so a rejection is never briefly unhandled — vitest reports those as errors.
const invoke = async (): Promise<string> => {
  const outcome = invokeChatbotVertexAI([{ text: 'hello' }], secrets).then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error })
  );
  await vi.advanceTimersByTimeAsync(10_000);
  const result = await outcome;
  if (!result.ok) throw result.error;
  return result.value;
};

// The same call as `invoke`, but through the wrapper every zambda is deployed behind — so the assertions
// below are about what Sentry actually receives in production, not about a hand-rolled catch block.
const invokeThroughHandler = async (): Promise<APIGatewayProxyResult> => {
  const handler = wrapHandler('test-ai-zambda', async (input: ZambdaInput) => {
    const text = await invokeChatbotVertexAI([{ text: 'hello' }], input.secrets);
    return lambdaResponse(200, { text });
  }) as unknown as (input: ZambdaInput) => Promise<APIGatewayProxyResult>;

  // The handler swallows the throw into a 500, so nothing here is ever an unhandled rejection.
  const outcome = handler({ headers: null, body: null, secrets: deployedSecrets });
  await vi.advanceTimersByTimeAsync(10_000);
  return outcome;
};

describe('invokeChatbotVertexAI error handling', () => {
  test('a 400 surfaces the status and Vertex message instead of a TypeError', async () => {
    // The body Vertex returned for the unparseable upload. It used to fall through to `candidates[0]`, so
    // every failure looked like "TypeError: Cannot read properties of undefined" with an empty stack.
    respondWith(400, {
      error: { code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' },
    });

    await expect(invoke()).rejects.toThrow(/Vertex AI request failed: 400 Bad Request.*INVALID_ARGUMENT/s);

    // The thrown error carries the HTTP status so callers can translate a Vertex 4xx into a 400 instead
    // of letting it crash as a 500.
    const error = await invoke().then(
      () => null,
      (error: unknown) => error
    );
    expect(error).toBeInstanceOf(VertexAIRequestError);
    expect((error as VertexAIRequestError).status).toBe(400);
  });

  test('a non-retryable failure is not retried', async () => {
    respondWith(400, { error: { code: 400 } });

    await expect(invoke()).rejects.toThrow(/Vertex AI request failed/);
    // Resending a multi-megabyte inline audio payload two more times can only fail the same way.
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  test('a 200 with no candidate text reports the reason, not the body', async () => {
    // e.g. a safety block or a MAX_TOKENS finishReason: valid JSON, no text to return.
    // Partial transcript in a sibling part here: the error reaches logs and Sentry, so it must carry none.
    respondWith(200, {
      candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ inlineData: 'patient reports chest pain' }] } }],
      usageMetadata: { totalTokenCount: 8192 },
    });

    const error = await invoke().then(
      () => null,
      (error: Error) => error
    );
    expect(error?.message).toMatch(/Vertex AI returned no text.*MAX_TOKENS/s);
    expect(error?.message).toMatch(/8192/);
    expect(error?.message).not.toContain('chest pain');
  });

  test('a successful response body is not logged verbatim', async () => {
    // The transcript is PHI; only its size belongs in CloudWatch.
    respondWith(200, { candidates: [{ content: { parts: [{ text: 'patient reports chest pain' }] } }] });
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await expect(invoke()).resolves.toBe('patient reports chest pain');
    expect(log).toHaveBeenCalled();
    for (const call of log.mock.calls) {
      expect(call.map(String).join(' ')).not.toContain('chest pain');
    }

    log.mockRestore();
  });

  test('a 200 that is not JSON is reported as such', async () => {
    // A proxy's HTML error page or a truncated response: JSON.parse would throw a bare SyntaxError.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, statusText: 'OK', text: async () => '<html>502 Bad Gateway</html>' }))
    );

    await expect(invoke()).rejects.toThrow(/Vertex AI returned a non-JSON body.*502 Bad Gateway/s);
  });

  test('a 429 that a retry recovers from is not reported to Sentry', async () => {
    // The production sequence: attempt 0 is shed by Vertex's shared quota, the next attempt succeeds and the
    // caller never sees a failure. Reporting the shed attempt raised an alert for a self-healed retry.
    respondInSequence(
      [
        429,
        { error: { code: 429, message: 'Resource exhausted. Please try again later.', status: 'RESOURCE_EXHAUSTED' } },
      ],
      [200, { candidates: [{ content: { parts: [{ text: 'the transcript' }] } }] }]
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(invoke()).resolves.toBe('the transcript');
    expect(captureException).not.toHaveBeenCalled();
    // Still in the log, so the retry is visible when reading a slow invocation's trace.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Vertex AI attempt failed'), expect.anything());

    warn.mockRestore();
  });

  test('exhausting the retry ladder reports the statuses, not a bare AggregateError', async () => {
    respondWith(503, { error: { code: 503, message: 'The service is currently unavailable.' } });

    // Promise.any rejects with `AggregateError: All promises were rejected`, hiding status and message.
    const error = await invoke().then(
      () => null,
      (error: Error) => error
    );
    expect(error?.message).toMatch(/Vertex AI request failed after 3 attempts/);
    expect(error?.message).toMatch(/503.*currently unavailable/s);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
    // One failure, one Sentry event. Each attempt used to report itself, so a single exhausted ladder
    // raised three — before the handler's topLevelCatch reported the thrown error as a fourth.
    expect(captureException).not.toHaveBeenCalled();
  });

  test('an exhausted retry ladder still reaches Sentry — exactly once — through the handler', async () => {
    // The counterpart to the two assertions above: dropping captureException from the attempt only holds up
    // if the failure a caller actually sees is still reported. It is, by the handler, once per invocation.
    respondWith(503, { error: { code: 503, message: 'The service is currently unavailable.' } });

    const response = await invokeThroughHandler();

    expect(response.statusCode).toBe(500);
    expect(captureException).toHaveBeenCalledOnce();
    // And it carries the diagnosis, not a bare AggregateError, so the Sentry issue is actionable.
    const reported = captureException.mock.calls[0][0] as Error;
    expect(reported.message).toMatch(/Vertex AI request failed after 3 attempts/);
    expect(reported.message).toMatch(/503.*currently unavailable/s);
  });

  test('a non-retryable failure reaches Sentry once, on its only attempt', async () => {
    // With no retry there is no second attempt to report the error later, so this is the case where moving
    // reporting to the handler could plausibly have lost the event altogether.
    respondWith(400, {
      error: { code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' },
    });

    const response = await invokeThroughHandler();

    expect(response.statusCode).toBe(500);
    expect(captureException).toHaveBeenCalledOnce();
    expect((captureException.mock.calls[0][0] as Error).message).toMatch(
      /Vertex AI request failed: 400 Bad Request.*INVALID_ARGUMENT/s
    );
  });

  test('a success reports nothing at all', async () => {
    // Guards the other direction: a handler that reported on the happy path would satisfy every assertion
    // above while re-creating the alert noise this change removed.
    respondWith(200, { candidates: [{ content: { parts: [{ text: 'the transcript' }] } }] });

    const response = await invokeThroughHandler();

    expect(response.statusCode).toBe(200);
    expect(captureException).not.toHaveBeenCalled();
  });

  test('a successful response returns the candidate text', async () => {
    respondWith(200, { candidates: [{ content: { parts: [{ text: 'the transcript' }] } }] });

    await expect(invoke()).resolves.toBe('the transcript');
    // The secrets above are placeholders, but they only mean anything if they reach the request — without
    // this, a regression dropping the project or key from the URL passes every test here.
    const url = String(vi.mocked(globalThis.fetch).mock.calls[0][0]);
    expect(url).toContain('/projects/test-project/');
    expect(url).toContain('key=test-key');
  });
});
