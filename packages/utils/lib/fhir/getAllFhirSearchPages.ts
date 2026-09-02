import Oystehr, { Bundle, FhirResource, FhirSearchParams } from '@oystehr/sdk';
import { Resource } from 'fhir/r4b';
import { deduplicateUnbundledResources } from './deduplicateUnbundledResources';
import { isResponseSizeExceededError } from './responseSize';

export const MAX_RESPONSE_SIZE_RETRIES = 3;

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
  let pageSize = count;
  for (let attempt = 0; ; attempt += 1) {
    try {
      const bundle = await oystehr.fhir.search<T>({
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
      });
      return {
        bundle,
        count: pageSize,
      };
    } catch (error) {
      const nextPageSize = Math.floor(pageSize / 2);
      if (attempt >= MAX_RESPONSE_SIZE_RETRIES || nextPageSize < 1 || !isResponseSizeExceededError(error)) throw error;
      console.warn(
        `${fhirSearchParams.resourceType} page of ${pageSize} at offset ${offset} exceeded the response size limit; retrying with ${nextPageSize}`
      );
      pageSize = nextPageSize;
    }
  }
}

export async function getAllFhirSearchPages<T extends FhirResource>(
  fhirSearchParams: FhirSearchParams<T>,
  oystehr: Oystehr,
  maxMatchPerBatch = 1000
): Promise<T[]> {
  let currentIndex = 0;
  let total = 1;
  let pageSize = maxMatchPerBatch;
  const result: T[] = [];
  while (currentIndex < total) {
    const page = await searchPageWithSizeRetry<T>(oystehr, fhirSearchParams, {
      offset: currentIndex,
      count: pageSize,
    });
    // Keep any reduction the size retry had to make, so the pages that follow don't rediscover it.
    pageSize = page.count;

    const matchedCount = page.bundle.entry?.filter((entry) => entry.search?.mode === 'match').length || 0;
    total = page.bundle.total || 0;
    const unbundled = page.bundle.unbundle();
    result.push(...unbundled);
    currentIndex += matchedCount;
  }

  // Deduplicate to ensure idempotency - same params should return same results regardless of batch size
  const deduplicated = deduplicateUnbundledResources(result as Resource[]);

  return deduplicated as T[];
}
