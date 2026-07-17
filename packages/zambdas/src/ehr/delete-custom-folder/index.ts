import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CUSTOM_FOLDER_DELETED_FLAG_CODE,
  CUSTOM_FOLDER_ENTRY_FLAG_SYSTEM,
  DeleteCustomFolderInputValidated,
  DeleteCustomFolderOutput,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getSecret,
  isCustomFolderCatalogEntryDeleted,
  NOT_AUTHORIZED,
  parseCustomFoldersCatalogIncludingDeleted,
  SecretsKeys,
} from 'utils';
import {
  checkOrCreateM2MClientToken,
  loadCustomFoldersCatalog,
  requireAdminUser,
  topLevelCatch,
  wrapHandler,
  writeCustomFoldersCatalog,
  ZambdaInput,
} from '../../shared';
import { createClinicalOystehrClient } from '../../shared/helpers';
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

    await requireAdminUser(userToken, secrets);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

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

  const catalog = await loadCustomFoldersCatalog(oystehr, { required: true });
  const defs = parseCustomFoldersCatalogIncludingDeleted(catalog);
  const existing = defs.find((d) => d.internalName === internalName);
  if (!existing) {
    throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Custom folder "${internalName}" not found`), statusCode: 404 };
  }
  // Idempotent: if the entry is already soft-deleted, treat as success without rewriting.
  if (existing.deleted) {
    console.log(`delete-custom-folder: "${internalName}" already soft-deleted — no-op`);
    return { internalName };
  }

  await writeCustomFoldersCatalog({
    oystehr,
    initialCatalog: catalog,
    // Soft-delete via `entry.flag`. Keeps the latest displayName accessible
    // to the patient docs read path so existing per-patient Lists resolve to the
    // current name.
    mutate: (current) => ({
      ...current,
      entry: (current.entry ?? []).map((entry) =>
        entry.item?.identifier?.value === internalName
          ? {
              ...entry,
              flag: { coding: [{ system: CUSTOM_FOLDER_ENTRY_FLAG_SYSTEM, code: CUSTOM_FOLDER_DELETED_FLAG_CODE }] },
            }
          : entry
      ),
    }),
    tag: 'delete-custom-folder',
    // If a concurrent writer already soft-deleted (or removed) the entry, treat as success.
    onConflictRefetched: (refetched) => {
      const e = (refetched.entry ?? []).find((x) => x.item?.identifier?.value === internalName);
      return !e || isCustomFolderCatalogEntryDeleted(e);
    },
  });

  // Per-patient List instances and stored objects in the shared CUSTOM_FOLDERS bucket
  // are deliberately left intact. The catalog entry stays as a tombstone so reads keep
  // resolving to the latest displayName; creating a folder with the same displayName
  // (and therefore same internalName) clears the tombstone and re-adopts the documents.
  return { internalName };
};
