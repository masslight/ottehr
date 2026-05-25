import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  CreateCustomFolderInputValidated,
  CreateCustomFolderOutput,
  deriveInternalFolderName,
  FOLDERS_CONFIG,
  getSecret,
  INVALID_INPUT_ERROR,
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
import { createOystehrClient } from '../../shared/helpers';
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
    const oystehr = createOystehrClient(m2mToken, secrets);

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

  const catalog = await loadCustomFoldersCatalog(oystehr);
  const allDefs = parseCustomFoldersCatalogIncludingDeleted(catalog);

  const internalName = deriveInternalFolderName(folderName);
  if (!internalName) {
    throw INVALID_INPUT_ERROR('Could not derive a valid internal name from the provided folder name');
  }

  const lowerName = folderName.toLowerCase().trim();
  const visibleDefs = allDefs.filter((d) => !d.deleted);
  if (visibleDefs.some((d) => d.displayName.toLowerCase().trim() === lowerName)) {
    throw { ...INVALID_INPUT_ERROR(`A folder named "${folderName}" already exists`), statusCode: 409 };
  }

  const sameInternal = allDefs.find((d) => d.internalName === internalName);
  if (sameInternal && !sameInternal.deleted) {
    throw {
      ...INVALID_INPUT_ERROR(`A folder with a similar name already exists`),
      statusCode: 409,
    };
  }

  // Either insert a new entry, or clear the tombstone on an existing soft-deleted
  // entry with the same internalName (refreshing its display to the newly-supplied
  // folderName so any case/punctuation tweak the admin made on re-create is honored).
  await writeCustomFoldersCatalog({
    oystehr,
    initialCatalog: catalog,
    mutate: (current) => {
      const entries = current.entry ?? [];
      const existingIdx = entries.findIndex((e) => e.item?.identifier?.value === internalName);
      if (existingIdx >= 0) {
        const existing = entries[existingIdx];
        // Strip the soft-delete tombstone marker (entry.flag) when resurrecting.
        const { flag: _flag, ...rest } = existing;
        void _flag;
        const updated = {
          ...rest,
          item: { ...existing.item, display: folderName, identifier: { value: internalName } },
        };
        return { ...current, entry: entries.map((e, i) => (i === existingIdx ? updated : e)) };
      }
      const newEntry = {
        item: {
          display: folderName,
          identifier: { value: internalName },
        },
      };
      return { ...current, entry: [...entries, newEntry] };
    },
    tag: 'create-custom-folder',
    createIfMissing: true,
  });

  // Per-patient List instances are no longer created up front — they're created lazily
  // by create-upload-document-url on first upload to this folder. The catalog is the
  // source of truth; the patient docs UI synthesizes folder entries from it.
  return { internalName, displayName: folderName };
};
