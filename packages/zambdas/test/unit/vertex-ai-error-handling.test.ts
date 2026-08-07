import { Secrets, SecretsKeys } from 'utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { invokeChatbotVertexAI } from '../../src/shared/ai';

// Sentry is initialised at module scope in the lambda wrapper; captureException is all this path touches.
vi.mock('@sentry/aws-serverless', () => ({ captureException: vi.fn() }));

// Keyed off SecretsKeys so the test breaks if the code starts reading a different secret.
const secrets: Secrets = {
  [SecretsKeys.GOOGLE_CLOUD_PROJECT_ID]: 'test-project',
  [SecretsKeys.GOOGLE_CLOUD_API_KEY]: 'test-key',
};

const respondWith = (status: number, body: unknown): void => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 400 ? 'Bad Request' : 'OK',
      text: async () => JSON.stringify(body),
    }))
  );
};

beforeEach(() => {
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

describe('invokeChatbotVertexAI error handling', () => {
  test('a 400 surfaces the status and Vertex message instead of a TypeError', async () => {
    // The body Vertex returned for the unparseable upload. It used to fall through to `candidates[0]`, so
    // every failure looked like "TypeError: Cannot read properties of undefined" with an empty stack.
    respondWith(400, {
      error: { code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' },
    });

    await expect(invoke()).rejects.toThrow(/Vertex AI request failed: 400 Bad Request.*INVALID_ARGUMENT/s);
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
