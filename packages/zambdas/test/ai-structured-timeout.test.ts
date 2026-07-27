import { afterEach, describe, expect, it, vi } from 'vitest';
import { invokeChatbotStructured, invokeChatbotVertexAI } from '../src/shared/ai';

// Timeout/escalation plumbing for invokeChatbotStructured (see ai.ts): every dispatch carries an
// AbortSignal.timeout budget, an abort of the primary is a structural failure that triggers the
// single escalation to the backup, and an aborted budget is never retried inside the Vertex helper.

const SECRETS = {
  GOOGLE_CLOUD_PROJECT_ID: 'test-project',
  GOOGLE_CLOUD_API_KEY: 'test-google-key',
  ANTHROPIC_API_KEY: 'test-anthropic-key',
};

const SCHEMA = { type: 'object', properties: { ok: { type: 'boolean' } } };

const isVertexUrl = (url: unknown): boolean => String(url).includes('aiplatform.googleapis.com');

const anthropicOkResponse = (): Response =>
  new Response(
    JSON.stringify({
      content: [{ type: 'tool_use', name: 'emit_result', input: { ok: true } }],
      usage: {},
      stop_reason: 'tool_use',
    }),
    { status: 200 }
  );

describe('invokeChatbotStructured timeout plumbing', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('gives both the primary and the backup call an AbortSignal budget, and escalates once on primary failure', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchMock = vi.fn(async (url: unknown, init: RequestInit) => {
      calls.push({ url: String(url), init });
      if (isVertexUrl(url)) {
        // 200 with no candidates → invokeChatbotVertexAI throws without retrying.
        return new Response('{}', { status: 200 });
      }
      return anthropicOkResponse();
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await invokeChatbotStructured([{ text: 'hi' }], SECRETS, SCHEMA);

    expect(JSON.parse(result)).toEqual({ ok: true });
    expect(calls).toHaveLength(2);
    expect(calls[0].url).toContain('aiplatform.googleapis.com');
    expect(calls[0].init.signal).toBeInstanceOf(AbortSignal);
    expect(calls[1].url).toContain('api.anthropic.com');
    expect(calls[1].init.signal).toBeInstanceOf(AbortSignal);
    // Distinct budgets: the backup must get its own (fresh) deadline, not the primary's spent one.
    expect(calls[1].init.signal).not.toBe(calls[0].init.signal);
  });

  it('treats an aborted budget as a structural failure in the Vertex helper: no retries, fails immediately', async () => {
    const fetchMock = vi.fn(async (_url: unknown, init: RequestInit) => {
      // Mimic real fetch: reject immediately when the signal is already aborted.
      init.signal?.throwIfAborted();
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      invokeChatbotVertexAI([{ text: 'hi' }], SECRETS, SCHEMA, undefined, undefined, 1024, AbortSignal.abort())
    ).rejects.toThrow();
    // The abort must NOT be retried like a transient network failure (would be 3 calls + backoff).
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('escalates to the backup when the primary fails with an undici/AbortSignal timeout shape', async () => {
    // Timeout-shaped rejections whose outer budget has NOT yet fired count as network failures and
    // are retried inside the Vertex helper; once retries are exhausted the escalation still runs.
    // Fake timers fast-forward the retry backoff sleeps (AbortSignal.timeout is not faked).
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: unknown) => {
      if (isVertexUrl(url)) {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      }
      return anthropicOkResponse();
    });
    vi.stubGlobal('fetch', fetchMock);

    const promise = invokeChatbotStructured([{ text: 'hi' }], SECRETS, SCHEMA);
    await vi.advanceTimersByTimeAsync(20_000); // covers the ~3s + ~6s retry backoffs
    const result = await promise;

    expect(JSON.parse(result)).toEqual({ ok: true });
    // 3 Vertex attempts, then exactly one backup attempt — no extra retries.
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.map(([url]) => isVertexUrl(url))).toEqual([true, true, true, false]);
  });
});
