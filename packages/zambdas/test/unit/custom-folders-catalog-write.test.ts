import Oystehr from '@oystehr/sdk';
import { List } from 'fhir/r4b';
import { APIErrorCode } from 'utils/lib/types/errors';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_CATALOG_WRITE_ATTEMPTS, writeCustomFoldersCatalog } from '../../src/shared/custom-folders';

const catalogAt = (versionId: string): List => ({
  resourceType: 'List',
  id: 'catalog',
  status: 'current',
  mode: 'working',
  meta: { versionId },
  entry: [],
});

// The SDK reports the HTTP status as `code`; the catalog writer once checked `statusCode`, so a
// version conflict was never retried and every concurrent write surfaced as a 500.
const versionConflict = (): Oystehr.OystehrFHIRError =>
  new Oystehr.OystehrFHIRError({
    code: 412,
    error: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'conflict' }] },
  });

const mockUpdate = vi.fn();
const mockSearch = vi.fn();
const oystehr = { fhir: { update: mockUpdate, search: mockSearch } } as unknown as Oystehr;

const writeAddingEntry = (): Promise<List> =>
  writeCustomFoldersCatalog({
    oystehr,
    initialCatalog: catalogAt('1'),
    mutate: (catalog) => ({ ...catalog, entry: [...(catalog.entry ?? []), { item: { display: 'New' } }] }),
    tag: 'test',
  });

describe('writeCustomFoldersCatalog', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockUpdate.mockReset();
    mockSearch.mockReset();
    mockSearch.mockImplementation(async () => ({ unbundle: () => [catalogAt('2')] }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries an SDK version conflict against the refetched catalog', async () => {
    mockUpdate.mockRejectedValueOnce(versionConflict()).mockImplementation(async (list: List) => list);

    const write = writeAddingEntry();
    await vi.runAllTimersAsync();

    await expect(write).resolves.toMatchObject({ meta: { versionId: '2' } });
    expect(mockUpdate).toHaveBeenCalledTimes(2);
    expect(mockUpdate.mock.calls[1][1]).toEqual({ optimisticLockingVersionId: '2' });
  });

  it('answers 409 with a retryable message instead of a 500 when every attempt conflicts', async () => {
    mockUpdate.mockRejectedValue(versionConflict());

    const write = writeAddingEntry();
    const outcome = expect(write).rejects.toMatchObject({
      code: APIErrorCode.CUSTOM_FOLDERS_CATALOG_BUSY,
      statusCode: 409,
    });
    await vi.runAllTimersAsync();

    await outcome;
    expect(mockUpdate).toHaveBeenCalledTimes(MAX_CATALOG_WRITE_ATTEMPTS);
  });

  // The create/rename rules live in `mutate` so a retry checks them against what the concurrent writer
  // saved, instead of re-applying a change that was only valid for the catalog it first read.
  it('re-runs mutate on the refetched catalog and stops when its rules reject that catalog', async () => {
    const takenByConcurrentWriter = { statusCode: 409, message: 'A folder named "X" already exists' };
    mockSearch.mockImplementation(async () => ({
      unbundle: () => [{ ...catalogAt('2'), entry: [{ item: { display: 'X', identifier: { value: 'custom-x' } } }] }],
    }));
    mockUpdate.mockRejectedValueOnce(versionConflict()).mockImplementation(async (list: List) => list);

    const write = writeCustomFoldersCatalog({
      oystehr,
      initialCatalog: catalogAt('1'),
      mutate: (catalog) => {
        if (catalog.entry?.some((entry) => entry.item?.display === 'X')) throw takenByConcurrentWriter;
        return { ...catalog, entry: [...(catalog.entry ?? []), { item: { display: 'X' } }] };
      },
      tag: 'test',
    });
    const outcome = expect(write).rejects.toBe(takenByConcurrentWriter);
    await vi.runAllTimersAsync();

    await outcome;
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });

  it('rethrows any other error on the first attempt', async () => {
    const serverError = new Oystehr.OystehrFHIRError({
      code: 500,
      error: { resourceType: 'OperationOutcome', issue: [{ severity: 'error', code: 'exception' }] },
    });
    mockUpdate.mockRejectedValue(serverError);

    await expect(writeAddingEntry()).rejects.toBe(serverError);
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSearch).not.toHaveBeenCalled();
  });
});
