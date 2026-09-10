import { APIGatewayProxyResult } from 'aws-lambda';
import { Secrets, SecretsKeys } from 'utils/lib/secrets';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { invokeChatbotVertexAI } from '../../src/shared/ai';
import { lambdaResponse } from '../../src/shared/lambda';
import { wrapHandler } from '../../src/shared/sentry';
import { ZambdaInput } from '../../src/shared/types/common';

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

// Per-attempt scripted responses that each take fake-clock time to arrive, so one attempt's request can
// still be in flight when another settles. Those interleavings are where a late rejection could escape.
const respondAfter = (...script: [delayMs: number, status: number, body: unknown][]): void => {
  let call = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      const [delay, status, body] = script[Math.min(call++, script.length - 1)];
      await new Promise((resolve) => setTimeout(resolve, delay));
      return responseOf(status, body);
    })
  );
};

// Runs a scenario with this file's own unhandledRejection listener as the only one installed, then drains
// every remaining timer and gives Node a real tick to reach its unhandled-rejection checkpoint. Vitest's
// own listeners are detached for the duration so the assertion below is the single source of truth.
const unhandledDuring = async (scenario: () => Promise<void>): Promise<unknown[]> => {
  const seen: unknown[] = [];
  const record = (reason: unknown): void => void seen.push(reason);
  const vitestListeners = process.listeners('unhandledRejection');
  vitestListeners.forEach((listener) => process.off('unhandledRejection', listener));
  process.on('unhandledRejection', record);
  try {
    await scenario();
    await vi.advanceTimersByTimeAsync(30_000); // outlast every backoff and scripted fetch delay
    vi.useRealTimers(); // Node reports unhandled rejections on a real tick, not a microtask
    await new Promise((resolve) => setTimeout(resolve, 10));
    vi.useFakeTimers();
  } finally {
    process.off('unhandledRejection', record);
    vitestListeners.forEach((listener) => process.on('unhandledRejection', listener));
  }
  return seen;
};

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

