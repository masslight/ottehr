import Oystehr, { Bundle, FhirResource, FhirSearchParams } from '@oystehr/sdk';
import { Resource } from 'fhir/r4b';
import { deduplicateUnbundledResources } from './deduplicateUnbundledResources';
import { isResponseSizeExceededError } from './responseSize';

export const MAX_RESPONSE_SIZE_RETRIES = 3;

export async function withResponseSizeRetry<T>({
  attempt,
  initialPageSize,
  label,
}: {
  attempt: (pageSize: number) => Promise<T>;
  initialPageSize: number;
  label: string;
}): Promise<{ result: T; pageSize: number }> {
  let pageSize = initialPageSize;
  for (let retries = 0; ; retries += 1) {
    try {
      return {
        result: await attempt(pageSize),
        pageSize,
      };
    } catch (error) {
      const nextPageSize = Math.floor(pageSize / 2);
      if (retries >= MAX_RESPONSE_SIZE_RETRIES || nextPageSize < 1 || !isResponseSizeExceededError(error)) throw error;
      console.warn(`${label}: page of ${pageSize} exceeded the response size limit; retrying with ${nextPageSize}`);
      pageSize = nextPageSize;
    }
  }
}

export async function searchPageWithSizeRetry<T extends FhirResource>(
  oystehr: Oystehr,
  fhirSearchParams: FhirSearchParams<T>,
  {
    offset,
    count,
  }: {
    offset: number;
    count: number;
  }
): Promise<{
  bundle: Bundle<T>;
  count: number;
}> {
  const { result, pageSize } = await withResponseSizeRetry({
    attempt: (pageSize) =>
      oystehr.fhir.search<T>({
        resourceType: fhirSearchParams.resourceType,
        params: [
          ...(fhirSearchParams.params ?? []),
          {
            name: '_count',
            value: `${pageSize}`,
          },
          {
            name: '_total',
            value: 'accurate',
          },
          {
            name: '_offset',
            value: `${offset}`,
          },
        ],
      }),
    initialPageSize: count,
    label: `${fhirSearchParams.resourceType} search at offset ${offset}`,
  });

  return {
    bundle: result,
    count: pageSize,
  };
}

export async function getAllFhirSearchPages<T extends FhirResource>(
  fhirSearchParams: FhirSearchParams<T>,
  oystehr: Oystehr,
  maxMatchPerBatch = 1000
): Promise<T[]> {
  let currentIndex = 0;
  let pageSize = maxMatchPerBatch;
  let serverTotal: number | undefined;
  const result: T[] = [];

  for (;;) {
    const page = await searchPageWithSizeRetry<T>(oystehr, fhirSearchParams, {
      offset: currentIndex,
      count: pageSize,
    });
    // Keep any reduction the size retry had to make, so the pages that follow don't rediscover it.
    pageSize = page.count;

    const matchedCount = page.bundle.entry?.filter((entry) => entry.search?.mode === 'match').length || 0;
    serverTotal = page.bundle.total ?? serverTotal;
    result.push(...page.bundle.unbundle());
    currentIndex += matchedCount;

    // A page of no matches advances nothing, so continuing would re-request this same offset until
    // the caller times out.
    if (matchedCount === 0) break;
    if (serverTotal === undefined) {
      // With no total to page against, a page the server couldn't fill is the only end signal there
      // is. Treating a missing total as zero instead would drop every page after the first.
      if (matchedCount < pageSize) break;
    } else if (currentIndex >= serverTotal) {
      break;
    }
  }

  // Deduplicate to ensure idempotency - same params should return same results regardless of batch size
  const deduplicated = deduplicateUnbundledResources(result as Resource[]);

  return deduplicated as T[];
}
