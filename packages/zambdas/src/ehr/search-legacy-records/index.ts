import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, MISSING_REQUIRED_PARAMETERS, Secrets, SecretsKeys } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';

const ZAMBDA_NAME = 'ehr-search-legacy-records';
const LEGACY_DATA_BUCKET_SUFFIX = 'legacy-data';

let m2mToken: string;

export interface SearchLegacyRecordsInput {
  lastName: string;
  firstName?: string;
  dateOfBirth?: string;
}

export interface LegacyFile {
  key: string;
  fileName: string;
  fileType: 'medical-summary' | 'progress-note' | 'other';
  presignedUrl: string;
}

export interface LegacyPatientRecord {
  patientFolder: string;
  patientId: string;
  displayName: string;
  files: LegacyFile[];
}

export interface SearchLegacyRecordsOutput {
  results: LegacyPatientRecord[];
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { secrets, lastName, firstName, dateOfBirth } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const projectId = getSecret(SecretsKeys.PROJECT_ID, secrets);
    const bucketName = `${projectId}-${LEGACY_DATA_BUCKET_SUFFIX}`;

    // Build prefix from search parameters (all lowercased)
    const parts: string[] = [lastName.toLowerCase().trim()];
    if (firstName?.trim()) {
      parts.push(firstName.toLowerCase().trim());
    }
    if (dateOfBirth?.trim()) {
      parts.push(dateOfBirth.trim());
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
        body: JSON.stringify({ results: [] } satisfies SearchLegacyRecordsOutput),
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
      // In the nested structure segment[1] is the patientId (a numeric-looking string),
      // not a filename. In the flat structure it is the filename itself.
      const isNested = segments.length > 2;
      const patientId = isNested ? segments[1] : '';

      if (!byFolder[patientFolder]) {
        byFolder[patientFolder] = { patientId, keys: [] };
      }
      byFolder[patientFolder].keys.push(objectPath);
    }

    // Build result with presigned download URLs
    const results: LegacyPatientRecord[] = await Promise.all(
      Object.entries(byFolder).map(async ([patientFolder, { patientId, keys }]) => {
        const folderParts = patientFolder.split('_');
        // folder format: lastName_firstName_dob
        const displayLastName = folderParts[0] ? capitalize(folderParts[0]) : '';
        const displayFirstName = folderParts[1] ? capitalize(folderParts[1]) : '';
        const displayDob = folderParts.slice(2).join('-');
        const displayName = `${displayLastName}, ${displayFirstName}${displayDob ? ` (DOB: ${displayDob})` : ''}`;

        const files: LegacyFile[] = await Promise.all(
          keys.map(async (key) => {
            const fileName = key.split('/').pop() ?? key;
            const lowerKey = key.toLowerCase();
            const fileType: LegacyFile['fileType'] = lowerKey.includes('medical_summary')
              ? 'medical-summary'
              : lowerKey.includes('progressnotes') || lowerKey.includes('enc')
              ? 'progress-note'
              : 'other';

            const presignedResponse = await oystehr.z3.getPresignedUrl({
              action: 'download',
              bucketName,
              'objectPath+': key,
            });

            return {
              key,
              fileName,
              fileType,
              presignedUrl: presignedResponse.signedUrl,
            };
          })
        );

        return {
          patientFolder,
          patientId,
          displayName,
          files,
        };
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ results } satisfies SearchLegacyRecordsOutput),
    };
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});

function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

interface ValidatedParameters {
  secrets: Secrets | null;
  lastName: string;
  firstName?: string;
  dateOfBirth?: string;
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

  const { lastName, firstName, dateOfBirth } = body;

  if (!lastName?.trim()) {
    throw MISSING_REQUIRED_PARAMETERS(['lastName']);
  }

  return {
    secrets: input.secrets,
    lastName,
    firstName,
    dateOfBirth,
  };
}
