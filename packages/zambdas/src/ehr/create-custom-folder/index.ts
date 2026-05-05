import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  BUCKET_NAMES,
  CreateCustomFolderOutput,
  CUSTOM_FOLDERS_CATALOG_IDENTIFIER,
  deriveInternalFolderName,
  FOLDERS_CONFIG,
  getSecret,
  INVALID_INPUT_ERROR,
  NOT_AUTHORIZED,
  parseCustomFoldersCatalog,
  RoleType,
  Secrets,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, getUser, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const CATALOG_SYSTEM = 'https://fhir.ottehr.com/r4/CodeSystem/folder-kind';
const CATALOG_CODE = 'custom-folders-catalog';
const CATALOG_IDENTIFIER_SYSTEM = 'https://fhir.ottehr.com/r4/identifier';

export const index = wrapHandler('create-custom-folder', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    if (!input.headers?.Authorization) {
      throw NOT_AUTHORIZED;
    }
    const userToken = (input.headers.Authorization as string).replace('Bearer ', '');
    if (!userToken) {
      throw NOT_AUTHORIZED;
    }

    const validatedInput = validateRequestParameters(input);
    const { folderName, secrets } = validatedInput;

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

    const result = await performEffect(folderName, oystehr, secrets);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('create-custom-folder', error, ENVIRONMENT);
  }
});

const performEffect = async (
  folderName: string,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<CreateCustomFolderOutput> => {
  // Check for duplicate display name against system folders
  const systemDisplayNames = FOLDERS_CONFIG.map((f) => f.display.toLowerCase().trim());
  if (systemDisplayNames.includes(folderName.toLowerCase().trim())) {
    throw { ...INVALID_INPUT_ERROR(`A folder named "${folderName}" already exists`), statusCode: 409 };
  }

  // Upsert catalog
  const catalogResults = await oystehr.fhir.search<List>({
    resourceType: 'List',
    params: [{ name: 'identifier', value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
  });
  const catalog = catalogResults.unbundle()[0] as List | undefined;

  const existingDefs = parseCustomFoldersCatalog(catalog);

  const internalName = deriveInternalFolderName(folderName);
  if (!internalName) {
    throw INVALID_INPUT_ERROR('Could not derive a valid internal name from the provided folder name');
  }

  const lowerName = folderName.toLowerCase().trim();
  if (existingDefs.some((d) => d.displayName.toLowerCase().trim() === lowerName)) {
    throw { ...INVALID_INPUT_ERROR(`A folder named "${folderName}" already exists`), statusCode: 409 };
  }
  if (existingDefs.some((d) => d.internalName === internalName)) {
    throw {
      ...INVALID_INPUT_ERROR(`A folder with internal name "${internalName}" already exists`),
      statusCode: 409,
    };
  }

  // Defensive: structurally impossible since custom internal names always begin with
  // "custom-folder-" and no system bucket name does.
  const systemBucketNames = Object.values(BUCKET_NAMES) as string[];
  if (systemBucketNames.includes(internalName)) {
    throw {
      ...INVALID_INPUT_ERROR(`The folder name "${folderName}" conflicts with a system folder`),
      statusCode: 409,
    };
  }

  // Create Z3 bucket — must use the full {projectId}-{internalName} name to match
  // what makeZ3Url constructs when building presigned URLs for uploads/downloads.
  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const fullBucketName = `${projectId}-${internalName}`;
  try {
    await (oystehr as any).z3.createBucket({ bucketName: fullBucketName });
    console.log(`create-custom-folder: created Z3 bucket "${fullBucketName}"`);
  } catch (err: any) {
    const msg = err?.message ?? '';
    if (msg.toLowerCase().includes('already exist') || err?.statusCode === 409) {
      console.log(`create-custom-folder: Z3 bucket "${fullBucketName}" already exists — continuing`);
    } else {
      console.error(`create-custom-folder: failed to create Z3 bucket "${fullBucketName}":`, err?.message ?? err);
      throw err;
    }
  }

  const newEntry = {
    item: {
      display: folderName,
      identifier: { value: internalName },
    },
  };

  const MAX_RETRIES = 3;
  let attempt = 0;
  let currentCatalog = catalog;

  while (attempt < MAX_RETRIES) {
    attempt++;
    try {
      if (!currentCatalog) {
        currentCatalog = await oystehr.fhir.create<List>({
          resourceType: 'List',
          status: 'current',
          mode: 'working',
          code: {
            coding: [{ system: CATALOG_SYSTEM, code: CATALOG_CODE }],
          },
          identifier: [{ system: CATALOG_IDENTIFIER_SYSTEM, value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
          entry: [newEntry],
        });
        console.log(`create-custom-folder: catalog List created with first entry "${internalName}"`);
        break;
      }

      const updatedCatalog: List = {
        ...currentCatalog,
        entry: [...(currentCatalog.entry ?? []), newEntry],
      };
      await oystehr.fhir.update(updatedCatalog, {
        optimisticLockingVersionId: currentCatalog.meta?.versionId,
      });
      console.log(`create-custom-folder: appended "${internalName}" to catalog (attempt ${attempt})`);
      break;
    } catch (err: any) {
      if (err?.statusCode === 412 && attempt < MAX_RETRIES) {
        console.warn(
          `create-custom-folder: catalog optimistic-lock conflict on attempt ${attempt} — refetching and retrying`
        );
        const refetched = await oystehr.fhir.search<List>({
          resourceType: 'List',
          params: [{ name: 'identifier', value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
        });
        currentCatalog = refetched.unbundle()[0];
      } else {
        console.error(
          `create-custom-folder: catalog upsert failed on attempt ${attempt}:`,
          err?.statusCode,
          err?.message ?? err
        );
        throw err;
      }
    }
  }

  // Per-patient List instances are no longer created up front — they're created lazily
  // by create-upload-document-url on first upload to this folder. The catalog is the
  // source of truth; the patient docs UI synthesizes folder entries from it.
  return { internalName, displayName: folderName };
};
