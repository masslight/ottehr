import { beforeEach, describe, expect, it, vi } from 'vitest';

type CandidApiHelper = typeof import('./candidApi');
let helper: CandidApiHelper;
let getOrCreateCandidApiClient: CandidApiHelper['getOrCreateCandidApiClient'];

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockGetToken = vi.fn();
let capturedTokenSupplier: (() => Promise<string>) | undefined;

vi.mock('candidhealth', () => {
  const CandidApiClient = vi.fn().mockImplementation((options: { token?: () => Promise<string> }) => {
    if (typeof options?.token === 'function') capturedTokenSupplier = options.token;
    return {
      auth: { default: { getToken: mockGetToken } },
    };
  });
  const CandidApiEnvironment = { Production: 'PROD', Staging: 'STAGING' };
  return { CandidApiClient, CandidApiEnvironment };
});

// candidApi.ts imports getOptionalSecret/getSecret from the 'utils' package entrypoint, so the
// mock target stays 'utils' even though this test now lives inside the utils package.
vi.mock('utils', () => {
  return {
    getOptionalSecret: vi.fn().mockReturnValue('configured'),
    getSecret: vi.fn().mockReturnValue('test-value'),
    MISSING_REQUEST_SECRETS: new Error('Missing request secrets'),
    SecretsKeys: {
      CANDID_CLIENT_ID: 'CANDID_CLIENT_ID',
      CANDID_CLIENT_SECRET: 'CANDID_CLIENT_SECRET',
      CANDID_ENV: 'CANDID_ENV',
    },
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

function futureExpiry(): string {
  return new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
}

function nearExpiry(): string {
  return new Date(Date.now() + 60 * 1000).toISOString();
}

beforeEach(async () => {
  vi.clearAllMocks();
  if (!helper) {
    helper = await import('./candidApi');
    getOrCreateCandidApiClient = helper.getOrCreateCandidApiClient;
  }
  helper.__resetCandidApiClientForTests();
  capturedTokenSupplier = undefined;
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('getOrCreateCandidApiClient — cache layers', () => {
  it('fetches from Candid and persists the token to the Oystehr secret on first call', async () => {
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockRejectedValue(new Error('secret does not exist yet'));
    mockGetToken.mockResolvedValue({
      ok: true,
      body: { accessToken: 'fresh-token', expiresIn: 18000 },
    });

    await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const token = await capturedTokenSupplier!();

    expect(token).toBe('fresh-token');
    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(oystehr.secret.set).toHaveBeenCalledTimes(1);

    const persisted = JSON.parse(oystehr.secret.set.mock.calls[0][0].value);
    expect(persisted.accessToken).toBe('fresh-token');
    expect(new Date(persisted.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('reuses the token from the Oystehr secret when it is still fresh', async () => {
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue({
      name: 'CANDID_OAUTH_TOKEN_CACHE',
      value: JSON.stringify({ accessToken: 'stored-token', expiresAt: futureExpiry() }),
    });

    await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const token = await capturedTokenSupplier!();

    expect(token).toBe('stored-token');
    expect(mockGetToken).not.toHaveBeenCalled();
    expect(oystehr.secret.set).not.toHaveBeenCalled();
  });

  it('refreshes from Candid when the stored token is within the 5-minute buffer', async () => {
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue({
      name: 'CANDID_OAUTH_TOKEN_CACHE',
      value: JSON.stringify({ accessToken: 'stale-token', expiresAt: nearExpiry() }),
    });
    mockGetToken.mockResolvedValue({
      ok: true,
      body: { accessToken: 'fresh-token', expiresIn: 18000 },
    });

    await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const token = await capturedTokenSupplier!();

    expect(token).toBe('fresh-token');
    expect(mockGetToken).toHaveBeenCalledTimes(1);
    expect(oystehr.secret.set).toHaveBeenCalledTimes(1);
  });
});

describe('getOrCreateCandidApiClient — client cache', () => {
  it('returns the same cached client instance on repeated calls', async () => {
    const oystehr = makeMockOystehr();

    const client1 = await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const client2 = await getOrCreateCandidApiClient(oystehr as any, {} as any);

    expect(client1).toBe(client2);
  });

  it('uses the latest oystehr/secrets on warm invocations rather than the ones from the cold start', async () => {
    const oystehr1 = makeMockOystehr();
    oystehr1.secret.get.mockRejectedValue(new Error('expired M2M token'));
    oystehr1.secret.set.mockRejectedValue(new Error('expired M2M token'));

    const oystehr2 = makeMockOystehr();
    oystehr2.secret.get.mockResolvedValue({
      name: 'CANDID_OAUTH_TOKEN_CACHE',
      value: JSON.stringify({ accessToken: 'token-from-oystehr2', expiresAt: futureExpiry() }),
    });

    // cold start binds oystehr1 and warm invocation passes oystehr2
    await getOrCreateCandidApiClient(oystehr1 as any, {} as any);
    await getOrCreateCandidApiClient(oystehr2 as any, {} as any);
    const token = await capturedTokenSupplier!();

    expect(token).toBe('token-from-oystehr2');
    expect(oystehr2.secret.get).toHaveBeenCalled();
    expect(oystehr1.secret.get).not.toHaveBeenCalled();
  });

  it('serves repeated getToken calls from the in-memory cache without re-reading the Oystehr secret', async () => {
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue({
      name: 'CANDID_OAUTH_TOKEN_CACHE',
      value: JSON.stringify({ accessToken: 'stored-token', expiresAt: futureExpiry() }),
    });

    await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const t1 = await capturedTokenSupplier!();
    const t2 = await capturedTokenSupplier!();
    const t3 = await capturedTokenSupplier!();

    expect(t1).toBe('stored-token');
    expect(t2).toBe('stored-token');
    expect(t3).toBe('stored-token');
    // First call populates cachedToken from the Oystehr secret; subsequent calls must hit memory only.
    expect(oystehr.secret.get).toHaveBeenCalledTimes(1);
    expect(mockGetToken).not.toHaveBeenCalled();
  });
});

describe('getOrCreateCandidApiClient — concurrency', () => {
  it('collapses concurrent token refreshes to a single upstream Candid auth call', async () => {
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue(undefined);
    mockGetToken.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, body: { accessToken: 'fresh-token', expiresIn: 18000 } }), 10)
        )
    );

    await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const [a, b, c] = await Promise.all([capturedTokenSupplier!(), capturedTokenSupplier!(), capturedTokenSupplier!()]);

    expect(a).toBe('fresh-token');
    expect(b).toBe('fresh-token');
    expect(c).toBe('fresh-token');
    // In-flight lock collapses three concurrent refreshes into one auth call.
    expect(mockGetToken).toHaveBeenCalledTimes(1);
  });
});

describe('getOrCreateCandidApiClient — error tolerance', () => {
  it('falls through to Candid when the Oystehr secret read fails', async () => {
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockRejectedValue(new Error('transient failure'));
    mockGetToken.mockResolvedValue({
      ok: true,
      body: { accessToken: 'fresh-token', expiresIn: 18000 },
    });

    await getOrCreateCandidApiClient(oystehr as any, {} as any);
    const token = await capturedTokenSupplier!();

    expect(token).toBe('fresh-token');
  });

  it('returns the token to the caller even if persisting to the Oystehr secret fails', async () => {
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue(undefined);
    oystehr.secret.set.mockRejectedValue(new Error('write failed'));
    mockGetToken.mockResolvedValue({
      ok: true,
      body: { accessToken: 'fresh-token', expiresIn: 18000 },
    });

    await getOrCreateCandidApiClient(oystehr as any, {} as any);
    await expect(capturedTokenSupplier!()).resolves.toBe('fresh-token');
  });

  it('throws when Candid auth itself fails', async () => {
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue(undefined);
    mockGetToken.mockResolvedValue({ ok: false, error: { message: 'rate limited' } });

    await getOrCreateCandidApiClient(oystehr as any, {} as any);
    await expect(capturedTokenSupplier!()).rejects.toThrow(/Failed to fetch Candid OAuth token/);
  });
});

describe('getOrCreateCandidApiClient', () => {
  it('throws when any CANDID_* secret is missing', async () => {
    const utils = await import('utils');
    vi.mocked(utils.getOptionalSecret).mockReturnValueOnce(undefined);

    const oystehr = makeMockOystehr();
    await expect(getOrCreateCandidApiClient(oystehr as any, {} as any)).rejects.toBe(utils.MISSING_REQUEST_SECRETS);
  });

  it('builds the client when all CANDID_* secrets are configured', async () => {
    const oystehr = makeMockOystehr();
    oystehr.secret.get.mockResolvedValue({
      name: 'CANDID_OAUTH_TOKEN_CACHE',
      value: JSON.stringify({ accessToken: 'stored-token', expiresAt: futureExpiry() }),
    });

    await expect(getOrCreateCandidApiClient(oystehr as any, {} as any)).resolves.toBeDefined();
  });
});
