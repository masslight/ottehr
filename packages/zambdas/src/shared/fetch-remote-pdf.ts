import dns from 'node:dns/promises';
import net from 'node:net';

/** Beyond this a template is not a form, and holding it in a lambda's memory is its own problem. */
const MAX_BYTES = 25 * 1024 * 1024;
const TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 3;

export type RemotePdfFailure = 'invalidUrl' | 'blockedAddress' | 'unreachable' | 'notFound' | 'tooLarge' | 'notAPdf';

export class RemotePdfError extends Error {
  constructor(
    readonly reason: RemotePdfFailure,
    message: string
  ) {
    super(message);
  }
}

/**
 * Address ranges a form template is never legitimately served from, and that a server can reach when a
 * browser cannot: loopback, link-local (which is where cloud instance metadata lives), private networks,
 * and carrier-grade NAT space.
 */
const isBlockedAddress = (address: string): boolean => {
  const version = net.isIP(address);

  if (version === 4) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 0 || // "this network"
      a === 10 || // private
      a === 127 || // loopback
      (a === 169 && b === 254) || // link-local, including cloud metadata
      (a === 172 && b >= 16 && b <= 31) || // private
      (a === 192 && b === 168) || // private
      (a === 100 && b >= 64 && b <= 127) // carrier-grade NAT
    );
  }

  if (version === 6) {
    const normalized = address.toLowerCase();
    if (
      normalized === '::1' || // loopback
      normalized.startsWith('fc') || // unique local
      normalized.startsWith('fd') ||
      normalized.startsWith('fe80') // link-local
    ) {
      return true;
    }

    // An IPv4-mapped address reaches the same ranges through an IPv6 literal, and the URL parser rewrites
    // the readable spelling into hex — `::ffff:169.254.169.254` arrives as `::ffff:a9fe:a9fe`. Both forms
    // have to be unwrapped, or the check passes on an address that is about to connect to link-local.
    if (normalized.startsWith('::ffff:')) {
      return isBlockedAddress(toDottedQuad(normalized.slice('::ffff:'.length)));
    }
  }

  return false;
};

/** The trailing part of an IPv4-mapped IPv6 address, as dotted quad, whichever way it was spelled. */
const toDottedQuad = (mapped: string): string => {
  if (mapped.includes('.')) return mapped;

  const groups = mapped.split(':');
  if (groups.length !== 2) return mapped;

  const [high, low] = groups.map((group) => parseInt(group, 16));
  if (!Number.isFinite(high) || !Number.isFinite(low)) return mapped;

  return [high >> 8, high & 0xff, low >> 8, low & 0xff].join('.');
};

/**
 * Rejects a URL that this server should not be made to fetch.
 *
 * ⚠️ **This narrows the exposure; it does not remove it.** Accepting a URL and fetching it server-side
 * means an authenticated administrator can cause requests to originate from inside our network, which is a
 * position they do not otherwise hold. The host is resolved and checked here, but the connection is made
 * separately by `fetch`, so a name that resolves differently between the two — DNS rebinding — still gets
 * through. Closing that properly needs an egress allowlist or a proxy, which belongs to infrastructure
 * rather than to this function.
 */
const assertFetchable = async (raw: string): Promise<URL> => {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new RemotePdfError('invalidUrl', 'That does not look like a web address.');
  }

  // Plain HTTP would let anything on the path between us and the host swap the document.
  if (url.protocol !== 'https:') {
    throw new RemotePdfError('invalidUrl', 'The address must start with https://.');
  }

  // `hostname` keeps the brackets around an IPv6 literal, which `net.isIP` does not accept — without
  // stripping them every IPv6 address falls through to the DNS path and is never range-checked.
  const host = url.hostname.replace(/^\[|\]$/g, '');

  const literal = net.isIP(host) ? host : undefined;
  if (literal) {
    if (isBlockedAddress(literal)) {
      throw new RemotePdfError('blockedAddress', 'That address cannot be reached from here.');
    }
    return url;
  }

  let resolved;
  try {
    resolved = await dns.lookup(host, { all: true });
  } catch {
    throw new RemotePdfError('unreachable', `Could not find ${host}.`);
  }

  // Every answer, not just the first: a host resolving to one public and one private address would
  // otherwise pass on the public one and connect to whichever the resolver hands `fetch`.
  if (resolved.some((entry) => isBlockedAddress(entry.address))) {
    throw new RemotePdfError('blockedAddress', 'That address cannot be reached from here.');
  }

  return url;
};

/**
 * Downloads a PDF from a public URL, so a template can be imported by address instead of by file.
 *
 * Redirects are followed by hand rather than by `fetch`, because each hop is a new address that has to
 * clear the same checks — a permitted URL that redirects to an internal one is the obvious way around a
 * check applied only to what the user typed.
 */
export const fetchRemotePdf = async (rawUrl: string): Promise<{ bytes: Uint8Array; finalUrl: string }> => {
  let url = await assertFetchable(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: 'application/pdf,*/*' },
    }).catch(() => {
      throw new RemotePdfError('unreachable', `Could not reach ${url.hostname}.`);
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        throw new RemotePdfError('unreachable', 'The address redirected without saying where to.');
      }
      url = await assertFetchable(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      throw new RemotePdfError('notFound', `The address returned ${response.status} ${response.statusText}.`);
    }

    return { bytes: await readCapped(response), finalUrl: url.toString() };
  }

  throw new RemotePdfError('unreachable', 'The address redirected too many times.');
};

/**
 * Reads the body, refusing to buffer more than the cap.
 *
 * The declared `content-length` is checked first as a courtesy, then ignored: it is supplied by the same
 * server the bytes are, so the running total is what actually enforces the limit.
 */
const readCapped = async (response: Response): Promise<Uint8Array> => {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BYTES) {
    throw new RemotePdfError('tooLarge', 'That file is too large to import.');
  }

  const reader = response.body?.getReader();
  if (!reader) throw new RemotePdfError('unreachable', 'The address returned nothing.');

  const chunks: Uint8Array[] = [];
  let total = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new RemotePdfError('tooLarge', 'That file is too large to import.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  // Judged on the bytes rather than the declared content type, which is routinely wrong on the sites
  // these forms are published from. Deeper triage — encrypted, XFA, no fields — is the analyser's job.
  if (!startsWithPdfHeader(bytes)) {
    throw new RemotePdfError('notAPdf', 'That address did not return a PDF.');
  }

  return bytes;
};

const startsWithPdfHeader = (bytes: Uint8Array): boolean =>
  bytes.length >= 5 &&
  bytes[0] === 0x25 && // %
  bytes[1] === 0x50 && // P
  bytes[2] === 0x44 && // D
  bytes[3] === 0x46 && // F
  bytes[4] === 0x2d; // -
