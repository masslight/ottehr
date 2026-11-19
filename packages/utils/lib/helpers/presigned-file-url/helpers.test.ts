import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertZ3Url, getPresignedURL } from './helpers';

const Z3_URL = 'https://project-api.zapehr.com/v1/z3/project-bucket/patient/file.pdf';
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

describe('assertZ3Url', () => {
  it.each([
    'https://project-api.zapehr.com/v1/z3/project-bucket/patient/file.pdf',
    'https://testing.project-api.zapehr.com/v1/z3/project-bucket/patient/file.pdf',
  ])('accepts %s', (url) => {
    expect(assertZ3Url(url)).toBe(url);
  });

  it.each([
    'not a url',
    'http://project-api.zapehr.com/v1/z3/project-bucket/patient/file.pdf',
    'https://other.example/v1/z3/project-bucket/patient/file.pdf',
    'https://project-api.zapehr.com.other.example/v1/z3/project-bucket/file.pdf',
    'https://user@project-api.zapehr.com/v1/z3/project-bucket/file.pdf',
    'https://project-api.zapehr.com:8443/v1/z3/project-bucket/file.pdf',
    'https://project-api.zapehr.com/v1/zambda/some-id/execute-public',
    'https://project-api.zapehr.com/v1/z3/project-bucket/patient/../../../zambda/some-id/execute-public',
    'https://project-api.zapehr.com/v1/z3/project-bucket/patient/%2e%2e/%2e%2e/%2e%2e/zambda/x/execute-public',
    'https://project-api.zapehr.com/v1/z3/project-bucket/patient%2F..%2F..%2Fx',
    'https://project-api.zapehr.com/v1/z3/project-bucket/a\\..\\..\\..\\zambda/x/execute-public',
    'https://project-api.zapehr.com/v1/z3/project-bucket',
  ])('rejects %s', (url) => {
    expect(() => assertZ3Url(url)).toThrow();
  });
});

describe('getPresignedURL with an invalid URL', () => {
  it('makes no request', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(getPresignedURL('https://other.example/x.png', 'token')).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
