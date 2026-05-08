import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  CUSTOM_FOLDERS_CATALOG_IDENTIFIER,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  FOLDERS_CONFIG,
  getSecret,
  INVALID_INPUT_ERROR,
  NOT_AUTHORIZED,
  parseCustomFoldersCatalog,
  RenameCustomFolderInputValidated,
  RenameCustomFolderOutput,
  RoleType,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, getUser, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('rename-custom-folder', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    if (!input.headers?.Authorization) {
      throw NOT_AUTHORIZED;
    }

    let validatedInput: RenameCustomFolderInputValidated;
    try {
      validatedInput = validateRequestParameters(input);
    } catch (error: any) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: `Invalid request parameters. ${error.message || error}`,
        }),
      };
    }

    const { internalName, newName, secrets, userToken } = validatedInput;

    const user = await getUser(userToken, secrets);
    if (!user) {
      throw NOT_AUTHORIZED;
    }
    const userRoles = (user as any).roles as { name?: string }[] | undefined;
    const isAdmin = userRoles?.some((role) => role.name === RoleType.Administrator) ?? false;
    if (!isAdmin) {
      throw NOT_AUTHORIZED;
    }

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const result = await performEffect(internalName, newName, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('rename-custom-folder', error, ENVIRONMENT);
  }
});

const performEffect = async (
  internalName: string,
  newName: string,
  oystehr: Oystehr
): Promise<RenameCustomFolderOutput> => {
  console.log(`rename-custom-folder: starting "${internalName}" → "${newName}"`);

  // Load catalog
  console.log('rename-custom-folder: loading catalog');
  const catalogResults = await oystehr.fhir.search<List>({
    resourceType: 'List',
    params: [{ name: 'identifier', value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
  });
  const catalog = catalogResults.unbundle()[0] as List | undefined;

  if (!catalog) {
    console.error('rename-custom-folder: no custom folders catalog found');
    throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No custom folders catalog found`);
  }
  console.log(`rename-custom-folder: catalog loaded (id=${catalog.id}, versionId=${catalog.meta?.versionId})`);

  const defs = parseCustomFoldersCatalog(catalog);
  const entryIndex = defs.findIndex((d) => d.internalName === internalName);

  if (entryIndex === -1) {
    console.error(`rename-custom-folder: entry for "${internalName}" not found in catalog`);
    throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Custom folder "${internalName}" not found`), statusCode: 404 };
  }
  console.log(`rename-custom-folder: catalog has entry for "${internalName}" at index ${entryIndex}`);

  // Uniqueness check: newName must not match any system folder display or another custom folder
  const systemDisplayNames = FOLDERS_CONFIG.map((f) => f.display.toLowerCase().trim());
  if (systemDisplayNames.includes(newName.toLowerCase().trim())) {
    throw { ...INVALID_INPUT_ERROR(`A folder named "${newName}" already exists`), statusCode: 409 };
  }

  const otherCustomNames = defs
    .filter((d) => d.internalName !== internalName)
    .map((d) => d.displayName.toLowerCase().trim());
  if (otherCustomNames.includes(newName.toLowerCase().trim())) {
    throw { ...INVALID_INPUT_ERROR(`A folder named "${newName}" already exists`), statusCode: 409 };
  }

  // Patch catalog with optimistic locking
  console.log('rename-custom-folder: updating catalog entry display');
  const MAX_RETRIES = 3;
  let attempt = 0;
  let currentCatalog: List = catalog;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      const updatedEntries = (currentCatalog.entry ?? []).map((entry) => {
        if (entry.item?.identifier?.value === internalName) {
          return {
            ...entry,
            item: {
              ...entry.item,
              display: newName,
            },
          };
        }
        return entry;
      });

      await oystehr.fhir.update<List>(
        { ...currentCatalog, entry: updatedEntries },
        { optimisticLockingVersionId: currentCatalog.meta?.versionId }
      );
      console.log(`rename-custom-folder: catalog updated on attempt ${attempt}`);
      break;
    } catch (err: any) {
      if (err?.statusCode === 412 && attempt < MAX_RETRIES) {
        console.warn(
          `rename-custom-folder: catalog optimistic-lock conflict on attempt ${attempt} — refetching and retrying`
        );
        const refetched = await oystehr.fhir.search<List>({
          resourceType: 'List',
          params: [{ name: 'identifier', value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
        });
        const refetchedCatalog = refetched.unbundle()[0] as List | undefined;
        if (!refetchedCatalog) {
          console.error('rename-custom-folder: catalog disappeared during optimistic-lock retry');
          throw FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No custom folders catalog found`);
        }
        currentCatalog = refetchedCatalog;
      } else {
        console.error(
          `rename-custom-folder: catalog update failed on attempt ${attempt}:`,
          err?.statusCode,
          err?.message ?? err
        );
        throw err;
      }
    }
  }

  // Per-patient List instances no longer carry the display name — the patient docs UI
  // resolves it from the catalog. So a rename is just a single catalog update; nothing
  // else needs to change.
  return { internalName, displayName: newName };
};
