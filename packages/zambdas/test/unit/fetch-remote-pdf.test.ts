import { describe, expect, it } from 'vitest';
import { fetchRemotePdf, isDeploymentHost, RemotePdfError } from '../../src/shared/fetch-remote-pdf';

/** Stands in for a deployment's own addresses, which the guard refuses to fetch from. */
const SECRETS = {
  PROJECT_API: 'https://project-api.zapehr.com/v1',
  FHIR_API: 'https://fhir-api.zapehr.com/r4',
  AUTH0_ENDPOINT: 'https://auth.zapehr.com',
  WEBSITE_URL: 'https://ehr.example.org',
};

/**
 * Only the cases the guard settles before any network call: a rejected address never reaches `fetch`, so
 * these run offline. Everything past the guard — redirects, size, PDF header — needs a real response and
 * belongs to an integration test.
 */
const rejectionFor = async (url: string): Promise<RemotePdfError> => {
  try {
    await fetchRemotePdf(url, SECRETS);
  } catch (error) {
    if (error instanceof RemotePdfError) return error;
    throw error;
  }
  throw new Error(`Expected ${url} to be rejected`);
};

describe('fetchRemotePdf address guard', () => {
  it('requires https, so the document cannot be swapped in transit', async () => {
    expect((await rejectionFor('http://example.com/form.pdf')).reason).toBe('invalidUrl');
  });

  it('rejects schemes that are not web addresses at all', async () => {
    expect((await rejectionFor('file:///etc/passwd')).reason).toBe('invalidUrl');
    expect((await rejectionFor('not a url')).reason).toBe('invalidUrl');
  });

  it('rejects the cloud metadata address', async () => {
    // The reason this guard exists: a server can reach it and a browser cannot.
    expect((await rejectionFor('https://169.254.169.254/latest/meta-data/')).reason).toBe('blockedAddress');
  });

  it('rejects loopback and private ranges given as literals', async () => {
    for (const host of ['127.0.0.1', '10.0.0.5', '172.16.4.2', '192.168.1.1', '100.64.0.1', '0.0.0.0']) {
      expect((await rejectionFor(`https://${host}/form.pdf`)).reason).toBe('blockedAddress');
    }
  });

  it('rejects IPv6 loopback, unique-local and link-local', async () => {
    for (const host of ['[::1]', '[fc00::1]', '[fd12:3456::1]', '[fe80::1]']) {
      expect((await rejectionFor(`https://${host}/form.pdf`)).reason).toBe('blockedAddress');
    }
  });

  it('rejects every link-local address, not just the fe80 prefix', async () => {
    // fe80::/10 spans fe80 through febf. A guard matching only `fe80` leaves the rest of the range open.
    for (const host of ['[fe80::1]', '[fe90::1]', '[fea0::1]', '[febf::1]', '[fe80:0:0:0:0:0:0:1]']) {
      expect((await rejectionFor(`https://${host}/form.pdf`)).reason, host).toBe('blockedAddress');
    }
  });

  it('does not treat a merely similar-looking first group as link-local', async () => {
    // `fe8` is a three-character group — 0x0fe8 — and nothing to do with fe80::/10. It has to reach the
    // DNS path rather than being refused, so the check cannot simply be a substring test.
    expect((await rejectionFor('http://[fe8::1]/form.pdf')).reason).toBe('invalidUrl');
  });

  it('rejects the unspecified address, however it is spelled', async () => {
    // `::` is not loopback, but connecting to it reaches whatever is listening on this host, so it is
    // loopback in effect. Every spelling of all-zeros has to go.
    for (const host of ['[::]', '[::0]', '[0:0:0:0:0:0:0:0]']) {
      expect((await rejectionFor(`https://${host}/form.pdf`)).reason, host).toBe('blockedAddress');
    }
  });

  it('rejects a private address smuggled through an IPv4-mapped IPv6 literal', async () => {
    expect((await rejectionFor('https://[::ffff:169.254.169.254]/')).reason).toBe('blockedAddress');
    expect((await rejectionFor('https://[::ffff:127.0.0.1]/')).reason).toBe('blockedAddress');
  });

  it("rejects this deployment's own API, storage and site", async () => {
    // Public DNS on public addresses, so nothing in the range checks would stop these.
    for (const url of [
      'https://project-api.zapehr.com/z3/some-bucket/file.pdf',
      'https://fhir-api.zapehr.com/r4/Patient',
      'https://auth.zapehr.com/.well-known/jwks.json',
      'https://ehr.example.org/form.pdf',
    ]) {
      expect((await rejectionFor(url)).reason).toBe('blockedAddress');
    }
  });

  it('rejects subdomains of its own hosts, not just the exact names', async () => {
    expect((await rejectionFor('https://internal.project-api.zapehr.com/x.pdf')).reason).toBe('blockedAddress');
  });

  it('carries a message an administrator can act on', async () => {
    expect((await rejectionFor('http://example.com/form.pdf')).message).toMatch(/https/i);
  });
});

/** Tested directly: reaching this through `fetchRemotePdf` with an allowed host would need the network. */
describe('isDeploymentHost', () => {
  const own = new Set(['fhir-api.zapehr.com']);

  it('matches the host itself and its subdomains', () => {
    expect(isDeploymentHost('fhir-api.zapehr.com', own)).toBe(true);
    expect(isDeploymentHost('internal.fhir-api.zapehr.com', own)).toBe(true);
  });

  it('matches on the label boundary, not on the string ending', () => {
    // A plain `endsWith` would refuse this, and it is a different domain entirely.
    expect(isDeploymentHost('notfhir-api.zapehr.com', own)).toBe(false);
    expect(isDeploymentHost('zapehr.com', own)).toBe(false);
  });
});
