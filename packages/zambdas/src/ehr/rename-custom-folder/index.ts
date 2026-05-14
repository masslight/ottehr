import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  FOLDERS_CONFIG,
  getSecret,
  INVALID_INPUT_ERROR,
  NOT_AUTHORIZED,
  parseCustomFoldersCatalog,
  RenameCustomFolderInputValidated,
  RenameCustomFolderOutput,
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

    await requireAdminUser(userToken, secrets);

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

  const catalog = await loadCustomFoldersCatalog(oystehr, { required: true });
  const defs = parseCustomFoldersCatalog(catalog);

  if (!defs.some((d) => d.internalName === internalName)) {
    throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Custom folder "${internalName}" not found`), statusCode: 404 };
  }

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
