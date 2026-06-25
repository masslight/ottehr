import { APIGatewayProxyResult } from 'aws-lambda';
import {
  FileType,
  FileTypeMap,
  getSecret,
  LegacyFile,
  LegacyPatientRecord,
  MISSING_REQUIRED_PARAMETERS,
  SearchLegacyRecordsInput,
  SearchLegacyRecordsOutput,
  Secrets,
  SecretsKeys,
} from 'utils';
import { checkOrCreateM2MClientToken, createClinicalOystehrClient, wrapHandler, ZambdaInput } from '../../shared';

const ZAMBDA_NAME = 'ehr-search-legacy-records';
const LEGACY_DATA_BUCKET_SUFFIX = 'legacy-data';

const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 50;
const MAX_FILES_PER_RECORD = 200;
const PRESIGNED_URL_CONCURRENCY = 10;

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { secrets, lastName, firstName, dateOfBirth, page, pageSize, maxFilesPerRecord } =
    validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

  const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
  const bucketName = `${projectId}-${LEGACY_DATA_BUCKET_SUFFIX}`;

  // Build prefix from search parameters (all lowercased)
  const parts: string[] = [sanitizeForZ3Path(lastName.toLowerCase().trim())];
  if (firstName?.trim()) {
    parts.push(sanitizeForZ3Path(firstName.toLowerCase().trim()));
  }
  if (dateOfBirth?.trim()) {
    parts.push(sanitizeForZ3Path(dateOfBirth.trim()));
  }
  const prefix = parts.join('_');

  console.log(`Searching Z3 bucket '${bucketName}' with prefix '${prefix}'`);

  // List all objects under the prefix
  const objects = await oystehr.z3.listObjects({
    bucketName,
    'objectPath+': prefix,
  });

  if (!objects || objects.length === 0) {
    return {
      statusCode: 200,
      body: JSON.stringify({ results: [], total: 0, page, pageSize } satisfies SearchLegacyRecordsOutput),
    };
  }

  // listObjects returns keys with the bucket name as the leading path segment.
  // Strip it so objectPath values are relative to the bucket (as getPresignedUrl expects).
  const bucketPrefix = `${bucketName}/`;
  const stripBucketPrefix = (key: string): string =>
    key.startsWith(bucketPrefix) ? key.slice(bucketPrefix.length) : key;

  // Group by patient folder (first path segment after stripping bucket prefix).
  // Supports two key structures:
  //   - Flat (manually uploaded):  {patientFolder}/{filename}
  //   - Nested (import script):    {patientFolder}/{patientId}/{subpath...}
  const byFolder: Record<string, { patientId: string; keys: string[] }> = {};
  for (const obj of objects) {
    const objectPath = stripBucketPrefix(obj.key);
    const segments = objectPath.split('/');
    if (segments.length < 2) continue;
    // Skip folder marker entries
    if (segments[segments.length - 1] === '') continue;

    const patientFolder = segments[0];
    const isNested = segments.length > 2;
    const patientId = isNested ? segments[1] : '';

    if (!byFolder[patientFolder]) {
      byFolder[patientFolder] = { patientId, keys: [] };
    }
    byFolder[patientFolder].keys.push(objectPath);
  }

  // Paginate patient folders
  const allFolderEntries = Object.entries(byFolder);
  const total = allFolderEntries.length;
  const offset = (page - 1) * pageSize;
  const pageFolderEntries = allFolderEntries.slice(offset, offset + pageSize);

  // Build results for this page, generating presigned URLs in bounded batches
  const results: LegacyPatientRecord[] = [];
  for (const [patientFolder, { patientId, keys }] of pageFolderEntries) {
    const folderParts = patientFolder.split('_');
    const displayLastName = folderParts[0] ? capitalize(folderParts[0]) : '';
    const firstNameParts = folderParts.slice(1, -1);
    const displayFirstName = firstNameParts.map(capitalize).join(' ');
    const displayDob = folderParts[folderParts.length - 1] || '';
    const displayName = `${displayLastName}, ${displayFirstName}${displayDob ? ` (DOB: ${displayDob})` : ''}`;

    const cappedKeys = keys.slice(0, maxFilesPerRecord);
    const files: LegacyFile[] = [];
    for (let i = 0; i < cappedKeys.length; i += PRESIGNED_URL_CONCURRENCY) {
      const batch = cappedKeys.slice(i, i + PRESIGNED_URL_CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(async (key) => {
          const fileName = key.split('/').pop() ?? key;
          const lowerKey = key.toLowerCase();

          const fileType = getFileTypeFromKey(lowerKey);

          const presignedResponse = await oystehr.z3.getPresignedUrl({
            action: 'download',
            bucketName,
            'objectPath+': key,
          });
          return { key, fileName, fileType, presignedUrl: presignedResponse.signedUrl };
        })
      );
      files.push(...batchResults);
    }

    results.push({ patientFolder, patientId, displayName, files });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ results, total, page, pageSize } satisfies SearchLegacyRecordsOutput),
  };
});

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Removes leading/trailing spaces, replaces inner whitespace with "_",
 * Strips any character that is not accepted in z3 object naming.
 * Characters accepted: letters, numbers, plus (+), exclamation point (!), hyphen (-), underscore (_), single quote ('),
 * open parenthesis ((), closed parenthesis ()), period (.), at sign (@), dollar sign ($)
 */
function sanitizeForZ3Path(value: string): string {
  // this logic matches what was used to push data in the v2 migration
  return value
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^A-Za-z0-9+!_\-'.()@$]/g, '');
}
interface ValidatedParameters {
  secrets: Secrets | null;
  lastName: string;
  firstName?: string;
  dateOfBirth?: string;
  page: number;
  pageSize: number;
  maxFilesPerRecord: number;
}

function validateRequestParameters(input: ZambdaInput): ValidatedParameters {
  if (!input.body) {
    throw MISSING_REQUIRED_PARAMETERS(['body']);
  }

  let body: SearchLegacyRecordsInput;
  try {
    body = typeof input.body === 'string' ? JSON.parse(input.body) : input.body;
  } catch {
    throw new Error('Invalid JSON body');
  }

  const {
    lastName,
    firstName,
    dateOfBirth,
    page: rawPage,
    pageSize: rawPageSize,
    maxFilesPerRecord: rawMaxFiles,
  } = body;

  if (!lastName?.trim()) {
    throw MISSING_REQUIRED_PARAMETERS(['lastName']);
  }

  if (dateOfBirth?.trim() && !firstName?.trim()) {
    throw MISSING_REQUIRED_PARAMETERS(['firstName (required when dateOfBirth is provided)']);
  }

  const page = Math.max(1, typeof rawPage === 'number' ? Math.floor(rawPage) : 1);
  const pageSize = Math.min(
    PAGE_SIZE_MAX,
    Math.max(1, typeof rawPageSize === 'number' ? Math.floor(rawPageSize) : PAGE_SIZE_DEFAULT)
  );
  const maxFilesPerRecord = Math.max(
    1,
    typeof rawMaxFiles === 'number' ? Math.floor(rawMaxFiles) : MAX_FILES_PER_RECORD
  );

  return {
    secrets: input.secrets,
    lastName,
    firstName,
    dateOfBirth,
    page,
    pageSize,
    maxFilesPerRecord,
  };
}

function getFileTypeFromKey(key: string): FileType {
  const lowerKey = key.toLowerCase();

  for (const [fileType, { folder: folderName }] of Object.entries(FileTypeMap)) {
    const folderNameLower = folderName.toLocaleLowerCase();

    if (lowerKey.includes(folderNameLower)) return fileType as FileType;

    // first iteration data migration pushed in progress notes under /enc
    if (fileType === FileType.PROGRESS_NOTE) {
      if (lowerKey.includes('/enc/') || lowerKey.endsWith('/enc')) {
        return fileType as FileType;
      }
    }
  }

  return FileType.OTHER;
}
