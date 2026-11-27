import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { FOLDERS_CONFIG } from 'utils/lib/fhir/constants';
import { deriveInternalFolderName } from 'utils/lib/fhir/list';
import { getSecret, SecretsKeys } from 'utils/lib/secrets';
import { CreateCustomFolderInputValidated, CreateCustomFolderOutput } from 'utils/lib/types/data/custom-folder.types';
import { INVALID_INPUT_ERROR, NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { checkOrCreateM2MClientToken, requireAdminUser } from '../../shared/auth';
import { loadCustomFoldersCatalog, writeCustomFoldersCatalog } from '../../shared/custom-folders';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { topLevelCatch } from '../../shared/lambda';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { addFolderToCatalog } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler('create-custom-folder', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    if (!input.headers?.Authorization) {
      throw NOT_AUTHORIZED;
    }

    let validatedInput: CreateCustomFolderInputValidated;
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

    const { folderName, secrets, userToken } = validatedInput;

    await requireAdminUser(userToken, secrets);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createClinicalOystehrClient(m2mToken, secrets);

    const result = await performEffect(folderName, oystehr);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('create-custom-folder', error, ENVIRONMENT);
  }
});

const performEffect = async (folderName: string, oystehr: Oystehr): Promise<CreateCustomFolderOutput> => {
  const systemDisplayNames = FOLDERS_CONFIG.map((f) => f.display.toLowerCase().trim());
  if (systemDisplayNames.includes(folderName.toLowerCase().trim())) {
    throw { ...INVALID_INPUT_ERROR(`A folder named "${folderName}" already exists`), statusCode: 409 };
  }

  const internalName = deriveInternalFolderName(folderName);
  if (!internalName) {
    throw INVALID_INPUT_ERROR('Could not derive a valid internal name from the provided folder name');
  }

  const catalog = await loadCustomFoldersCatalog(oystehr);

  await writeCustomFoldersCatalog({
    oystehr,
    initialCatalog: catalog,
    mutate: (current) => addFolderToCatalog(current, folderName, internalName),
    tag: 'create-custom-folder',
    createIfMissing: true,
  });

  // Per-patient List instances are no longer created up front — they're created lazily
  // by create-upload-document-url on first upload to this folder. The catalog is the
  // source of truth; the patient docs UI synthesizes folder entries from it.
  return { internalName, displayName: folderName };
};
