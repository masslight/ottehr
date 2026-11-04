import Oystehr, { BatchInputGetRequest, SearchParam } from '@oystehr/sdk';
import { captureException, captureMessage } from '@sentry/node-core/light';
import { Bundle, FhirResource } from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';
import { isResponseSizeExceededError } from 'utils/lib/fhir/responseSize';
import { toRelativeFhirUrl } from 'utils/lib/fhir/uri';

/**
 * Oystehr runs a batch Bundle's same-method entries concurrently, up to 20 at a time. Entries beyond that
 * queue behind the limit, so a larger set is spread across parallel batches instead of one long one.
 */
export const MAX_ENTRIES_PER_BATCH = 20;

/** How many rounds of `next` links a batch search follows before giving up (each round is one more hop). */
export const MAX_NEXT_PAGE_ROUNDS = 3;

/** Builds the relative search URL for one batch entry. */
export const buildSearchUrl = (resourceType: string, params: SearchParam[]): string =>
  `${resourceType}?${params.map((param) => `${param.name}=${param.value}`).join('&')}`;

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
    return serverNextLink ? toRelativeFhirUrl(serverNextLink, fhirApiUrl) : undefined;
  }
  const offsetMatch = /[?&]_offset=(\d+)(?=&|$)/.exec(requestUrl);
  const nextOffset = (offsetMatch ? Number(offsetMatch[1]) : 0) + count;
  if (offsetMatch) {
    return requestUrl.replace(/([?&])_offset=\d+(?=&|$)/, `$1_offset=${nextOffset}`);
  }
  return `${requestUrl}${requestUrl.includes('?') ? '&' : '?'}_offset=${nextOffset}`;
};

/** One GET entry of a batch. `split`, when present, returns narrower searches that together match the same resources. */
export interface BatchSearch {
  url: string;
  split?: () => BatchSearch[];
}

export interface BatchSearchResult {
  resources: FhirResource[];
  /** Entry URLs whose resources are absent from `resources`: non-2xx, unsplittable, or still in flight at the deadline. */
  failedUrls: string[];
}

const isSuccessStatus = (status: string | undefined): boolean => !status || status.startsWith('2');

/** Resolves with `work`, or with `onDeadline()` once the deadline passes; `work` itself is not cancelled. */
export const settleByDeadline = <T>(
  work: Promise<T>,
  deadline: number | undefined,
  onDeadline: () => T
): Promise<T> => {
  if (deadline === undefined) return work;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onDeadline()), Math.max(0, deadline - Date.now()));
  });
  return Promise.race([work, expired]).finally(() => clearTimeout(timer));
};

const splitOversizedBatch = (batch: BatchSearch[]): BatchSearch[][] | undefined => {
  if (batch.length > 1) return batch.map((search) => [search]);
  const narrower = batch[0]?.split?.() ?? [];
  return narrower.length > 1 ? narrower.map((search) => [search]) : undefined;
};

const resourceTypesOf = (batch: BatchSearch[]): string[] => batch.map((search) => search.url.split('?')[0]);

/**
 * Runs GET searches as batch Bundles (at most `maxEntriesPerBatch` entries each, batches in parallel), unwraps
 * every nested searchset into one resource list, and follows `next` links with follow-up batches (see
 * `nextPageUrl` for how a follow-up entry is formed). A failing entry or batch is recorded in `failedUrls` instead
 * of failing the whole request: one broken order type must not blank the board.
 */
export const executeBatchSearches = async (
  oystehr: Oystehr,
  searches: BatchSearch[],
  options: { fhirApiUrl?: string; maxEntriesPerBatch?: number; deadline?: number } = {}
): Promise<BatchSearchResult> => {
  const { fhirApiUrl, deadline } = options;
  const maxEntries = options.maxEntriesPerBatch ?? MAX_ENTRIES_PER_BATCH;
  const resources: FhirResource[] = [];
  const failedUrls: string[] = [];
  const inFlight = new Set<BatchSearch[]>();
  const urlsOf = (batch: BatchSearch[]): string[] => batch.map((search) => search.url);

  const runBatch = async (batch: BatchSearch[], round: number): Promise<void> => {
    if (deadline !== undefined && Date.now() >= deadline) {
      failedUrls.push(...urlsOf(batch));
      return;
    }
    inFlight.add(batch);
    const startedAt = Date.now();
    const outcome = await oystehr.fhir
      .batch<FhirResource>({
        requests: batch.map((search): BatchInputGetRequest => ({ method: 'GET', url: search.url })),
      })
      .then(
        (bundle) => ({ bundle }),
        (error: unknown) => ({ error })
      );
    inFlight.delete(batch);

    if ('error' in outcome) {
      const smaller = isResponseSizeExceededError(outcome.error) ? splitOversizedBatch(batch) : undefined;
      if (!smaller) {
        failedUrls.push(...urlsOf(batch));
        console.error(`batch search failed after ${Date.now() - startedAt} ms`, urlsOf(batch), outcome.error);
        captureException(outcome.error);
        return;
      }
      console.warn(
        `batch search exceeded the response size cap after ${Date.now() - startedAt} ms; retrying it as ${
          smaller.length
        } smaller batches`,
        resourceTypesOf(batch)
      );
      // A search split by encounter starts again from its first page.
      const partRound = batch.length > 1 ? round : 0;
      await Promise.all(smaller.map((part) => runBatch(part, partRound)));
      return;
    }

    const nextPages: BatchSearch[] = [];
    (outcome.bundle.entry ?? []).forEach((entry, entryIndex) => {
      const requestUrl = batch[entryIndex]?.url ?? 'unknown';
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
        const followUp = nextPageUrl(requestUrl, next, fhirApiUrl);
        if (followUp) nextPages.push({ url: followUp, split: batch[entryIndex]?.split });
      }
    });

    if (nextPages.length === 0) return;
    if (round >= MAX_NEXT_PAGE_ROUNDS) {
      console.warn(`batch search stopped following next links after ${MAX_NEXT_PAGE_ROUNDS} rounds`, urlsOf(nextPages));
      return;
    }
    await runBatches(nextPages, round + 1);
  };

  const runBatches = async (pending: BatchSearch[], round: number): Promise<void> => {
    await Promise.all(chunkThings(pending, maxEntries).map((batch) => runBatch(batch, round)));
  };

  return settleByDeadline(
    runBatches(searches, 0).then(() => ({ resources, failedUrls })),
    deadline,
    () => {
      const outstanding = [...inFlight].flatMap(urlsOf);
      const message = `batch search reached its deadline with ${outstanding.length} entries in flight`;
      console.warn(message);
      captureMessage(message, 'warning');
      return { resources: [...resources], failedUrls: [...failedUrls, ...outstanding] };
    }
  );
};
