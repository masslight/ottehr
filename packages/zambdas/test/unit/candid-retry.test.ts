import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { recoverCandidEncounterAfter422, retryCandidCall } from '../../src/shared/candid';

// ── retryCandidCall ────────────────────────────────────────────────────────────

describe('retryCandidCall', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function ok<T>(body: T): { ok: true; body: T; rawResponse: any } {
    return { ok: true as const, body, rawResponse: { status: 200 } as any };
  }

  function rateLimitResponse(): { ok: false; error: { errorName: string }; rawResponse: any } {
    return {
      ok: false as const,
      error: { errorName: 'TooManyRequestsError' },
      rawResponse: { status: 429 } as any,
    };
  }

  function errorResponse(errorName = 'UnknownError'): { ok: false; error: { errorName: string }; rawResponse: any } {
    return {
      ok: false as const,
      error: { errorName },
      rawResponse: { status: 400 } as any,
    };
  }

  it('returns response immediately on success without retrying', async () => {
    const fn = vi.fn().mockResolvedValue(ok({ id: '1' }));

    const promise = retryCandidCall(fn, 3, 0);
    await vi.runAllTimersAsync();

    expect((await promise).ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('returns non-rate-limit error response immediately without retrying', async () => {
    const fn = vi.fn().mockResolvedValue(errorResponse('ValidationError'));

    const promise = retryCandidCall(fn, 3, 0);
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.ok).toBe(false);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries once on TooManyRequestsError response then succeeds', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(ok({ id: '2' }));

    const promise = retryCandidCall(fn, 3, 0);
    await vi.runAllTimersAsync();

    expect((await promise).ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries multiple times on consecutive rate-limit responses then succeeds', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(rateLimitResponse())
      .mockResolvedValueOnce(ok({ id: '3' }));

    const promise = retryCandidCall(fn, 3, 0);
    await vi.runAllTimersAsync();

    expect((await promise).ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('returns rate-limit response after exhausting maxRetries', async () => {
    const fn = vi.fn().mockResolvedValue(rateLimitResponse());

    const promise = retryCandidCall(fn, 2, 0);
    await vi.runAllTimersAsync();
    const response = await promise;

    expect(response.ok).toBe(false);
    expect((response as any).error.errorName).toBe('TooManyRequestsError');
    // attempts 0, 1, 2 (= maxRetries) — returns on the last attempt, 3 calls total
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('retries on TooManyRequestsError thrown via body.errorName', async () => {
    const rateLimitError = { body: { errorName: 'TooManyRequestsError' }, message: 'rate limited' };
    const fn = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce(ok({ id: '4' }));

    const promise = retryCandidCall(fn, 3, 0);
    await vi.runAllTimersAsync();

    expect((await promise).ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('retries on "too many requests" in error message', async () => {
    const rateLimitError = new Error('Too Many Requests, slow down');
    const fn = vi
      .fn()
      .mockRejectedValueOnce(rateLimitError)
      .mockResolvedValueOnce(ok({ id: '5' }));

    const promise = retryCandidCall(fn, 3, 0);
    await vi.runAllTimersAsync();

    expect((await promise).ok).toBe(true);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on a non-rate-limit thrown exception', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('Internal Server Error'));

    await expect(retryCandidCall(fn, 3, 0)).rejects.toThrow('Internal Server Error');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('throws the rate-limit error after exhausting maxRetries for thrown exceptions', async () => {
    const rateLimitError = { body: { errorName: 'TooManyRequestsError' }, message: 'rate limited' };
    const fn = vi.fn().mockRejectedValue(rateLimitError);

    const promise = retryCandidCall(fn, 2, 0);
    // Attach the rejection handler before advancing timers to prevent unhandled-rejection noise
    const expectation = expect(promise).rejects.toEqual(rateLimitError);
    await vi.runAllTimersAsync();
    await expectation;

    // attempts 0, 1, 2 (= maxRetries) → throws on attempt 2; 3 calls total
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

// ── recoverCandidEncounterAfter422 ─────────────────────────────────────────────

describe('recoverCandidEncounterAfter422', () => {
  function makeMockClient(getAllResult: unknown): any {
    return {
      encounters: {
        v4: {
          getAll: vi.fn().mockResolvedValue(getAllResult),
        },
      },
    };
  }

  function makeUniquenessErrorResponse(): any {
    return {
      ok: false as const,
      error: { errorName: 'EncounterExternalIdUniquenessError' },
      rawResponse: { status: 422 },
    };
  }

  it('returns the candidEncounterId when the encounter is found by externalId', async () => {
    const client = makeMockClient({
      ok: true,
      body: {
        items: [{ externalId: 'fhir-enc-1', encounterId: 'candid-enc-abc' }],
      },
    });

    const result = await recoverCandidEncounterAfter422('fhir-enc-1', client, makeUniquenessErrorResponse());

    expect(result).toBe('candid-enc-abc');
    expect(client.encounters.v4.getAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
  });

  it('throws EncounterExternalIdUniquenessError when getAll returns !ok', async () => {
    const client = makeMockClient({ ok: false, error: { message: 'Not found' } });

    await expect(recoverCandidEncounterAfter422('fhir-enc-1', client, makeUniquenessErrorResponse())).rejects.toThrow(
      'EncounterExternalIdUniquenessError'
    );
  });

  it('throws EncounterExternalIdUniquenessError when getAll returns empty items', async () => {
    const client = makeMockClient({ ok: true, body: { items: [] } });

    await expect(recoverCandidEncounterAfter422('fhir-enc-1', client, makeUniquenessErrorResponse())).rejects.toThrow(
      'EncounterExternalIdUniquenessError'
    );
  });

  it('returns undefined when items list has no matching externalId', async () => {
    const client = makeMockClient({
      ok: true,
      body: {
        items: [{ externalId: 'different-id', encounterId: 'candid-enc-xyz' }],
      },
    });

    const result = await recoverCandidEncounterAfter422('fhir-enc-1', client, makeUniquenessErrorResponse());

    expect(result).toBeUndefined();
  });

  it('includes the fhirEncounterId in the error message when lookup fails', async () => {
    const client = makeMockClient({ ok: false, error: {} });

    await expect(recoverCandidEncounterAfter422('fhir-enc-99', client, makeUniquenessErrorResponse())).rejects.toThrow(
      'fhir-enc-99'
    );
  });

  it('throws without calling getAll when errorName is not EncounterExternalIdUniquenessError', async () => {
    const client = makeMockClient({ ok: true, body: { items: [] } });
    const otherErrorResponse: any = {
      ok: false as const,
      error: { errorName: 'SomeOtherError' },
      rawResponse: { status: 422 },
    };

    await expect(recoverCandidEncounterAfter422('fhir-enc-1', client, otherErrorResponse)).rejects.toThrow(
      'Error creating a Candid encounter'
    );
    expect(client.encounters.v4.getAll).not.toHaveBeenCalled();
  });
});
