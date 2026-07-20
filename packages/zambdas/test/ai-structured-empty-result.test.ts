import { afterEach, describe, expect, it, vi } from 'vitest';
import { invokeChatbotStructured } from '../src/shared/ai';

// acceptResult guard plumbing for invokeChatbotStructured (see ai.ts): a syntactically valid
// result the caller's acceptResult rejects (e.g. flash-lite's one-off {"steps": []} for a rich
// narrative) is a soft failure — retry the primary once, then escalate to the backup; a rejected
// backup result is still returned (the guard is best-effort, never a caller-visible error). With
// no acceptResult provided, behavior is unchanged.

const SECRETS = {
  GOOGLE_CLOUD_PROJECT_ID: 'test-project',
  GOOGLE_CLOUD_API_KEY: 'test-google-key',
  ANTHROPIC_API_KEY: 'test-anthropic-key',
};

const SCHEMA = { type: 'object', properties: { steps: { type: 'array' } } };

const isVertexUrl = (url: unknown): boolean => String(url).includes('aiplatform.googleapis.com');

const vertexOkResponse = (payload: unknown): Response =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }],
    }),
    { status: 200 }
  );

const anthropicOkResponse = (payload: unknown): Response =>
  new Response(
    JSON.stringify({
      content: [{ type: 'tool_use', name: 'emit_result', input: payload }],
      usage: {},
      stop_reason: 'tool_use',
    }),
    { status: 200 }
  );

const EMPTY_PLAN = { steps: [] };
const FULL_PLAN = { steps: [{ kind: 'set-em-code' }] };

// Mirrors the planner's guard: reject an empty/absent steps array.
const acceptNonEmptySteps = (parsed: unknown): boolean => {
  const steps = (parsed as { steps?: unknown } | null)?.steps;
  return Array.isArray(steps) && steps.length > 0;
};

describe('invokeChatbotStructured acceptResult guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('primary empty → primary retry empty → backup non-empty wins', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (isVertexUrl(url)) return vertexOkResponse(EMPTY_PLAN);
      return anthropicOkResponse(FULL_PLAN);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await invokeChatbotStructured(
      [{ text: 'hi' }],
      SECRETS,
      SCHEMA,
      undefined,
      undefined,
      undefined,
      acceptNonEmptySteps
    );

    expect(JSON.parse(result)).toEqual(FULL_PLAN);
    // Two primary attempts (initial + one retry), then exactly one backup attempt.
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => isVertexUrl(url))).toEqual([true, true, false]);
  });

  it('primary empty → retry non-empty wins, no backup call', async () => {
    let vertexCalls = 0;
    const fetchMock = vi.fn(async (url: unknown) => {
      if (isVertexUrl(url)) {
        vertexCalls++;
        return vertexOkResponse(vertexCalls === 1 ? EMPTY_PLAN : FULL_PLAN);
      }
      return anthropicOkResponse(FULL_PLAN);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await invokeChatbotStructured(
      [{ text: 'hi' }],
      SECRETS,
      SCHEMA,
      undefined,
      undefined,
      undefined,
      acceptNonEmptySteps
    );

    expect(JSON.parse(result)).toEqual(FULL_PLAN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => isVertexUrl(url))).toBe(true);
  });

  it('all attempts empty → returns the backup result without throwing', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (isVertexUrl(url)) return vertexOkResponse(EMPTY_PLAN);
      return anthropicOkResponse(EMPTY_PLAN);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await invokeChatbotStructured(
      [{ text: 'hi' }],
      SECRETS,
      SCHEMA,
      undefined,
      undefined,
      undefined,
      acceptNonEmptySteps
    );

    // Best-effort guard: the (rejected) backup result comes back as a plain success.
    expect(JSON.parse(result)).toEqual(EMPTY_PLAN);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls.map(([url]) => isVertexUrl(url))).toEqual([true, true, false]);
  });

  it('no acceptResult provided → behavior unchanged (single primary call, empty result passes)', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (isVertexUrl(url)) return vertexOkResponse(EMPTY_PLAN);
      return anthropicOkResponse(FULL_PLAN);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await invokeChatbotStructured([{ text: 'hi' }], SECRETS, SCHEMA);

    expect(JSON.parse(result)).toEqual(EMPTY_PLAN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(isVertexUrl(fetchMock.mock.calls[0][0])).toBe(true);
  });
});
