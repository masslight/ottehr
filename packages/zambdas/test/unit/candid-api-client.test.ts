import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGetToken = vi.fn();

vi.mock('candidhealth', () => {
  const CandidApiClient = vi.fn().mockImplementation(() => ({
    auth: { default: { getToken: mockGetToken } },
    // Helper monkey-patches this getToken. Default 'SDK-default-token' lets us prove the patch
    // ran (if a test ever sees that value, the patch didn't take effect).
    _oauthTokenProvider: { getToken: vi.fn().mockResolvedValue('SDK-default-token') },
  }));
  const CandidApiEnvironment = { Production: 'PROD', Staging: 'STAGING' };
  return { CandidApiClient, CandidApiEnvironment };
});

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    getOptionalSecret: vi.fn().mockReturnValue('configured'),
    getSecret: vi.fn().mockReturnValue('test-value'),
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeMockOystehr(): { secret: { get: ReturnType<typeof vi.fn>; set: ReturnType<typeof vi.fn> } } {
  return {
    secret: {
      get: vi.fn(),
      set: vi.fn().mockResolvedValue({}),
    },
  };
}

// Each test imports the helper fresh so the module-scope `cachedCandidApiClient`,
// `inflightRefresh` state doesn't leak between cases.
async function freshHelper(): Promise<typeof import('../../src/shared/candidApiClient')> {
  vi.resetModules();
  return import('../../src/shared/candidApiClient');
}

function futureExpiry(): string {
  return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
}

function nearExpiry(): string {
  return new Date(Date.now() + 60 * 1000).toISOString();
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('getOrCreateCandidApiClient — cache layers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches from Candid and persists the token to the Oystehr secret on first call', async () => {
    const { getOrCreateCandidApiClient } = await freshHelper();
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockRejectedValue(new Error('secret does not exist yet'));
    mockGetToken.mockResolvedValue({
      ok: true,
      body: { accessToken: 'fresh-token', expiresIn: 18000 },
    });

    const client = await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const token = await (client as any)._oauthTokenProvider.getToken();

    expect(token).toBe('fresh-token');
    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(oystehr.secret.set).toHaveBeenCalledTimes(1);

    const persisted = JSON.parse(oystehr.secret.set.mock.calls[0][0].value);
    expect(persisted.accessToken).toBe('fresh-token');
    expect(new Date(persisted.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('reuses the token from the Oystehr secret when it is still fresh', async () => {
    const { getOrCreateCandidApiClient } = await freshHelper();
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue({
      name: 'CANDID_OAUTH_TOKEN_CACHE',
      value: JSON.stringify({ accessToken: 'stored-token', expiresAt: futureExpiry() }),
    });

    const client = await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const token = await (client as any)._oauthTokenProvider.getToken();

    expect(token).toBe('stored-token');
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(oystehr.secret.set).not.toHaveBeenCalled();
  });

  it('refreshes from Candid when the stored token is within the 5-minute buffer', async () => {
    const { getOrCreateCandidApiClient } = await freshHelper();
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue({
      name: 'CANDID_OAUTH_TOKEN_CACHE',
      value: JSON.stringify({ accessToken: 'stale-token', expiresAt: nearExpiry() }),
    });
    mockGetToken.mockResolvedValue({
      ok: true,
      body: { accessToken: 'fresh-token', expiresIn: 18000 },
    });

    const client = await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const token = await (client as any)._oauthTokenProvider.getToken();

    expect(token).toBe('fresh-token');
    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(oystehr.secret.set).toHaveBeenCalledTimes(1);
  });
});

describe('getOrCreateCandidApiClient — monkey-patch and client cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces _oauthTokenProvider.getToken so the SDK's default never runs", async () => {
    const { getOrCreateCandidApiClient } = await freshHelper();
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue({
      name: 'CANDID_OAUTH_TOKEN_CACHE',
      value: JSON.stringify({ accessToken: 'patched-via-cache', expiresAt: futureExpiry() }),
    });

    const client = await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const token = await (client as any)._oauthTokenProvider.getToken();

    // If the patch hadn't applied, this would be 'SDK-default-token'.
    expect(token).toBe('patched-via-cache');
  });

  it('returns the same cached client instance on repeated calls', async () => {
    const { getOrCreateCandidApiClient } = await freshHelper();
    const oystehr = makeMockOystehr();

    const client1 = await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const client2 = await getOrCreateCandidApiClient(oystehr as any, {} as any);

    expect(client1).toBe(client2);
  });

  it('throws a clear error if the Candid SDK no longer exposes _oauthTokenProvider.getToken', async () => {
    // Simulate a future candidhealth SDK that has dropped/renamed the private field we patch.
    const candidhealth = await import('candidhealth');
    const prevImpl = vi.mocked(candidhealth.CandidApiClient).getMockImplementation();
    vi.mocked(candidhealth.CandidApiClient).mockImplementationOnce(
      () =>
        ({
          auth: { default: { getToken: mockGetToken } },
          // _oauthTokenProvider intentionally absent
        }) as any
    );

    const { getOrCreateCandidApiClient } = await freshHelper();
    const oystehr = makeMockOystehr();

    await expect(getOrCreateCandidApiClient(oystehr as any, {} as any)).rejects.toThrow(
      /candidhealth SDK shape changed/
    );

    if (prevImpl) vi.mocked(candidhealth.CandidApiClient).mockImplementation(prevImpl);
  });

  it('serves repeated getToken calls from the in-memory cache without re-reading the Oystehr secret', async () => {
    const { getOrCreateCandidApiClient } = await freshHelper();
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue({
      name: 'CANDID_OAUTH_TOKEN_CACHE',
      value: JSON.stringify({ accessToken: 'stored-token', expiresAt: futureExpiry() }),
    });

    const client = await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const t1 = await (client as any)._oauthTokenProvider.getToken();
    const t2 = await (client as any)._oauthTokenProvider.getToken();
    const t3 = await (client as any)._oauthTokenProvider.getToken();

    expect(t1).toBe('stored-token');
    expect(t2).toBe('stored-token');
    expect(t3).toBe('stored-token');
    // First call populates cachedToken from the Oystehr secret; subsequent calls must hit memory only.
    expect(oystehr.secret.get).toHaveBeenCalledTimes(1);
    expect(mockGetToken).not.toHaveBeenCalled();
  });
});