// How far the fake clock has to advance before the call settles. The retry ladder sleeps 3s and 6s before
// its later attempts, so this distinguishes a failure that surfaces at once from one that merely happens to
// make the same number of fetches — which is all a fetch-count assertion can see.
const settleDelay = async (): Promise<number> => {
  const start = Date.now();
  let elapsed = -1;
  const record = (): void => {
    if (elapsed < 0) elapsed = Date.now() - start;
  };
  const outcome = invokeChatbotVertexAI([{ text: 'hello' }], secrets).then(record, record);
  await vi.advanceTimersByTimeAsync(10_000);
  await outcome;
  return elapsed;
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
    respondWith(400, {
      error: { code: 400, message: 'Request contains an invalid argument.', status: 'INVALID_ARGUMENT' },
    });

    await expect(invoke()).rejects.toThrow(/Vertex AI request failed: 400 Bad Request.*INVALID_ARGUMENT/s);
    // And it stands alone rather than being wrapped in the ladder's message: a 400 is not an exhausted
    // ladder, and grouping the two together in Sentry is what made the empty-response issue hard to read.
    await expect(invoke()).rejects.not.toThrow(/after \d+ attempts/);
  });

  test('a non-retryable failure is not retried', async () => {
    respondWith(400, { error: { code: 400 } });

    await expect(invoke()).rejects.toThrow(/Vertex AI request failed/);
    // Resending a multi-megabyte inline audio payload two more times can only fail the same way.
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  test('a non-retryable failure surfaces at once, not after the backoff sleeps', async () => {
    respondWith(400, { error: { code: 400, status: 'INVALID_ARGUMENT' } });

    expect(await settleDelay()).toBe(0);
  });

  test('a 200 with no candidate text reports the reason, not the body', async () => {
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

// HTTP 200 is not enough to call an attempt successful — it has to have produced text. These cover the
// production failure in ai-interview-summary: gemini-3.1-flash-lite answered 200 with usageMetadata and no
// `candidates` at all, having spent the turn on thinking tokens. `resolved` was set on `response.ok`, so
// that empty body won Promise.any and the two remaining attempts were skipped as superseded.
describe('invokeChatbotVertexAI empty-output retries', () => {
  const EMPTY_200 = {
    usageMetadata: { promptTokenCount: 1525, totalTokenCount: 1798, thoughtsTokenCount: 273 },
  };
  const TEXT_200 = { candidates: [{ content: { parts: [{ text: 'the summary' }] } }] };

  test('a valid 200 wins on the first attempt, with no further request', async () => {
    respondWith(200, TEXT_200);

    await expect(invoke()).resolves.toBe('the summary');
    expect(globalThis.fetch).toHaveBeenCalledOnce();
  });

  test('an empty 200 is retried, and the next attempt wins', async () => {
    respondInSequence([200, EMPTY_200], [200, TEXT_200]);

    await expect(invoke()).resolves.toBe('the summary');
    // Two: the empty attempt no longer resolves the ladder, and the winner stops the third.
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  test('an empty 200 fails as a diagnosable error, not a TypeError', async () => {
    respondWith(200, EMPTY_200);

    const error = await invoke().then(
      () => null,
      (error: Error) => error
    );
    // `response.candidates[0]` on a candidate-less body is where the old TypeError came from.
    expect(error).not.toBeInstanceOf(TypeError);
    expect(error?.message).toMatch(/Vertex AI returned no text/);
    // The reason has to name the cause, or the Sentry issue says only that something was empty.
    expect(error?.message).toMatch(/thoughtsTokenCount/);
  });

  test('a ladder of empty 200s is exhausted rather than resolved with an empty result', async () => {
    respondWith(200, EMPTY_200);

    const error = await invoke().then(
      () => null,
      (error: Error) => error
    );
    expect(error?.message).toMatch(/Vertex AI request failed after 3 attempts/);
    expect(error?.message).toMatch(/Vertex AI returned no text/);
    // The whole point: all three attempts are spent, where the first empty 200 used to end the ladder.
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  // Every shape short of usable text has to stay retryable, and none may throw on the way there.
  test.each([
    ['no candidates property', EMPTY_200],
    ['an empty candidates array', { candidates: [] }],
    ['an empty first candidate', { candidates: [{}] }],
    ['no content', { candidates: [{ finishReason: 'SAFETY' }] }],
    ['no parts', { candidates: [{ content: {} }] }],
    ['an empty parts array', { candidates: [{ content: { parts: [] } }] }],
    ['a part with no text', { candidates: [{ content: { parts: [{ inlineData: 'x' }] } }] }],
    ['empty text', { candidates: [{ content: { parts: [{ text: '' }] } }] }],
    // Whitespace has a non-zero length, so a bare `length === 0` guard let it through as a success and the
    // caller died in fixAndParseJsonObjectFromString instead — or charted a blank transcript.
    ['whitespace-only text', { candidates: [{ content: { parts: [{ text: '\n  \t' }] } }] }],
  ])('a 200 with %s stays retryable', async (_name, body) => {
    respondInSequence([200, body], [200, TEXT_200]);

    await expect(invoke()).resolves.toBe('the summary');
  });

  test('a whitespace-only ladder fails rather than returning blank text', async () => {
    respondWith(200, { candidates: [{ content: { parts: [{ text: '\n' }] } }] });

    const error = await invoke().then(
      () => null,
      (error: Error) => error
    );
    expect(error?.message).toMatch(/Vertex AI returned no text/);
    expect(globalThis.fetch).toHaveBeenCalledTimes(3);
  });

  test('a candidate-less body reports the metadata that names the cause', async () => {
    // The production shape: no candidates, so the whole account of what happened is the top-level metadata.
    // Hand-picking two fields left `Vertex AI returned no text: {}` and dropped the identifiers — the model
    // build and response id — that a Google support thread would ask for first.
    respondWith(200, {
      usageMetadata: { promptTokenCount: 1525, totalTokenCount: 1798, thoughtsTokenCount: 273 },
      modelVersion: 'gemini-3.1-flash-lite',
      responseId: 'ddf9bee1-21ef',
    });

    const error = await invoke().then(
      () => null,
      (error: Error) => error
    );
    expect(error?.message).toMatch(/thoughtsTokenCount/);
    expect(error?.message).toMatch(/gemini-3\.1-flash-lite/);
    expect(error?.message).toMatch(/ddf9bee1-21ef/);
  });

  test('a candidate carrying content is never quoted', async () => {
    // `content` present means the model produced something, and a sibling part can hold partial transcript.
    respondWith(200, {
      candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ inlineData: 'patient reports chest pain' }] } }],
    });

    const error = await invoke().then(
      () => null,
      (error: Error) => error
    );
    expect(error?.message).toMatch(/MAX_TOKENS/);
    expect(error?.message).not.toContain('chest pain');
  });

  test('the reason is capped, so a 200 that echoes the request cannot dump it', async () => {
    // Stripping `candidates` bounds a Gemini body but not a gateway envelope holding the request — on the
    // transcription path that is base64 audio. Uncapped it would be console.warned once per attempt and then
    // joined three times into the ladder's message on its way to CloudWatch and Sentry.
    respondWith(200, { echoedRequest: 'A'.repeat(20_000) });

    const error = await invoke().then(
      () => null,
      (error: Error) => error
    );
    expect(error?.message).toMatch(/Vertex AI returned no text/);
    // Three attempts, each capped at 1000, plus the ladder's own wrapper.
    expect(error?.message.length).toBeLessThan(3500);
  });

  test('a later candidate with text is never quoted either', async () => {
    // candidateCount is never set, so Vertex returns one candidate — but the report must not depend on that.
    // Deciding what is safe to include by looking at candidates[0] alone quotes candidate 1's text here.
    respondWith(200, {
      candidates: [{ finishReason: 'SAFETY' }, { content: { parts: [{ text: 'patient reports chest pain' }] } }],
      usageMetadata: { totalTokenCount: 1798 },
    });

    const error = await invoke().then(
      () => null,
      (error: Error) => error
    );
    expect(error?.message).toMatch(/Vertex AI returned no text/);
    expect(error?.message).toMatch(/SAFETY/);
    expect(error?.message).not.toContain('chest pain');
  });
});

// The ladder is Promise.race([Promise.any(attempts), terminalFailure]), so several promises can reject after
// the outer call has already settled. That is only safe because race and any attach their handlers when they
// are constructed, not when their inputs settle. These force each interleaving and assert nothing escapes.
describe('invokeChatbotVertexAI promise lifecycle', () => {
  const TEXT_200 = { candidates: [{ content: { parts: [{ text: 'the transcript' }] } }] };
  const EMPTY_200 = { usageMetadata: { totalTokenCount: 1798, thoughtsTokenCount: 273 } };

  const start = (): Promise<string> =>
    invokeChatbotVertexAI([{ text: 'hello' }], secrets).then(
      (value) => `resolved: ${value}`,
      (error: Error) => `rejected: ${error.message}`
    );

  // Awaiting the call before advancing the clock would deadlock, so the outcome is captured as a value.
  const settle = async (): Promise<string> => {
    const outcome = start();
    await vi.advanceTimersByTimeAsync(30_000);
    return outcome;
  };

  test('the watch detects an unhandled rejection, so the assertions below are not vacuous', async () => {
    const seen = await unhandledDuring(async () => {
      void Promise.reject(new Error('deliberately unhandled'));
    });

    expect(seen).toHaveLength(1);
    expect((seen[0] as Error).message).toBe('deliberately unhandled');
  });

  test('1. a valid response wins and the later attempts are superseded', async () => {
    respondWith(200, TEXT_200);
    let outcome = '';

    const seen = await unhandledDuring(async () => {
      outcome = await settle();
    });

    expect(outcome).toBe('resolved: the transcript');
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(seen).toEqual([]);
  });

  test('2. an empty 200 rejects its attempt and the next one wins', async () => {
    respondInSequence([200, EMPTY_200], [200, TEXT_200]);
    let outcome = '';

    const seen = await unhandledDuring(async () => {
      outcome = await settle();
    });

    expect(outcome).toBe('resolved: the transcript');
    expect(seen).toEqual([]);
  });

  test('3+4. a terminal status settles at once, and its superseded attempts stay handled', async () => {
    // The sharpest case: the outer call throws at t=0, then Promise.any rejects with its AggregateError at
    // ~6s once attempts 1 and 2 wake and find the ladder abandoned — long after race stopped listening.
    respondAfter([0, 403, { error: { code: 403, status: 'PERMISSION_DENIED' } }]);
    let outcome = '';

    const seen = await unhandledDuring(async () => {
      const pending = start();
      await vi.advanceTimersByTimeAsync(100); // far short of the 3s and 6s sleeps
      outcome = await pending;
      // Settled with both backoff sleeps still armed, which is the point of the race.
      expect(vi.getTimerCount()).toBe(2);
    });

    expect(outcome).toMatch(/^rejected: Vertex AI request failed: 403 .*PERMISSION_DENIED/s);
    expect(globalThis.fetch).toHaveBeenCalledOnce();
    expect(seen).toEqual([]);
  });

  test('5. an exhausted ladder handles its AggregateError, leaving terminalFailure pending forever', async () => {
    // terminalFailure never settles here. A permanently pending promise is not a leak — nothing references
    // it once the call returns — but it must not be what the catch block reports.
    respondWith(503, { error: { code: 503, message: 'The service is currently unavailable.' } });
    let outcome = '';

    const seen = await unhandledDuring(async () => {
      outcome = await settle();
    });

    expect(outcome).toMatch(/^rejected: Vertex AI request failed after 3 attempts/);
    expect(outcome).toMatch(/503.*currently unavailable/s);
    expect(seen).toEqual([]);
  });

  test('6. a terminal failure arriving after a success cannot disturb the settled result', async () => {
    // Attempt 0 is slow but good; attempt 1 starts at 3s and its 400 lands at 5s, a second after attempt 0
    // has already won and the caller has its text. failTerminally is called on an ignored promise.
    respondAfter([4000, 200, TEXT_200], [2000, 400, { error: { code: 400, status: 'INVALID_ARGUMENT' } }]);
    let outcome = '';

    const seen = await unhandledDuring(async () => {
      outcome = await settle();
    });

    expect(outcome).toBe('resolved: the transcript');
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(seen).toEqual([]);
  });

  test('7. backoff timers outlive the settle but do no observable work when they fire', async () => {
    // Lambda freezes the container on return with these still armed, so they run on the next thaw. The
    // superseded throw sits outside the try/catch, so a thawed attempt makes no request, logs nothing and
    // reports nothing — it only rejects into the handler Promise.any attached at construction.
    respondAfter([0, 401, { error: { code: 401, status: 'UNAUTHENTICATED' } }]);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const pending = start();
    await vi.advanceTimersByTimeAsync(100);
    await pending;

    expect(vi.getTimerCount()).toBe(2); // the 3s and 6s sleeps, still armed after the caller has its error
    const callsAtSettle = { fetch: vi.mocked(globalThis.fetch).mock.calls.length, warn: warn.mock.calls.length };

    await vi.advanceTimersByTimeAsync(30_000);

    expect(vi.mocked(globalThis.fetch).mock.calls.length).toBe(callsAtSettle.fetch);
    expect(warn.mock.calls.length).toBe(callsAtSettle.warn);
    expect(log).not.toHaveBeenCalled();

    warn.mockRestore();
    log.mockRestore();
  });
});
