import Oystehr from '@oystehr/sdk';
import { BatchInputPostRequest } from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { List } from 'fhir/r4b';
import {
  BUCKET_NAMES,
  CreateCustomFolderOutput,
  createCustomPatientDocumentList,
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

  // Derive internal name first so we can detect a retry-to-completion of the same folder.
  const internalName = deriveInternalFolderName(folderName);
  if (!internalName) {
    throw INVALID_INPUT_ERROR('Could not derive a valid internal name from the provided folder name');
  }

  // A retry is a re-invocation with the same display name AND the same derived internal name
  // as an existing catalog entry. Bucket creation, catalog append, and per-patient fan-out below
  // are all idempotent; allowing this path lets an admin re-run after a partial failure
  // (e.g. zambda timeout mid-fan-out) and finish provisioning without manual intervention.
  const lowerName = folderName.toLowerCase().trim();
  const matchedByDisplay = existingDefs.find((d) => d.displayName.toLowerCase().trim() === lowerName);
  const matchedByInternal = existingDefs.find((d) => d.internalName === internalName);
  const isRetry = !!matchedByDisplay && matchedByDisplay.internalName === internalName;

  if (matchedByDisplay && !isRetry) {
    throw { ...INVALID_INPUT_ERROR(`A folder named "${folderName}" already exists`), statusCode: 409 };
  }

  if (matchedByInternal && !isRetry) {
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

  if (isRetry) {
    console.log(`create-custom-folder: retry detected for "${folderName}" (${internalName}) — resuming provisioning`);
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

  // Append to catalog with optimistic locking
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
        // Create catalog
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
      } else {
        // Check if entry already present (idempotency)
        const alreadyPresent = (currentCatalog.entry ?? []).some((e) => e.item?.identifier?.value === internalName);
        if (alreadyPresent) {
          console.log(`create-custom-folder: catalog already contains entry for "${internalName}" — skipping append`);
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
      }
    } catch (err: any) {
      if (err?.statusCode === 412 && attempt < MAX_RETRIES) {
        // Conflict — refetch and retry
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

  // Fan-out: create per-patient instance Lists.
  // A FHIR transaction is atomic: if a batch throws, none of the 100 patients in that batch
  // got their List. We catch per-batch and continue so a single bad batch doesn't strand the
  // remaining patients; the failed patient IDs are logged and the admin can retry the whole
  // create-custom-folder call (idempotent — see retry detection above) to fill the gaps.
  const PAGE_SIZE = 100;
  let pageOffset = 0;
  let fanOutProcessed = 0;
  const failedPatientIds: string[] = [];

  console.log(`create-custom-folder: starting per-patient fan-out for "${internalName}" (page size ${PAGE_SIZE})`);

  let hasMorePages = true;
  let pageNumber = 0;
  while (hasMorePages) {
    pageNumber++;
    const pageBundle = await oystehr.fhir.search<any>({
      resourceType: 'Patient',
      params: [
        { name: '_elements', value: 'id' },
        { name: '_count', value: String(PAGE_SIZE) },
        { name: '_offset', value: String(pageOffset) },
      ],
    });

    const patients = pageBundle.unbundle();
    if (patients.length === 0) break;

    const patientIds: string[] = patients.map((p: any) => p.id);
    const batchEntries: BatchInputPostRequest<List>[] = patients.map((patient: any) => ({
      method: 'POST',
      url: '/List',
      resource: createCustomPatientDocumentList(`Patient/${patient.id}`, { internalName, displayName: folderName }),
      ifNoneExist: `subject=Patient/${patient.id}&title=${internalName}`,
    }));

    if (batchEntries.length > 0) {
      try {
        await oystehr.fhir.transaction({ requests: batchEntries });
        console.log(
          `create-custom-folder: page ${pageNumber} OK — provisioned ${batchEntries.length} patients (offset ${pageOffset})`
        );
      } catch (err: any) {
        console.error(
          `create-custom-folder: page ${pageNumber} FAILED — ${batchEntries.length} patients NOT provisioned (offset ${pageOffset}). Error:`,
          err?.statusCode,
          err?.message ?? err
        );
        console.error(`create-custom-folder: failed patient IDs (page ${pageNumber}):`, patientIds);
        failedPatientIds.push(...patientIds);
      }
    }

    fanOutProcessed += patients.length;
    if (patients.length < PAGE_SIZE) {
      hasMorePages = false;
    } else {
      pageOffset += PAGE_SIZE;
    }
  }

  if (failedPatientIds.length > 0) {
    console.error(
      `create-custom-folder: completed with ${failedPatientIds.length} of ${fanOutProcessed} patients NOT provisioned for "${internalName}". ` +
        `Re-run create-custom-folder with the same folder name to retry (idempotent).`
    );
    console.error(`create-custom-folder: full list of failed patient IDs for "${internalName}":`, failedPatientIds);
  } else {
    console.log(
      `create-custom-folder: fan-out complete — ${fanOutProcessed} patients processed for "${internalName}" with no batch errors`
    );
  }

  return { internalName, displayName: folderName };
};