describe('getOrCreateCandidApiClient — concurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('collapses concurrent token refreshes to a single upstream Candid auth call', async () => {
    const { getOrCreateCandidApiClient } = await freshHelper();
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue(undefined);
    mockGetToken.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, body: { accessToken: 'fresh-token', expiresIn: 18000 } }), 10)
        )
    );

    const client = await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const [a, b, c] = await Promise.all([
      (client as any)._oauthTokenProvider.getToken(),
      (client as any)._oauthTokenProvider.getToken(),
      (client as any)._oauthTokenProvider.getToken(),
    ]);

    expect(a).toBe('fresh-token');
    expect(b).toBe('fresh-token');
    expect(c).toBe('fresh-token');
    // In-flight lock collapses three concurrent refreshes into one auth call.
    expect(mockGetToken).toHaveBeenCalledTimes(1);
  });
});

describe('getOrCreateCandidApiClient — error tolerance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls through to Candid when the Oystehr secret read fails', async () => {
    const { getOrCreateCandidApiClient } = await freshHelper();
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockRejectedValue(new Error('transient failure'));
    mockGetToken.mockResolvedValue({
      ok: true,
      body: { accessToken: 'fresh-token', expiresIn: 18000 },
    });

    const client = await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const token = await (client as any)._oauthTokenProvider.getToken();

    expect(token).toBe('fresh-token');
  });

  it('returns the token to the caller even if persisting to the Oystehr secret fails', async () => {
    const { getOrCreateCandidApiClient } = await freshHelper();
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue(undefined);
    oystehr.secret.set.mockRejectedValue(new Error('write failed'));
    mockGetToken.mockResolvedValue({
      ok: true,
      body: { accessToken: 'fresh-token', expiresIn: 18000 },
    });

    const client = await getOrCreateCandidApiClient(oystehr as any, {} as any);
    await expect((client as any)._oauthTokenProvider.getToken()).resolves.toBe('fresh-token');
  });

  it('throws when Candid auth itself fails', async () => {
    const { getOrCreateCandidApiClient } = await freshHelper();
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue(undefined);
    mockGetToken.mockResolvedValue({ ok: false, error: { message: 'rate limited' } });

    const client = await getOrCreateCandidApiClient(oystehr as any, {} as any);
    await expect((client as any)._oauthTokenProvider.getToken()).rejects.toThrow(/Failed to fetch Candid OAuth token/);
  });
});

describe('getOrCreateCandidApiClientIfConfigured', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when any CANDID_* secret is missing', async () => {
    const utils = await import('utils');
    vi.mocked(utils.getOptionalSecret).mockReturnValueOnce(undefined);

    const { getOrCreateCandidApiClientIfConfigured } = await freshHelper();
    const oystehr = makeMockOystehr();
    const client = await getOrCreateCandidApiClientIfConfigured(oystehr as any, {} as any);

    expect(client).toBeNull();
  });

  it('builds the client when all CANDID_* secrets are configured', async () => {
    const { getOrCreateCandidApiClientIfConfigured } = await freshHelper();
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue({
      name: 'CANDID_OAUTH_TOKEN_CACHE',
      value: JSON.stringify({ accessToken: 'stored-token', expiresAt: futureExpiry() }),
    });

    const client = await getOrCreateCandidApiClientIfConfigured(oystehr as any, {} as any);

    expect(client).not.toBeNull();
  });
});
