import { describe, expect, it, vi } from 'vitest';
import { retryWithBackoff } from './candidApi';

const okResponse = (body: unknown = { value: 'ok' }): any => ({
  ok: true,
  body,
  rawResponse: { status: 200, headers: new Headers() },
});

const tooManyRequestsResponse = (retryAfterSeconds?: number): any => {
  const headers = new Headers();
  if (retryAfterSeconds != null) headers.set('retry-after', String(retryAfterSeconds));
  return {
    ok: false,
    error: { errorName: 'TooManyRequestsError' },
    rawResponse: { status: 429, headers },
  };
};

describe('candidApi shared helpers', () => {
  describe('retryWithBackoff', () => {
    it('returns immediately on a successful response without retrying', async () => {
      const fn = vi.fn().mockResolvedValueOnce(okResponse({ value: 1 }));
      const result = await retryWithBackoff(fn, 4, 1);
      expect(result.ok).toBe(true);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('retries on a 429 response then returns success', async () => {
      const fn = vi
        .fn()
        .mockResolvedValueOnce(tooManyRequestsResponse())
        .mockResolvedValueOnce(okResponse({ value: 'recovered' }));
      const result = await retryWithBackoff(fn, 4, 1);
      expect(result.ok).toBe(true);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('returns the last 429 response after exhausting retries', async () => {
      const fn = vi.fn().mockResolvedValue(tooManyRequestsResponse());
      const result = await retryWithBackoff(fn, 2, 1);
      expect(result.ok).toBe(false);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('honors Retry-After header when present', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const fn = vi.fn().mockResolvedValueOnce(tooManyRequestsResponse(1)).mockResolvedValueOnce(okResponse());
      await retryWithBackoff(fn, 4, 50);
      // The first scheduled delay should be ~1000ms (from Retry-After: 1), not the
      // computed baseDelayMs * 2^0 ≈ 50ms.
      const firstDelay = setTimeoutSpy.mock.calls[0]?.[1] as number;
      expect(firstDelay).toBe(1000);
      setTimeoutSpy.mockRestore();
    });

    it('honors Retry-After when headers are a plain object with mixed case', async () => {
      const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
      const plainHeaderResponse: any = {
        ok: false,
        error: { errorName: 'TooManyRequestsError' },
        rawResponse: { status: 429, headers: { 'Retry-After': '2' } },
      };
      const fn = vi.fn().mockResolvedValueOnce(plainHeaderResponse).mockResolvedValueOnce(okResponse());
      await retryWithBackoff(fn, 4, 50);
      const firstDelay = setTimeoutSpy.mock.calls[0]?.[1] as number;
      expect(firstDelay).toBe(2000);
      setTimeoutSpy.mockRestore();
    });

    it('does not retry on non-429 error responses', async () => {
      const fn = vi.fn().mockResolvedValueOnce({
        ok: false,
        error: { errorName: 'OtherError' },
        rawResponse: { status: 500, headers: new Headers() },
      });
      const result = await retryWithBackoff(fn, 4, 1);
      expect(result.ok).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
