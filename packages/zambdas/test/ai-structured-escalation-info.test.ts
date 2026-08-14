import { EasyChartEscalationInfo } from 'utils/lib/types/data/easy-chart-agent.types';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { invokeChatbotStructured } from '../src/shared/ai';

// onEscalation observability plumbing for invokeChatbotStructured (see ai.ts): the callback fires
// exactly once per call with { primaryFailed, primaryAttempts, reason? }, purely as measurement —
// the escalation behavior itself (covered by ai-structured-timeout / ai-structured-empty-result)
// must be unchanged with or without the callback.

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

// Collects onEscalation reports; each invoke below must produce exactly one.
const collector = (): { reports: EasyChartEscalationInfo[]; onEscalation: (e: EasyChartEscalationInfo) => void } => {
  const reports: EasyChartEscalationInfo[] = [];
  return { reports, onEscalation: (e) => reports.push(e) };
};

describe('invokeChatbotStructured onEscalation info', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('primary succeeds first try → primaryFailed false, 1 attempt, no reason', async () => {
    const fetchMock = vi.fn(async () => vertexOkResponse(FULL_PLAN));
    vi.stubGlobal('fetch', fetchMock);
    const { reports, onEscalation } = collector();

    const result = await invokeChatbotStructured(
      [{ text: 'hi' }],
      SECRETS,
      SCHEMA,
      undefined,
      undefined,
      undefined,
      undefined,
      onEscalation
    );

    expect(JSON.parse(result)).toEqual(FULL_PLAN);
    expect(reports).toEqual([{ primaryFailed: false, primaryAttempts: 1 }]);
  });

  it('empty response (no candidates) → backup covers; reason "empty-response"', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      // 200 with no candidates → the observed 0-in/0-out-token Gemini failure.
      if (isVertexUrl(url)) return new Response('{}', { status: 200 });
      return anthropicOkResponse(FULL_PLAN);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { reports, onEscalation } = collector();

    const result = await invokeChatbotStructured(
      [{ text: 'hi' }],
      SECRETS,
      SCHEMA,
      undefined,
      undefined,
      undefined,
      undefined,
      onEscalation
    );

    expect(JSON.parse(result)).toEqual(FULL_PLAN);
    expect(reports).toEqual([{ primaryFailed: true, primaryAttempts: 1, reason: 'empty-response' }]);
  });

  it('timeout-shaped primary failure → reason "timeout"', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async (url: unknown) => {
      if (isVertexUrl(url)) {
        throw new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      }
      return anthropicOkResponse(FULL_PLAN);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { reports, onEscalation } = collector();

    const promise = invokeChatbotStructured(
      [{ text: 'hi' }],
      SECRETS,
      SCHEMA,
      undefined,
      undefined,
      undefined,
      undefined,
      onEscalation
    );
    await vi.advanceTimersByTimeAsync(20_000); // covers the ~3s + ~6s Vertex retry backoffs
    const result = await promise;

    expect(JSON.parse(result)).toEqual(FULL_PLAN);
    expect(reports).toEqual([{ primaryFailed: true, primaryAttempts: 1, reason: 'timeout' }]);
  });

  it('guard-rejected retry succeeds → primaryFailed false with 2 attempts', async () => {
    let vertexCalls = 0;
    const fetchMock = vi.fn(async (url: unknown) => {
      if (isVertexUrl(url)) {
        vertexCalls++;
        return vertexOkResponse(vertexCalls === 1 ? EMPTY_PLAN : FULL_PLAN);
      }
      return anthropicOkResponse(FULL_PLAN);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { reports, onEscalation } = collector();

    const result = await invokeChatbotStructured(
      [{ text: 'hi' }],
      SECRETS,
      SCHEMA,
      undefined,
      undefined,
      undefined,
      acceptNonEmptySteps,
      onEscalation
    );

    expect(JSON.parse(result)).toEqual(FULL_PLAN);
    expect(reports).toEqual([{ primaryFailed: false, primaryAttempts: 2 }]);
  });

  it('guard rejects twice → backup covers; reason "rejected-by-acceptResult", 2 attempts', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (isVertexUrl(url)) return vertexOkResponse(EMPTY_PLAN);
      return anthropicOkResponse(FULL_PLAN);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { reports, onEscalation } = collector();

    const result = await invokeChatbotStructured(
      [{ text: 'hi' }],
      SECRETS,
      SCHEMA,
      undefined,
      undefined,
      undefined,
      acceptNonEmptySteps,
      onEscalation
    );

    expect(JSON.parse(result)).toEqual(FULL_PLAN);
    expect(reports).toEqual([{ primaryFailed: true, primaryAttempts: 2, reason: 'rejected-by-acceptResult' }]);
  });

  it('primary truncation (MAX_TOKENS) → reason "truncated"', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (isVertexUrl(url)) {
        return new Response(
          JSON.stringify({
            candidates: [{ content: { parts: [{ text: '{"steps": [' }] }, finishReason: 'MAX_TOKENS' }],
          }),
          { status: 200 }
        );
      }
      return anthropicOkResponse(FULL_PLAN);
    });
    vi.stubGlobal('fetch', fetchMock);
    const { reports, onEscalation } = collector();

    const result = await invokeChatbotStructured(
      [{ text: 'hi' }],
      SECRETS,
      SCHEMA,
      undefined,
      undefined,
      undefined,
      undefined,
      onEscalation
    );

    expect(JSON.parse(result)).toEqual(FULL_PLAN);
    expect(reports).toEqual([{ primaryFailed: true, primaryAttempts: 1, reason: 'truncated' }]);
  });

  it('primary failure is still reported when the backup ALSO fails (whole call throws)', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (isVertexUrl(url)) return new Response('{}', { status: 200 });
      return new Response('backup down', { status: 500 });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { reports, onEscalation } = collector();

    await expect(
      invokeChatbotStructured(
        [{ text: 'hi' }],
        SECRETS,
        SCHEMA,
        undefined,
        undefined,
        undefined,
        undefined,
        onEscalation
      )
    ).rejects.toThrow();
    expect(reports).toEqual([{ primaryFailed: true, primaryAttempts: 1, reason: 'empty-response' }]);
  });

  it('no onEscalation provided → behavior unchanged', async () => {
    const fetchMock = vi.fn(async (url: unknown) => {
      if (isVertexUrl(url)) return new Response('{}', { status: 200 });
      return anthropicOkResponse(FULL_PLAN);
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await invokeChatbotStructured([{ text: 'hi' }], SECRETS, SCHEMA);
    expect(JSON.parse(result)).toEqual(FULL_PLAN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
