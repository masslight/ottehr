import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FOLDERS_CONFIG } from 'utils/lib/fhir/constants';
import { parseCustomFoldersCatalogIncludingDeleted } from 'utils/lib/fhir/list';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { RenameCustomFolderInputValidated, RenameCustomFolderOutput } from 'utils/lib/types/data/custom-folder.types';
import { FHIR_RESOURCE_NOT_FOUND_CUSTOM, INVALID_INPUT_ERROR, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, requireAdminUser } from '../../shared/auth';
import { loadCustomFoldersCatalog, writeCustomFoldersCatalog } from '../../shared/custom-folders';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
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

    await requireAdminUser(userToken, secrets);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

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

  const catalog = await loadCustomFoldersCatalog(oystehr, { required: true });
  const defs = parseCustomFoldersCatalogIncludingDeleted(catalog);

  const target = defs.find((d) => d.internalName === internalName);
  if (!target) {
    throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Custom folder "${internalName}" not found`), statusCode: 404 };
  }
  // Soft-deleted (tombstoned) entries are read-only — admin must re-create the
  // folder (which clears the tombstone) before they can rename it.
  if (target.deleted) {
    throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Custom folder "${internalName}" not found`), statusCode: 404 };
  }

  // Uniqueness check: newName must not match any system folder display or another
  // active custom folder. Soft-deleted entries don't reserve display names.
  const systemDisplayNames = FOLDERS_CONFIG.map((f) => f.display.toLowerCase().trim());
  if (systemDisplayNames.includes(newName.toLowerCase().trim())) {
    throw { ...INVALID_INPUT_ERROR(`A folder named "${newName}" already exists`), statusCode: 409 };
  }

  const otherCustomNames = defs
    .filter((d) => d.internalName !== internalName && !d.deleted)
    .map((d) => d.displayName.toLowerCase().trim());
  if (otherCustomNames.includes(newName.toLowerCase().trim())) {
    throw { ...INVALID_INPUT_ERROR(`A folder named "${newName}" already exists`), statusCode: 409 };
  }

  await writeCustomFoldersCatalog({
    oystehr,
    initialCatalog: catalog,
    mutate: (current) => ({
      ...current,
      entry: (current.entry ?? []).map((entry) =>
        entry.item?.identifier?.value === internalName ? { ...entry, item: { ...entry.item, display: newName } } : entry
      ),
    }),
    tag: 'rename-custom-folder',
  });

  // Per-patient List instances no longer carry the display name — the patient docs UI
  // resolves it from the catalog. So a rename is just a single catalog update; nothing
  // else needs to change.
  return { internalName, displayName: newName };
};
