/**
 * Import script to migrate v2 legacy EHR data into the Z3 'legacy-data' bucket.
 *
 * Files are stored under keys structured as:
 *   {lastName}_{firstName}_{dob}/{patientId}/{relative/subpath}
 *
 * This key structure enables prefix-based search by patient name and DOB.
 *
 * Usage:
 *   npx env-cmd -f config/.env/{ENV}.json \
 *   npx tsx scripts/legacy-data/format-and-move-legacy-data.ts [--dry-run] [--data-dir <path>]
 *
 * Example:
 *   npx env-cmd -f config/.env/local.json tsx scripts/legacy-data/format-and-move-legacy-data.ts --dry-run
 *
 * The Env File:
 *   Must contain (already included in zambdas .env files):
 *   AUTH0_CLIENT, AUTH0_SECRET, AUTH0_ENDPOINT, AUTH0_AUDIENCE, PROJECT_ID, PROJECT_API.
 *
 *   Must contain (not included in zambda .env files):
 *   SOURCE_AWS_ACCESS_KEY_ID, SOURCE_AWS_SECRET_ACCESS_KEY, SOURCE_AWS_SESSION_TOKEN, SOURCE_S3_BUCKET_REGION,
 *   SOURCE_S3_BUCKET_NAME, SOURCE_KEY_PREFIX
 *
 * Mapping Csv Files:
 *   Should have the expected headers:
 *   Last_Name,First_Name,Path,BirthDate,Sex,Patient Number,Clinic,DateOfVisit,Visit Type,Document Type,Description
 *
 *   Path should correspond to an object in s3
 *
 * Optional flags:
 *   --dry-run   Print what would be uploaded without actually uploading
 *               Doing a dry run on a real mapping file will make a call with the s3 client to retrieve the file, but will not upload to z3
 *
 *   --data-dir  Path to the dir containing patient-to-file-path csv (defaults to scripts/data/sample-legacy-data/Data_Migration)
 *               Excluding this param defaults the script to run against local files and no s3 configuration is needed for that
 *
 */

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import Oystehr from '@oystehr/sdk';
import { parse } from 'csv-parse';
import { createReadStream, readdirSync, readFileSync, statSync } from 'fs';
import pLimit from 'p-limit';
import { basename, dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  buildObjectPath,
  type CsvRow,
  MAPPING_HEADERS,
  readCsvRow,
  stripDateFromDescription,
  writeCsvToLegacyDataOutput,
} from './legacy-data-utils.js';

// ── Types ──────────────────────────────────────────────────────────

type Summary = {
  uploaded: number;
  errors: number;
};

type ErrorRow = { error: string; fileName: string; csvRow: Omit<CsvRow, 'file'> };

// ── Consts ──────────────────────────────────────────────────────────
const LEGACY_DATA_BUCKET_SUFFIX = 'legacy-data';
const CONCURRENCY = 5; // Number of requests processed at concurrently
const BATCH_SIZE = 10; // Number of concurrent requests processed before moving onto the next batch

// Set to a number to cap how many rows are migrated (e.g. 5 for a smoke test). undefined = no limit.
const MAX_ROWS: number | undefined = undefined;

// If undefined, we'll process everything
const DOCUMENT_DESCRIPTIONS_TO_SKIP: string[] | undefined = ['Composite'];

const summary: Summary = {
  uploaded: 0,
  errors: 0,
};

const errorRows: ErrorRow[] = [];

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const dataDirFlagIdx = args.indexOf('--data-dir');

const useDefaultData = dataDirFlagIdx === -1 || !args[dataDirFlagIdx + 1];

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(dirname(__filename));

const defaultMappingDir = join(__dirname, 'data', 'sample-legacy-data', 'Data_Migration_v2', 'mappings');
const mappingDir = !useDefaultData ? args[dataDirFlagIdx + 1] : defaultMappingDir;

// ── Environment validation ────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

const sourceBucket = requireEnv('SOURCE_S3_BUCKET_NAME');
const sourceKeyPrefix = requireEnv('SOURCE_KEY_PREFIX');

// ── Oystehr client ────────────────────────────────────────────────────────────

