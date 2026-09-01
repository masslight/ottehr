import { APIErrorCode } from 'utils/lib/types/errors';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { extractInsuranceCardFieldsFromImage } from '../../src/ehr/extract-insurance-card/helpers';
import { VertexAIRequestError } from '../../src/shared/ai';

// Keep the real VertexAIRequestError class (the helper does `instanceof` checks against it) and only
// replace the network-bound invokeChatbotVertexAI with a mock we can drive per-test.
vi.mock('../../src/shared/ai', async () => {
  const actual = await vi.importActual<typeof import('../../src/shared/ai')>('../../src/shared/ai');
  return {
    ...actual,
    invokeChatbotVertexAI: vi.fn(),
  };
});

// Pulling in the helper's dependency graph shouldn't drag the real Sentry SDK into a unit test.
vi.mock('@sentry/aws-serverless', () => ({
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  init: vi.fn(),
  isInitialized: vi.fn(() => true),
  setTag: vi.fn(),
  setTags: vi.fn(),
  wrapHandler: (handler: unknown) => handler,
}));

const { invokeChatbotVertexAI } = await import('../../src/shared/ai');
const mockInvoke = vi.mocked(invokeChatbotVertexAI);

afterEach(() => {
  mockInvoke.mockReset();
});

describe('extractInsuranceCardFieldsFromImage error translation', () => {
  test('a Vertex 4xx is translated into an INVALID_INPUT APIError (renders as HTTP 400)', async () => {
    mockInvoke.mockRejectedValueOnce(
      new VertexAIRequestError('Vertex AI request failed: 400 Bad Request Request contains an invalid argument.', 400)
    );

    const error = await extractInsuranceCardFieldsFromImage(Buffer.from('x'), 'image/png', null).then(
      () => null,
      (error: unknown) => error
    );

    expect(error).not.toBeNull();
    expect((error as { code?: number }).code).toBe(APIErrorCode.INVALID_INPUT);
  });

  test('a Vertex 5xx is NOT translated — it stays a server error', async () => {
    const original = new VertexAIRequestError('Vertex AI request failed: 500 Internal Server Error', 500);
    mockInvoke.mockRejectedValueOnce(original);

    const error = await extractInsuranceCardFieldsFromImage(Buffer.from('x'), 'image/png', null).then(
      () => null,
      (error: unknown) => error
    );

    expect(error).toBe(original);
  });
});
