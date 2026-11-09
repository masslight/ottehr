import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPresignedURL } from './helpers';

const Z3_URL = 'https://project-api.test/v1/z3/project-bucket/patient/file.pdf';
const SIGNED_URL = 'https://s3.test/file.pdf';

describe('getPresignedURL', () => {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => ({
    ok: true,
    json: async () => ({ signedUrl: SIGNED_URL }),
  }));

  beforeEach(() => {
    fetchMock.mockClear();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends the same download request as before when no signal is passed', async () => {
    await expect(getPresignedURL(Z3_URL, 'token')).resolves.toBe(SIGNED_URL);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    expect(input).toBe(Z3_URL);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ Authorization: 'Bearer token' });
    expect(init?.body).toBe(JSON.stringify({ action: 'download' }));
    expect(init?.signal).toBeUndefined();
  });

  it('still honours an explicit action', async () => {
    await getPresignedURL(Z3_URL, 'token', 'upload');

    expect(fetchMock.mock.calls[0][1]?.body).toBe(JSON.stringify({ action: 'upload' }));
  });

  it('passes the abort signal to the request, which also governs reading its response', async () => {
    const controller = new AbortController();

    await getPresignedURL(Z3_URL, 'token', 'download', controller.signal);

    expect(fetchMock.mock.calls[0][1]?.signal).toBe(controller.signal);
  });
});
