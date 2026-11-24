import { afterEach, describe, expect, it, vi } from 'vitest';
import { createClinicalOystehrClient } from './oystehr';

// The URL the client's ICD-10 search goes to.
const icd10SearchUrl = async (): Promise<string> => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ codes: [] }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  await createClinicalOystehrClient('token').terminology.searchIcd10({ query: 'otitis' });
  const [input] = fetch.mock.calls[0];
  return typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
};

describe('createClinicalOystehrClient: terminology', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('searches the terminology service the app is set up for', async () => {
    vi.stubEnv('VITE_APP_TERMINOLOGY_API_URL', 'https://staging-terminology-api.zapehr.com/v1');
    expect(new URL(await icd10SearchUrl()).host).toBe('staging-terminology-api.zapehr.com');
  });

  it('keeps the SDK default when the app sets none', async () => {
    vi.stubEnv('VITE_APP_TERMINOLOGY_API_URL', undefined);
    expect(new URL(await icd10SearchUrl()).host).toBe('terminology-api.zapehr.com');
  });
});
