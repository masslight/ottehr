import Oystehr from '@oystehr/sdk';
import { List } from 'fhir/r4b';
import {
  CUSTOM_FOLDER_KIND_SYSTEM,
  CUSTOM_FOLDERS_CATALOG_IDENTIFIER,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  NOT_AUTHORIZED,
  RoleType,
  Secrets,
} from 'utils';
import { getUser } from './auth';

const CATALOG_CODE = 'custom-folders-catalog';
const CATALOG_IDENTIFIER_SYSTEM = 'https://fhir.ottehr.com/r4/identifier';
const MAX_CATALOG_WRITE_RETRIES = 3;

export const requireAdminUser = async (userToken: string, secrets: Secrets | null): Promise<void> => {
  const user = await getUser(userToken, secrets);
  if (!user) throw NOT_AUTHORIZED;
  const roles = (user as any).roles as { name?: string }[] | undefined;
  const isAdmin = roles?.some((role) => role.name === RoleType.Administrator) ?? false;
  if (!isAdmin) throw NOT_AUTHORIZED;
};

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

  while (attempt < MAX_CATALOG_WRITE_RETRIES) {
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
      if (err?.statusCode === 412 && attempt < MAX_CATALOG_WRITE_RETRIES) {
        console.warn(`${tag}: optimistic-lock conflict on attempt ${attempt} — refetching and retrying`);
        currentCatalog = await loadCustomFoldersCatalog(oystehr);
        if (currentCatalog && onConflictRefetched?.(currentCatalog)) {
          console.log(`${tag}: refetch indicates work already done — treating as success`);
          return currentCatalog;
        }
      } else {
        console.error(`${tag}: catalog write failed on attempt ${attempt}:`, err?.statusCode, err?.message ?? err);
        throw err;
      }
    }
  }
  throw new Error(`${tag}: exhausted ${MAX_CATALOG_WRITE_RETRIES} retries without resolution`);
};
