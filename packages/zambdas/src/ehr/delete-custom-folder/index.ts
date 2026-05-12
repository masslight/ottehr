import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  DeleteCustomFolderInputValidated,
  DeleteCustomFolderOutput,
  FHIR_RESOURCE_NOT_FOUND_CUSTOM,
  getSecret,
  NOT_AUTHORIZED,
  parseCustomFoldersCatalog,
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

  const catalog = await loadCustomFoldersCatalog(oystehr, { required: true });
  const defs = parseCustomFoldersCatalog(catalog);
  if (!defs.some((d) => d.internalName === internalName)) {
    throw { ...FHIR_RESOURCE_NOT_FOUND_CUSTOM(`Custom folder "${internalName}" not found`), statusCode: 404 };
  }

  await writeCustomFoldersCatalog({
    oystehr,
    initialCatalog: catalog,
    mutate: (current) => ({
      ...current,
      entry: (current.entry ?? []).filter((entry) => entry.item?.identifier?.value !== internalName),
    }),
    tag: 'delete-custom-folder',
    // If a concurrent writer already removed the entry, treat as success.
    onConflictRefetched: (refetched) =>
      !(refetched.entry ?? []).some((e) => e.item?.identifier?.value === internalName),
  });

  // Per-patient List instances and stored objects in the shared CUSTOM_FOLDERS bucket
  // are deliberately left intact. The read path picks them up as orphans and resolves
  // the display name from each per-patient List's own coding. Re-creating a folder with
  // the same display (and therefore same internal name) re-adopts the orphans.
  return { internalName };
};
