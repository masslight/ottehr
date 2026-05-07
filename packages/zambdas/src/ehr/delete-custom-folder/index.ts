import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  CUSTOM_FOLDERS_CATALOG_IDENTIFIER,
  DeleteCustomFolderInputValidated,
  DeleteCustomFolderOutput,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getSecret,
  NOT_AUTHORIZED,
  parseCustomFoldersCatalog,
  RoleType,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, getUser, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('delete-custom-folder', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    if (!input.headers?.Authorization) {
      throw NOT_AUTHORIZED;
    }

    let validatedInput: DeleteCustomFolderInputValidated;
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

    const { internalName, secrets, userToken } = validatedInput;

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

    const result = await performEffect(internalName, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('delete-custom-folder', error, ENVIRONMENT);
  }
});

const performEffect = async (internalName: string, oystehr: Oystehr): Promise<DeleteCustomFolderOutput> => {
  console.log(`delete-custom-folder: starting for "${internalName}"`);

  const catalogResults = await oystehr.fhir.search<List>({
    resourceType: 'List',
    params: [{ name: 'identifier', value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
  });
  const catalog = catalogResults.unbundle()[0] as List | undefined;

  if (!catalog) {
    throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No custom folders catalog found`), statusCode: 404 };
  }

  const defs = parseCustomFoldersCatalog(catalog);
  if (!defs.some((d) => d.internalName === internalName)) {
    throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Custom folder "${internalName}" not found`), statusCode: 404 };
  }

  const MAX_RETRIES = 3;
  let attempt = 0;
  let currentCatalog: List = catalog;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      const updatedEntries = (currentCatalog.entry ?? []).filter(
        (entry) => entry.item?.identifier?.value !== internalName
      );

      await oystehr.fhir.update<List>(
        { ...currentCatalog, entry: updatedEntries },
        { optimisticLockingVersionId: currentCatalog.meta?.versionId }
      );
      console.log(`delete-custom-folder: catalog updated on attempt ${attempt}`);
      break;
    } catch (err: any) {
      if (err?.statusCode === 412 && attempt < MAX_RETRIES) {
        console.warn(
          `delete-custom-folder: catalog optimistic-lock conflict on attempt ${attempt} — refetching and retrying`
        );
        const refetched = await oystehr.fhir.search<List>({
          resourceType: 'List',
          params: [{ name: 'identifier', value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
        });
        const next = refetched.unbundle()[0] as List | undefined;
        if (!next) {
          throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`No custom folders catalog found`), statusCode: 404 };
        }
        currentCatalog = next;
        // If a concurrent writer already removed the entry, treat as success.
        const stillPresent = (currentCatalog.entry ?? []).some((e) => e.item?.identifier?.value === internalName);
        if (!stillPresent) {
          console.log(`delete-custom-folder: entry already absent after refetch — treating as success`);
          break;
        }
      } else {
        console.error(
          `delete-custom-folder: catalog update failed on attempt ${attempt}:`,
          err?.statusCode,
          err?.message ?? err
        );
        throw err;
      }
    }
  }

  // Per-patient List instances and stored objects in the shared CUSTOM_FOLDERS bucket
  // are deliberately left intact. The read path picks them up as orphans and resolves
  // the display name from each per-patient List's own coding. Re-creating a folder with
  // the same display (and therefore same internal name) re-adopts the orphans.
  return { internalName };
};
