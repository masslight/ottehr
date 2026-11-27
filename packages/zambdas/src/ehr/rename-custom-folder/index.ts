import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { RenameCustomFolderInputValidated, RenameCustomFolderOutput } from 'utils/lib/types/data/custom-folder.types';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, requireAdminUser } from '../../shared/auth';
import { loadCustomFoldersCatalog, writeCustomFoldersCatalog } from '../../shared/custom-folders';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { renameFolderInCatalog } from './helpers';
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

  await writeCustomFoldersCatalog({
    oystehr,
    initialCatalog: catalog,
    mutate: (current) => renameFolderInCatalog(current, internalName, newName),
    tag: 'rename-custom-folder',
  });

  // Per-patient List instances no longer carry the display name — the patient docs UI
  // resolves it from the catalog. So a rename is just a single catalog update; nothing
  // else needs to change.
  return { internalName, displayName: newName };
};
