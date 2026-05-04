import Oystehr from '@oystehr/sdk';
import { BatchInputRequest } from '@oystehr/sdk';
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
    const userToken = (input.headers.Authorization as string).replace('Bearer ', '');
    if (!userToken) {
      throw NOT_AUTHORIZED;
    }

    const validatedInput = validateRequestParameters(input);
    const { internalName, newName, secrets } = validatedInput;

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
        currentCatalog = refetched.unbundle()[0];
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

  // Patch all per-patient instance Lists: update code.coding[0].display.
  // A FHIR transaction is atomic: if a batch throws, none of the patients in that batch were
  // updated. We catch per-batch and continue so a single bad batch doesn't strand the rest;
  // failed instance IDs are logged so the admin can re-run the rename to retry.
  const PATIENT_FOLDERS_CODE = 'patient-docs-folder';
  let processed = 0;
  let pageOffset = 0;
  const PAGE_SIZE = 100;
  const failedInstanceIds: string[] = [];

  console.log(`rename-custom-folder: starting per-patient instance update (page size ${PAGE_SIZE})`);

  let hasMorePages = true;
  let pageNumber = 0;
  while (hasMorePages) {
    pageNumber++;
    console.log(`rename-custom-folder: searching page ${pageNumber} (offset ${pageOffset})`);
    const instanceResults = await oystehr.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: 'code', value: PATIENT_FOLDERS_CODE },
        { name: 'title', value: internalName },
        { name: '_count', value: String(PAGE_SIZE) },
        { name: '_offset', value: String(pageOffset) },
      ],
    });

    const instances = instanceResults.unbundle() as List[];
    console.log(`rename-custom-folder: page ${pageNumber} returned ${instances.length} instance(s)`);
    if (instances.length === 0) break;

    const instanceIds: string[] = instances.map((i) => i.id ?? '');
    const patchRequests: BatchInputRequest<List>[] = instances.map((instance) => {
      const updatedCoding = (instance.code?.coding ?? []).map((c) => {
        if (c.system === 'https://fhir.zapehr.com/r4/StructureDefinitions' && c.code === PATIENT_FOLDERS_CODE) {
          return { ...c, display: newName };
        }
        return c;
      });

      const updatedInstance: List = {
        ...instance,
        code: { ...instance.code, coding: updatedCoding },
      };

      return {
        method: 'PUT' as const,
        url: `/List/${instance.id}`,
        resource: updatedInstance,
      };
    });

    if (patchRequests.length > 0) {
      try {
        await oystehr.fhir.transaction({ requests: patchRequests });
        console.log(
          `rename-custom-folder: page ${pageNumber} OK — updated ${patchRequests.length} instance(s) (offset ${pageOffset})`
        );
      } catch (err: any) {
        console.error(
          `rename-custom-folder: page ${pageNumber} FAILED — ${patchRequests.length} instance(s) NOT updated (offset ${pageOffset}). Error:`,
          err?.statusCode,
          err?.message ?? err
        );
        console.error(`rename-custom-folder: failed instance IDs (page ${pageNumber}):`, instanceIds);
        failedInstanceIds.push(...instanceIds);
      }
    }

    processed += instances.length;
    if (instances.length < PAGE_SIZE) {
      hasMorePages = false;
    } else {
      pageOffset += PAGE_SIZE;
    }
  }

  if (failedInstanceIds.length > 0) {
    console.error(
      `rename-custom-folder: completed with ${failedInstanceIds.length} of ${processed} instance(s) NOT updated for "${internalName}". ` +
        `Re-run rename-custom-folder with the same parameters to retry.`
    );
    console.error(`rename-custom-folder: full list of failed instance IDs:`, failedInstanceIds);
  } else {
    console.log(
      `rename-custom-folder: complete — ${processed} per-patient List(s) updated for "${internalName}" → "${newName}"`
    );
  }

  return { internalName, displayName: newName };
};