async function createOystehrClient(): Promise<Oystehr> {
  const auth0Endpoint = requireEnv('AUTH0_ENDPOINT');
  const auth0Client = requireEnv('AUTH0_CLIENT');
  const auth0Secret = requireEnv('AUTH0_SECRET');
  const auth0Audience = requireEnv('AUTH0_AUDIENCE');
  const projectId = requireEnv('PROJECT_ID');
  const projectApi = requireEnv('PROJECT_API');

  const tokenResponse = await fetch(auth0Endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: auth0Client,
      client_secret: auth0Secret,
      audience: auth0Audience,
      grant_type: 'client_credentials',
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Auth0 token request failed: ${tokenResponse.status} ${errorText}`);
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };

  return new Oystehr({
    accessToken: tokenData.access_token,
    projectId,
    services: {
      projectApiUrl: projectApi,
    },
  });
}

// ── AWS client ────────────────────────────────────────────────────────────

function makeSourceS3Client(): S3Client {
  const awsAccessKeyId = requireEnv('SOURCE_AWS_ACCESS_KEY_ID');
  const awsSecretAccessKey = requireEnv('SOURCE_AWS_SECRET_ACCESS_KEY');
  const awsSessionToken = requireEnv('SOURCE_AWS_SESSION_TOKEN');
  const awsRegion = requireEnv('SOURCE_S3_BUCKET_REGION');

  const sourceS3 = new S3Client({
    region: awsRegion,
    credentials: {
      accessKeyId: awsAccessKeyId,
      secretAccessKey: awsSecretAccessKey,
      sessionToken: awsSessionToken,
    },
  });

  return sourceS3;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const limit = pLimit(CONCURRENCY);

/**
 * Only should be called when using default data within the repo as it will try to read the file locally
 * Reads the file, manually assigned a mimeType, converts to a blob and when isDryRun false uploads the file to z3
 */
async function formatDefaultDataAndUploadToZ3(
  isDryRun: boolean,
  row: CsvRow,
  bucketName: string,
  oystehr: Oystehr
): Promise<void> {
  const { path } = row;

  const fileName = basename(path);
  const fileBuffer = readFileSync(path);

  let mimeType = 'application/octet-stream';
  if (fileName.endsWith('.pdf')) {
    mimeType = 'application/pdf';
  } else if (fileName.endsWith('.tif') || fileName.endsWith('.tiff')) {
    mimeType = 'image/tiff';
  } else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
    mimeType = 'image/jpeg';
  }

  const fileBlob = new Blob([new Uint8Array(fileBuffer)], {
    type: mimeType,
  });

  const objectPath = buildObjectPath(row);

  if (!isDryRun) {
    await oystehr.z3.uploadFile({
      bucketName,
      'objectPath+': objectPath,
      file: fileBlob,
    });

    summary.uploaded++;
  }
}

/**
 * Retrieves the file from s3 based on the path stored in the row and the SOURCE_KEY_PREFIX saved in the your env file
 * file key will resolve to `${sourceKeyPrefix}/${path}` and will be grabbed from the bucket you've saved in your env: SOURCE_S3_BUCKET_NAME
 * when isDryRun is false, file is uploaded to z3
 * @param row CsvRow
 * @param s3Client needs read access to the project where the data lives
 */
async function getS3FileAndUploadToZ3(
  isDryRun: boolean,
  row: CsvRow,
  bucketName: string,
  oystehr: Oystehr,
  s3Client: S3Client | undefined
): Promise<void> {
  if (!s3Client) throw new Error(`s3Client is undefined for row: ${JSON.stringify(row)}`);

  const { path } = row;
  const objectPath = buildObjectPath(row);

  const sourceObject = await s3Client.send(
    new GetObjectCommand({
      Bucket: sourceBucket,
      Key: `${sourceKeyPrefix}/${path}`,
    })
  );

  if (!sourceObject.Body) {
    throw new Error(`no sourceObject.Body returned for row: ${JSON.stringify(row)}`);
  }

  if (!sourceObject.ContentType) {
    throw new Error(`no sourceObject.ContentType returned for row: ${JSON.stringify(row)}`);
  }

  const bytes = await sourceObject.Body.transformToByteArray();

  const fileBlob = new Blob([bytes as Uint8Array<ArrayBuffer>], {
    type: sourceObject.ContentType,
  });

  if (!isDryRun) {
    await oystehr.z3.uploadFile({
      bucketName,
      'objectPath+': objectPath,
      file: fileBlob,
    });
    summary.uploaded++;
  }
}

function logSummary(summaryData: Summary): void {
  console.log('');
  console.log('═'.repeat(60));
  console.log(`Batch complete. Summary of actions: `);
  console.log(`  docs uploaded: ${summaryData.uploaded}`);
  console.log(`  docs with errors: ${summaryData.errors}`);
  console.log('═'.repeat(60));
  console.log('');
}

async function processRow(
  isDryRun: boolean,
  useDefaultData: boolean,
  row: CsvRow,
  bucketName: string,
  oystehr: Oystehr,
  s3Client: S3Client | undefined
): Promise<void> {
  try {
    if (useDefaultData) {
      await formatDefaultDataAndUploadToZ3(isDryRun, row, bucketName, oystehr);
    } else {
      await getS3FileAndUploadToZ3(isDryRun, row, bucketName, oystehr, s3Client);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Failed to process row: ${JSON.stringify(row)}`);
    console.error(`    Error: ${message}\n`);

    summary.errors++;
    const { file, ...csvRow } = row;
    errorRows.push({ error: message, fileName: file, csvRow });
  }
}

