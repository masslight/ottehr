import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPostGridLetter } from '../../src/shared/postgrid';

// ---------------------------------------------------------------------------
// Mock global fetch
// ---------------------------------------------------------------------------

const mockFetch = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', mockFetch);

// ---------------------------------------------------------------------------
// Mock getSecret — returns a fixed API key
// ---------------------------------------------------------------------------

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getSecret: () => 'test-postgrid-api-key',
  };
});

const secrets = { POSTGRID_API_KEY: 'test-postgrid-api-key' } as any;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getPostGridLetter', () => {
  it('throws when letterId is empty', async () => {
    await expect(getPostGridLetter('', secrets)).rejects.toThrow('PostGrid letterId is required');
  });

  it('throws when letterId is whitespace only', async () => {
    await expect(getPostGridLetter('   ', secrets)).rejects.toThrow('PostGrid letterId is required');
  });

  it('calls the correct PostGrid endpoint with API key header', async () => {
    const mockLetter = {
      id: 'letter_abc',
      object: 'letter',
      live: false,
      status: 'ready',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify(mockLetter),
    } as Response);

    const result = await getPostGridLetter('letter_abc', secrets);

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.postgrid.com/print-mail/v1/letters/letter_abc');
    expect(options?.method).toBe('GET');
    expect((options?.headers as Record<string, string>)['x-api-key']).toBe('test-postgrid-api-key');
    expect(result).toEqual(mockLetter);
  });

  it('encodes letterId in the URL', async () => {
    const mockLetter = {
      id: 'letter_special/chars',
      object: 'letter',
      live: false,
      status: 'ready',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify(mockLetter),
    } as Response);

    await getPostGridLetter('letter_special/chars', secrets);

    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.postgrid.com/print-mail/v1/letters/letter_special%2Fchars');
  });

  it('throws on non-OK response with error details', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      headers: new Headers(),
      text: async () =>
        JSON.stringify({
          error: { type: 'not_found', message: 'Letter not found' },
        }),
    } as Response);

    await expect(getPostGridLetter('letter_missing', secrets)).rejects.toThrow(
      'PostGrid API error (404): not_found — Letter not found'
    );
  });

  it('throws on non-OK response without JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
      headers: new Headers(),
      text: async () => '',
    } as Response);

    await expect(getPostGridLetter('letter_err', secrets)).rejects.toThrow(
      'PostGrid API error (500): unknown — Internal Server Error'
    );
  });

  it('throws when response body cannot be parsed as JSON', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => '',
    } as Response);

    await expect(getPostGridLetter('letter_empty', secrets)).rejects.toThrow(
      'PostGrid response could not be parsed as JSON'
    );
  });

  it('throws when fetch itself fails (network error)', async () => {
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(getPostGridLetter('letter_net', secrets)).rejects.toThrow('fetch failed');
  });
});
