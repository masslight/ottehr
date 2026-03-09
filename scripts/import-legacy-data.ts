/**
 * Import script to upload legacy EHR data into the Z3 'legacy-data' bucket.
 *
 * Files are stored under keys structured as:
 *   {lastName}_{firstName}_{dob}/{patientId}/{relative/subpath}
 *
 * This key structure enables prefix-based search by patient name and DOB.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/{ENV}.json \
 *   npx tsx local/core/scripts/import-legacy-data.ts [--dry-run] [--data-dir <path>]
 *
 * Example:
 *   npx env-cmd -f packages/zambdas/.env/local.json tsx local/core/scripts/import-legacy-data.ts --dry-run
 *
 * The env file must contain: AUTH0_CLIENT, AUTH0_SECRET, AUTH0_ENDPOINT, AUTH0_AUDIENCE,
 * PROJECT_ID, PROJECT_API. The zambdas .env files already include all of these.
 *
 * Optional flags:
 *   --dry-run   Print what would be uploaded without actually uploading
 *   --data-dir  Path to the Patient_Export directory (defaults to the sample-legacy-export folder)
 */

import Oystehr from '@oystehr/sdk';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LEGACY_DATA_BUCKET_SUFFIX = 'legacy-data';

// ── Argument parsing ──────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');

const dataDirFlagIdx = args.indexOf('--data-dir');
const defaultDataDir = join(__dirname, '..', 'sample-legacy-export', 'Patient_Export');
const dataDir = dataDirFlagIdx !== -1 && args[dataDirFlagIdx + 1] ? args[dataDirFlagIdx + 1] : defaultDataDir;

// ── Environment validation ────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return val;
}

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

// ── File walking ──────────────────────────────────────────────────────────────

interface FileToUpload {
  absolutePath: string;
  objectPath: string; // The Z3 key
  fileName: string;
}

/**
 * Parse a patient folder name of the form: {PatientID}_{LastName}_{FirstName}_{DOB}
 * Returns the Z3 prefix: {lastName}_{firstName}_{dob}/{patientId}
 */
function parseFolderName(folderName: string): { z3Prefix: string; patientId: string } | null {
  // Expected format: 1234567_Smith_Jane_05-11-2022
  const parts = folderName.split('_');
  if (parts.length < 4) {
    console.warn(`  Skipping unrecognised folder format: ${folderName}`);
    return null;
  }

  const patientId = parts[0];
  const lastName = parts[1].toLowerCase();
  const firstName = parts[2].toLowerCase();
  // DOB is everything after the first 3 underscore-separated parts
  const dob = parts.slice(3).join('-');

  const z3Prefix = `${lastName}_${firstName}_${dob}/${patientId}`;
  return { z3Prefix, patientId };
}

/**
 * Recursively collect all files under a directory.
 */
function collectFiles(baseDir: string, currentDir: string, z3Prefix: string): FileToUpload[] {
  const results: FileToUpload[] = [];
  const entries = readdirSync(currentDir);

  for (const entry of entries) {
    const fullPath = join(currentDir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...collectFiles(baseDir, fullPath, z3Prefix));
    } else if (entry.toLowerCase().endsWith('.html')) {
      const relativePath = relative(baseDir, fullPath).replace(/\\/g, '/');
      const objectPath = `${z3Prefix}/${relativePath}`;
      results.push({ absolutePath: fullPath, objectPath, fileName: entry });
    }
  }

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Legacy EHR Data Import Script');
  console.log('═'.repeat(60));
  console.log(`Data directory: ${dataDir}`);
  console.log(`Dry run: ${isDryRun}`);
  console.log('');

  // Verify data dir exists
  try {
    statSync(dataDir);
  } catch {
    throw new Error(`Data directory not found: ${dataDir}`);
  }

  const projectId = requireEnv('PROJECT_ID');
  const bucketName = `${projectId}-${LEGACY_DATA_BUCKET_SUFFIX}`;
  console.log(`Target bucket: ${bucketName}`);
  console.log('');

  // Collect all files to upload
  const allFiles: FileToUpload[] = [];
  const patientFolders = readdirSync(dataDir);

  for (const folderName of patientFolders) {
    const folderPath = join(dataDir, folderName);
    const stat = statSync(folderPath);
    if (!stat.isDirectory()) continue;

    console.log(`Processing patient folder: ${folderName}`);

    const parsed = parseFolderName(folderName);
    if (!parsed) continue;

    const { z3Prefix } = parsed;
    console.log(`  Z3 prefix: ${z3Prefix}/`);

    const files = collectFiles(folderPath, folderPath, z3Prefix);
    console.log(`  Found ${files.length} file(s)`);
    for (const f of files) {
      console.log(`    → ${f.objectPath}`);
    }
    allFiles.push(...files);
  }

  console.log('');
  console.log(`Total files to upload: ${allFiles.length}`);

  if (isDryRun) {
    console.log('');
    console.log('Dry run — no files uploaded.');
    return;
  }

  if (allFiles.length === 0) {
    console.log('No files found to upload. Exiting.');
    return;
  }

  // Create authenticated Oystehr client
  console.log('');
  console.log('Authenticating with Auth0...');
  const oystehr = await createOystehrClient();
  console.log('Authenticated.');
  console.log('');

  // Upload files
  let uploaded = 0;
  let failed = 0;

  for (const file of allFiles) {
    try {
      const fileBuffer = readFileSync(file.absolutePath);
      const mimeType = file.fileName.endsWith('.html') ? 'text/html' : 'application/octet-stream';
      const blob = new Blob([new Uint8Array(fileBuffer)], { type: mimeType });

      await oystehr.z3.uploadFile({
        bucketName,
        'objectPath+': file.objectPath,
        file: blob,
      });

      console.log(`  ✓ Uploaded: ${file.objectPath}`);
      uploaded++;
    } catch (err) {
      console.error(`  ✗ Failed:   ${file.objectPath}`);
      console.error(`    Error: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log('');
  console.log('═'.repeat(60));
  console.log(`Upload complete. Uploaded: ${uploaded}, Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