function writeErrorCsv(rows: ErrorRow[]): void {
  const errorFileName = `errors-${Date.now()}.csv`;

  const headers = ['Error', 'File', ...Object.values(MAPPING_HEADERS)];

  writeCsvToLegacyDataOutput(
    errorFileName,
    headers,
    rows.map((r) => [r.error, r.fileName, ...Object.values(r.csvRow)])
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('Legacy EHR Data Import Script v2');
  console.log('═'.repeat(60));
  console.log(`Dry run: ${isDryRun}\n`);
  console.log(`Using default data: ${useDefaultData}\n`);
  console.log(`Mapping directory: ${mappingDir}\n`);

  // Verify data dir exists
  try {
    statSync(mappingDir);
  } catch {
    throw new Error(`Data directory not found: ${mappingDir}`);
  }

  const mappingCsvs = readdirSync(mappingDir).filter((f) => f.toLowerCase().endsWith('.csv'));
  console.log(`CSV mapping files to read:\n${mappingCsvs.map((f) => `  ${f}`).join('\n')}`);
  console.log('');

  const projectId = requireEnv('PROJECT_ID');
  const bucketName = `${projectId}-${LEGACY_DATA_BUCKET_SUFFIX}`;
  console.log(`Target bucket: ${bucketName}`);
  console.log('');

  const rows: CsvRow[] = [];
  let totalRowsRead = 0;

  console.time('Reading Csvs');
  console.log('Reading the csv mapping files');
  if (DOCUMENT_DESCRIPTIONS_TO_SKIP) {
    console.log(`Will not process documents with descriptions: ${DOCUMENT_DESCRIPTIONS_TO_SKIP.join(', ')}`);
  }
  console.log('');

  for (const file of mappingCsvs) {
    await new Promise<void>((resolve, reject) => {
      createReadStream(`${mappingDir}/${file}`)
        .pipe(parse({ columns: true }))
        .on('data', (data) => {
          totalRowsRead++;
          const description = stripDateFromDescription(data['Description']);
          if (DOCUMENT_DESCRIPTIONS_TO_SKIP === undefined) {
            rows.push(readCsvRow(data, file));
          } else if (!DOCUMENT_DESCRIPTIONS_TO_SKIP.includes(description)) {
            rows.push(readCsvRow(data, file));
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
  }

  console.log(`Total rows read: ${totalRowsRead}\n`);
  console.log(`Total rows to be processed: ${rows.length}\n`);

  console.timeEnd('Reading Csvs');

  if (MAX_ROWS !== undefined) {
    rows.splice(MAX_ROWS);
    console.log(`MAX_ROWS set — limiting migration to ${MAX_ROWS} rows.\n`);
  }

  if (rows.length === 0) {
    console.log('No rows to upload. Exiting.');
    return;
  }

  let sourceS3Client: S3Client | undefined;

  if (!useDefaultData) {
    console.log('\nMaking source S3 client...');
    sourceS3Client = await makeSourceS3Client();
    console.log('Done.');
  }

  // Create authenticated Oystehr client
  console.log('');
  console.log('Authenticating with Auth0...');
  const oystehr = await createOystehrClient();
  console.log('Authenticated.\n');

  console.time('Total Processing Time');

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    console.time('Batch Runtime');
    const batch = rows.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((row, _batchIdx) =>
        limit(async () => {
          // const idx = i + batchIdx;
          // console.log('processing row', idx);
          await processRow(isDryRun, useDefaultData, row, bucketName, oystehr, sourceS3Client);
          // console.log('done processing row', idx);
        })
      )
    );
    console.log(`\nBatch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(rows.length / BATCH_SIZE)} complete`);
    console.timeEnd('Batch Runtime');
    console.log('');
  }

  console.timeEnd('Total Processing Time');

  logSummary(summary);

  if (summary.errors > 0) {
    writeErrorCsv(errorRows);
    console.log('');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
