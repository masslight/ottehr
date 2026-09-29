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
