import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { advaPacsFetch } from '../../src/ehr/radiology/shared';

// How fetch surfaces a refused connection: a generic TypeError with the real code on `cause`.
function connectionError(code = 'ECONNREFUSED'): TypeError {
  const error = new TypeError('fetch failed');
  (error as any).cause = Object.assign(new Error(`connect ${code} 1.2.3.4:443`), { code });
  return error;
}

function response(status = 200): Response {
  return { ok: status >= 200 && status < 300, status } as Response;
}

describe('advaPacsFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns the response without retrying on success', async () => {
    fetchMock.mockResolvedValue(response());

    const promise = advaPacsFetch('https://advapacs.test/fhir/R5', { method: 'GET' });
    await vi.runAllTimersAsync();

    expect((await promise).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries ECONNREFUSED and resolves once a later attempt connects', async () => {
    fetchMock
      .mockRejectedValueOnce(connectionError())
      .mockRejectedValueOnce(connectionError())
      .mockResolvedValueOnce(response());

    const promise = advaPacsFetch('https://advapacs.test/fhir/R5', { method: 'GET' });
    await vi.runAllTimersAsync();

    expect((await promise).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries a write too, since a thrown error means there was no response', async () => {
    fetchMock.mockRejectedValueOnce(connectionError()).mockResolvedValueOnce(response());

    const promise = advaPacsFetch('https://advapacs.test/fhir/R5', { method: 'PUT' });
    await vi.runAllTimersAsync();

    expect((await promise).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('makes 4 attempts total before giving up, and rejects with the connection error', async () => {
    fetchMock.mockRejectedValue(connectionError());

    const promise = advaPacsFetch('https://advapacs.test/fhir/R5', { method: 'GET' });
    const assertion = expect(promise).rejects.toThrow('fetch failed');
    await vi.runAllTimersAsync();
    await assertion;

    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('backs off exponentially between attempts rather than retrying immediately', async () => {
    fetchMock.mockRejectedValue(connectionError());

    const startedAt = Date.now();
    const promise = advaPacsFetch('https://advapacs.test/fhir/R5', { method: 'GET' });
    const assertion = expect(promise).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;

    // 500 + 1000 + 2000, each scaled 1-2x by randomize before the 2000 cap.
    const elapsed = Date.now() - startedAt;
    expect(elapsed).toBeGreaterThanOrEqual(3500);
    expect(elapsed).toBeLessThanOrEqual(6000);
  });

  it('resolves non-ok responses without retrying, leaving status handling to the caller', async () => {
    fetchMock.mockResolvedValue(response(503));

    const promise = advaPacsFetch('https://advapacs.test/fhir/R5', { method: 'GET' });
    await vi.runAllTimersAsync();

    expect((await promise).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
