import Oystehr, { BatchInputGetRequest, SearchParam } from '@oystehr/sdk';
import { Bundle, FhirResource } from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';

/**
 * Oystehr runs a batch Bundle's same-method entries concurrently, up to 20 at a time. Entries beyond that
 * queue behind the limit, so a larger set is spread across parallel batches instead of one long one.
 */
export const MAX_ENTRIES_PER_BATCH = 20;

/** How many rounds of `next` links a batch search follows before giving up (each round is one more hop). */
const MAX_NEXT_PAGE_ROUNDS = 3;

/**
 * Builds the relative search URL for one batch entry. Values are written raw rather than percent-encoded:
 * Oystehr's batch URL parser has been observed to reject encoded colons in date prefixes, and every value
 * here is a FHIR reference, token or constant that the code controls, never caller input.
 */
export const buildSearchUrl = (resourceType: string, params: SearchParam[]): string =>
  `${resourceType}?${params.map((param) => `${param.name}=${param.value}`).join('&')}`;

/**
 * Turns an absolute `next` link into the relative form a batch entry needs. Prefers stripping the known
 * FHIR base URL; otherwise drops any path prefix ahead of the resource type segment
 * (e.g. `https://host/r4/Observation?x` becomes `Observation?x`).
 */
export const toBatchRelativeUrl = (absoluteUrl: string, fhirApiUrl: string | undefined): string => {
  const base = fhirApiUrl?.replace(/\/+$/, '');
  if (base && absoluteUrl.startsWith(base)) {
    return absoluteUrl.slice(base.length).replace(/^\/+/, '');
  }
  try {
    const parsed = new URL(absoluteUrl);
    const path = parsed.pathname.replace(/^.*\/(?=[A-Z][A-Za-z]*$)/, '');
    return `${path}${parsed.search}`;
  } catch {
    return absoluteUrl;
  }
};

/**
 * The follow-up entry for a searchset that reported a `next` link. Every tracking board search sets `_count`, so the
 * next page is the same request with `_offset` advanced by one page. That keeps the entry's values raw (a server's
 * `next` link may percent-encode them, which the batch parser rejects) and independent of the link's shape. An entry
 * without `_count` falls back to the server's link, made relative.
 */
export const nextPageUrl = (
  requestUrl: string,
  serverNextLink: string | undefined,
  fhirApiUrl: string | undefined
): string | undefined => {
  const count = Number(/[?&]_count=(\d+)(?=&|$)/.exec(requestUrl)?.[1]);
  if (!Number.isInteger(count) || count <= 0) {
    return serverNextLink ? toBatchRelativeUrl(serverNextLink, fhirApiUrl) : undefined;
  }
  const offsetMatch = /[?&]_offset=(\d+)(?=&|$)/.exec(requestUrl);
  const nextOffset = (offsetMatch ? Number(offsetMatch[1]) : 0) + count;
  if (offsetMatch) {
    return requestUrl.replace(/([?&])_offset=\d+(?=&|$)/, `$1_offset=${nextOffset}`);
  }
  return `${requestUrl}${requestUrl.includes('?') ? '&' : '?'}_offset=${nextOffset}`;
};

export interface BatchSearchResult {
  resources: FhirResource[];
  /** Entry URLs that came back without a searchset (non-2xx); their resources are absent from `resources`. */
  failedUrls: string[];
}

const isSuccessStatus = (status: string | undefined): boolean => !status || status.startsWith('2');

/**
 * Runs GET searches as batch Bundles (at most `maxEntriesPerBatch` entries each, batches in parallel), unwraps
 * every nested searchset into one resource list, and follows `next` links with follow-up batches (see
 * `nextPageUrl` for how a follow-up entry is formed). A failing
 * entry is recorded in `failedUrls` instead of failing the whole request, which is what batch semantics give
 * us and what the tracking board wants: one broken order type must not blank the board.
 */
export const executeBatchSearches = async (
  oystehr: Oystehr,
  urls: string[],
  options: { fhirApiUrl?: string; maxEntriesPerBatch?: number } = {}
): Promise<BatchSearchResult> => {
  const maxEntries = options.maxEntriesPerBatch ?? MAX_ENTRIES_PER_BATCH;
  const resources: FhirResource[] = [];
  const failedUrls: string[] = [];

  let pending = [...urls];
  let round = 0;
  while (pending.length > 0 && round <= MAX_NEXT_PAGE_ROUNDS) {
    const batches = chunkThings(pending, maxEntries);
    const results = await Promise.all(
      batches.map((batchUrls) =>
        oystehr.fhir.batch<FhirResource>({
          requests: batchUrls.map((url): BatchInputGetRequest => ({ method: 'GET', url })),
        })
      )
    );

    const nextUrls: string[] = [];
    results.forEach((batchBundle, batchIndex) => {
      const batchUrls = batches[batchIndex];
      (batchBundle.entry ?? []).forEach((entry, entryIndex) => {
        const requestUrl = batchUrls[entryIndex] ?? 'unknown';
        const status = entry.response?.status;
        const searchset = entry.resource as Bundle<FhirResource> | undefined;
        if (!isSuccessStatus(status) || searchset?.resourceType !== 'Bundle') {
          failedUrls.push(requestUrl);
          console.error(`batch search entry failed (${status ?? 'no response'}): ${requestUrl}`);
          return;
        }
        searchset.entry?.forEach((searchEntry) => {
          if (searchEntry.resource) resources.push(searchEntry.resource);
        });
        const next = searchset.link?.find((link) => link.relation === 'next')?.url;
        if (next) {
          const followUp = nextPageUrl(requestUrl, next, options.fhirApiUrl);
          if (followUp) nextUrls.push(followUp);
        }
      });
    });

    pending = nextUrls;
    round += 1;
  }

  if (pending.length > 0) {
    console.warn(`batch search stopped following next links after ${MAX_NEXT_PAGE_ROUNDS} rounds`, pending);
  }

  return { resources, failedUrls };
};
