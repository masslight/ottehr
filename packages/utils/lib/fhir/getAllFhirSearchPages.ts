import Oystehr, { FhirResource, FhirSearchParams } from '@oystehr/sdk';
import { Resource } from 'fhir/r4b';
import { deduplicateUnbundledResources } from './deduplicateUnbundledResources';

export async function getAllFhirSearchPages<T extends FhirResource>(
  fhirSearchParams: FhirSearchParams<T>,
  oystehr: Oystehr,
  maxMatchPerBatch = 1000
): Promise<T[]> {
  let currentIndex = 0;
  let total = 1;
  const result: T[] = [];
  // Create a new array to avoid mutating the original params
  const params = [
    ...(fhirSearchParams.params ?? []),
    { name: '_count', value: `${maxMatchPerBatch}` },
    { name: '_total', value: 'accurate' },
  ];
  while (currentIndex < total) {
    const bundledResponse = await oystehr.fhir.search<T>({
      resourceType: fhirSearchParams.resourceType,
      params: [...params, { name: '_offset', value: `${currentIndex}` }],
    });

    const matchedCount = bundledResponse.entry?.filter((entry) => entry.search?.mode === 'match').length || 0;
    total = bundledResponse.total || 0;
    const unbundled = bundledResponse.unbundle();
    result.push(...unbundled);
    currentIndex += matchedCount;
  }

  // Deduplicate to ensure idempotency - same params should return same results regardless of batch size
  const deduplicated = deduplicateUnbundledResources(result as Resource[]);

  return deduplicated as T[];
}
