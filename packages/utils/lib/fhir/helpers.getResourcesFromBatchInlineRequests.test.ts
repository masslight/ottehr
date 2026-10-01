import Oystehr from '@oystehr/sdk';
import { Bundle, BundleEntry, FhirResource } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getResourcesFromBatchInlineRequests } from './helpers';

const mockOystehr = {
  fhir: {
    batch: vi.fn(),
  },
};

const patient = (id: string): FhirResource => ({ resourceType: 'Patient', id });
const practitioner = (id: string): FhirResource => ({ resourceType: 'Practitioner', id });

const searchset = (matches: FhirResource[], hasNext: boolean, includes: FhirResource[] = []): BundleEntry => ({
  response: { status: '200 OK', outcome: { resourceType: 'OperationOutcome', id: 'ok', issue: [] } },
  resource: {
    resourceType: 'Bundle',
    type: 'searchset',
    entry: [
      ...matches.map((resource) => ({ resource, search: { mode: 'match' as const } })),
      ...includes.map((resource) => ({ resource, search: { mode: 'include' as const } })),
    ],
    link: hasNext ? [{ relation: 'next', url: 'https://fhir.example.com/r4/Patient?encoded%3Dvalue' }] : [],
  },
});

const batchResponse = (...entry: BundleEntry[]): Bundle => ({ resourceType: 'Bundle', type: 'batch-response', entry });

const requestedUrls = (call: number): string[] =>
  mockOystehr.fhir.batch.mock.calls[call][0].requests.map((request: { url: string }) => request.url);

describe('getResourcesFromBatchInlineRequests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the resources of a single page without another request', async () => {
    mockOystehr.fhir.batch.mockResolvedValueOnce(batchResponse(searchset([patient('1'), patient('2')], false)));

    const result = await getResourcesFromBatchInlineRequests(mockOystehr as unknown as Oystehr, ['/Patient?name=a']);

    expect(result).toEqual([patient('1'), patient('2')]);
    expect(mockOystehr.fhir.batch).toHaveBeenCalledTimes(1);
  });

  it('follows next links until every page is fetched', async () => {
    mockOystehr.fhir.batch
      .mockResolvedValueOnce(
        batchResponse(
          searchset([patient('1'), patient('2')], true, [practitioner('a')]),
          searchset([practitioner('x')], false)
        )
      )
      .mockResolvedValueOnce(batchResponse(searchset([patient('3'), patient('4')], true)))
      .mockResolvedValueOnce(batchResponse(searchset([patient('5')], false)));

    const result = await getResourcesFromBatchInlineRequests(mockOystehr as unknown as Oystehr, [
      '/Patient?name=a&_include=Patient:general-practitioner',
      '/Practitioner?_id=x',
    ]);

    expect(result).toEqual([
      patient('1'),
      patient('2'),
      practitioner('a'),
      practitioner('x'),
      patient('3'),
      patient('4'),
      patient('5'),
    ]);
    expect(mockOystehr.fhir.batch).toHaveBeenCalledTimes(3);
    // Included resources don't count toward the page, and the page size is pinned once inferred.
    expect(requestedUrls(1)).toEqual(['/Patient?name=a&_include=Patient:general-practitioner&_offset=2&_count=2']);
    expect(requestedUrls(2)).toEqual(['/Patient?name=a&_include=Patient:general-practitioner&_offset=4&_count=2']);
  });

  it('advances an existing _offset and keeps an explicit _count', async () => {
    mockOystehr.fhir.batch
      .mockResolvedValueOnce(batchResponse(searchset([patient('1'), patient('2')], true)))
      .mockResolvedValueOnce(batchResponse(searchset([patient('3')], false)));

    await getResourcesFromBatchInlineRequests(mockOystehr as unknown as Oystehr, ['/Patient?_count=2&_offset=10']);

    expect(requestedUrls(1)).toEqual(['/Patient?_count=2&_offset=12']);
  });

  it('stops on a next link with no matches instead of looping', async () => {
    mockOystehr.fhir.batch.mockResolvedValueOnce(batchResponse(searchset([], true)));

    const result = await getResourcesFromBatchInlineRequests(mockOystehr as unknown as Oystehr, ['/Patient?name=a']);

    expect(result).toEqual([]);
    expect(mockOystehr.fhir.batch).toHaveBeenCalledTimes(1);
  });
});
