import { Secrets } from 'utils/lib/secrets';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { callModelForJson } from './model';

const secrets: Secrets = { GOOGLE_CLOUD_PROJECT_ID: 'project', GOOGLE_CLOUD_API_KEY: 'key' };

const vertexAnswer = (text: string): Response =>
  new Response(JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }] }), {
    status: 200,
  });

describe('callModelForJson', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the parsed answer from the first attempt', async () => {
    const fetchMock = vi.fn(async () => vertexAnswer('{"lines": []}'));
    vi.stubGlobal('fetch', fetchMock);
    const result = await callModelForJson({
      prompt: 'p',
      wireSchema: {},
      responseSchema: z.object({ lines: z.array(z.string()) }),
      secrets,
      logPrefix: 'test',
    });
    expect(result.parsed).toEqual({ lines: [] });
    expect(result.escalation).toEqual({ attempts: 1, escalated: false, failures: [] });
  });

  it('falls back to Claude with the same schema, answered through a forced tool call', async () => {
    const wireSchema = { type: 'object', properties: { lines: { type: 'array', items: { type: 'string' } } } };
    const anthropicRequests: Record<string, unknown>[] = [];
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      if (!String(url).includes('anthropic')) return new Response('unavailable', { status: 503 });
      anthropicRequests.push(JSON.parse(String(init?.body)));
      return new Response(
        JSON.stringify({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-4-5-20251001',
          content: [{ type: 'tool_use', id: 'toolu_1', name: 'record_answer', input: { lines: ['a'] } }],
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await callModelForJson({
      prompt: 'p',
      wireSchema,
      responseSchema: z.object({ lines: z.array(z.string()) }),
      secrets: { ...secrets, ANTHROPIC_API_KEY: 'test-key' },
      logPrefix: 'test',
    });

    expect(result.parsed).toEqual({ lines: ['a'] });
    expect(result.escalation).toMatchObject({ attempts: 3, escalated: true });
    expect(anthropicRequests).toHaveLength(1);
    expect(anthropicRequests[0]).toMatchObject({
      tools: [{ name: 'record_answer', input_schema: wireSchema }],
      tool_choice: { type: 'tool', name: 'record_answer' },
    });
  });

  it('starts no further attempt once the caller aborts', async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn(async () => {
      controller.abort();
      throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    });
    vi.stubGlobal('fetch', fetchMock);
    await expect(
      callModelForJson({
        prompt: 'p',
        wireSchema: {},
        responseSchema: z.object({}),
        secrets,
        logPrefix: 'test',
        signal: controller.signal,
      })
    ).rejects.toThrow('Easy Chart model call failed after 1 attempts (timeout)');
    // no retry and no escalation to the backup model
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
