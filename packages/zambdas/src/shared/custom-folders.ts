import Oystehr from '@oystehr/sdk';
import { List } from 'fhir/r4b';
import { CUSTOM_FOLDER_KIND_SYSTEM, CUSTOM_FOLDERS_CATALOG_IDENTIFIER } from 'utils/lib/fhir/list';
import { CUSTOM_FOLDERS_CATALOG_BUSY_ERROR, FHIR_RESOURCE_NOT_FOUND_CUSTOM } from 'utils/lib/types/errors';
import { isFhirVersionConflictError } from './errors';

const CATALOG_CODE = 'custom-folders-catalog';
const CATALOG_IDENTIFIER_SYSTEM = 'https://fhir.ottehr.com/r4/identifier';
export const MAX_CATALOG_WRITE_ATTEMPTS = 6;
const CATALOG_RETRY_BASE_DELAY_MS = 100;

const waitBeforeCatalogRetry = (attempt: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, Math.random() * CATALOG_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)));

export async function loadCustomFoldersCatalog(oystehr: Oystehr, opts: { required: true }): Promise<List>;
export async function loadCustomFoldersCatalog(
  oystehr: Oystehr,
  opts?: { required?: boolean }
): Promise<List | undefined>;
export async function loadCustomFoldersCatalog(
  oystehr: Oystehr,
  opts: { required?: boolean } = {}
): Promise<List | undefined> {
  const results = await oystehr.fhir.search<List>({
    resourceType: 'List',
    params: [{ name: 'identifier', value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
  });
  const catalog = results.unbundle()[0] as List | undefined;
  if (!catalog && opts.required) {
    throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No custom folders catalog found`), statusCode: 404 };
  }
  return catalog;
}

interface WriteCustomFoldersCatalogArgs {
  oystehr: Oystehr;
  initialCatalog: List | undefined;
  mutate: (catalog: List) => List;
  tag: string;
  createIfMissing?: boolean;
  // For idempotent operations (e.g. delete): inspect the catalog after a 412 refetch
  // and return true to short-circuit as success without retrying the write.
  onConflictRefetched?: (refetched: List) => boolean;
}

const newCatalogSeed = (): List => ({
  resourceType: 'List',
  status: 'current',
  mode: 'working',
  code: { coding: [{ system: CUSTOM_FOLDER_KIND_SYSTEM, code: CATALOG_CODE }] },
  identifier: [{ system: CATALOG_IDENTIFIER_SYSTEM, value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
  entry: [],
});

export const writeCustomFoldersCatalog = async ({
  oystehr,
  initialCatalog,
  mutate,
  tag,
  createIfMissing,
  onConflictRefetched,
}: WriteCustomFoldersCatalogArgs): Promise<List> => {
  let attempt = 0;
  let currentCatalog = initialCatalog;

  while (attempt < MAX_CATALOG_WRITE_ATTEMPTS) {
    attempt++;
    try {
      if (!currentCatalog) {
        if (!createIfMissing) {
          throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No custom folders catalog found`), statusCode: 404 };
        }
        const created = await oystehr.fhir.create<List>(mutate(newCatalogSeed()));
        console.log(`${tag}: catalog List created (attempt ${attempt})`);
        return created;
      }

      const updated = await oystehr.fhir.update<List>(mutate(currentCatalog), {
        optimisticLockingVersionId: currentCatalog.meta?.versionId,
      });
      console.log(`${tag}: catalog updated on attempt ${attempt}`);
      return updated;
    } catch (err: any) {
      if (!isFhirVersionConflictError(err)) {
        console.error(
          `${tag}: catalog write failed on attempt ${attempt}:`,
          err?.statusCode ?? err?.code,
          err?.message ?? err
        );
        throw err;
      }
      if (attempt === MAX_CATALOG_WRITE_ATTEMPTS) break;
      console.warn(`${tag}: optimistic-lock conflict on attempt ${attempt} — refetching and retrying`);
      await waitBeforeCatalogRetry(attempt);
      currentCatalog = await loadCustomFoldersCatalog(oystehr);
      if (currentCatalog && onConflictRefetched?.(currentCatalog)) {
        console.log(`${tag}: refetch indicates work already done — treating as success`);
        return currentCatalog;
      }
    }
  }
  console.error(`${tag}: optimistic-lock conflict on all ${MAX_CATALOG_WRITE_ATTEMPTS} attempts`);
  throw CUSTOM_FOLDERS_CATALOG_BUSY_ERROR;
};
