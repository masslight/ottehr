/**
 * One-time migration script: adds a friendly patient identifier to all Patient resources
 * that do not yet have one.
 *
 * Usage:
 *   npx tsx scripts/add-friendly-patient-identifiers.ts <env> [--patient <id>]
 *
 *   <env>              corresponds to a config file at packages/zambdas/.env/<env>.json
 *   --patient <id>     process a single patient by FHIR id instead of all patients
 *
 * Required env vars (from the config file or already set in process environment):
 *   AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE
 *   FHIR_API, PROJECT_API, PROJECT_ID
 *
 * Optional:
 *   DRY_RUN=true  — list patients that would be processed without making any changes
 *
 * Examples:
 *   npx tsx scripts/add-friendly-patient-identifiers.ts local
 *   npx tsx scripts/add-friendly-patient-identifiers.ts local --patient abc123
 *   DRY_RUN=true npx tsx scripts/add-friendly-patient-identifiers.ts testing
 */

import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';

const PAGE_SIZE = 200;
const FRIENDLY_PATIENT_ID_SYSTEM_BASE = 'https://identifiers.fhir.oystehr.com/friendly-patient-id';

function loadEnvFile(envName: string): void {
  const filePath = path.resolve(process.cwd(), 'packages/zambdas/.env', `${envName}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `Environment file not found: ${filePath}\nExpected a JSON file at packages/zambdas/.env/<env>.json`
    );
  }
  const config = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as Record<string, string>;
  for (const [key, value] of Object.entries(config)) {
    if (process.env[key] === undefined) {
      process.env[key] = String(value);
    }
  }
  console.log(`Loaded environment from: ${filePath}`);
}

async function getAuthToken(): Promise<string> {
  const { AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = process.env;
  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
    throw new Error('Missing auth env vars: AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE');
  }

  const response = await fetch(AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: AUTH0_CLIENT,
      client_secret: AUTH0_SECRET,
      audience: AUTH0_AUDIENCE,
    }),
  });

  if (!response.ok) {
    throw new Error(`Auth failed: HTTP ${response.status}`);
  }

  return (await response.json()).access_token;
}

async function generateForPatient(
  oystehr: Oystehr,
  patientId: string,
  isDryRun: boolean
): Promise<{ updated: number; errorCount: number }> {
  if (isDryRun) {
    console.log(`  WOULD GENERATE: Patient/${patientId}`);
    return { updated: 1, errorCount: 0 };
  }

  try {
    await oystehr.fhir.generateFriendlyPatientId({ id: patientId });
    console.log(`  GENERATED: Patient/${patientId}`);
    return { updated: 1, errorCount: 0 };
  } catch (error) {
    if (error instanceof Oystehr.OystehrFHIRError) {
      if (error.code === 404) {
        console.error(`  NOT FOUND (404): Patient/${patientId} — patient does not exist`);
      } else if (error.code === 422) {
        console.error(`  ALREADY HAS FRIENDLY ID (422): Patient/${patientId} — skipping`);
      } else {
        console.error(`  ERROR (${error.code}): Patient/${patientId} — ${error.message}`);
      }
    } else {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`  ERROR: Patient/${patientId} — ${message}`);
    }
    return { updated: 0, errorCount: 1 };
  }
}

async function migrate(): Promise<void> {
  const args = process.argv.slice(2);

  const envArg = args[0] && !args[0].startsWith('--') ? args[0] : undefined;
  if (envArg) {
    loadEnvFile(envArg);
  }

  const patientFlagIdx = args.indexOf('--patient');
  const singlePatientId = patientFlagIdx !== -1 ? args[patientFlagIdx + 1] : undefined;
  if (patientFlagIdx !== -1 && !singlePatientId) {
    throw new Error('--patient flag requires a patient id argument');
  }

  const { FHIR_API, PROJECT_API, PROJECT_ID } = process.env;

  if (!PROJECT_ID) {
    throw new Error('Missing required env var: PROJECT_ID');
  }

  const isDryRun = process.env.DRY_RUN === 'true';
  const friendlyIdSystem = `${FRIENDLY_PATIENT_ID_SYSTEM_BASE}/${PROJECT_ID}`;

  console.log('=== Add Friendly Patient Identifier Migration ===');
  console.log(`Mode:              ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE'}`);
  console.log(`Project ID:        ${PROJECT_ID}`);
  console.log(`Identifier system: ${friendlyIdSystem}`);
  if (singlePatientId) {
    console.log(`Target patient:    ${singlePatientId}`);
  }
  console.log();

  console.log('Authenticating...');
  const token = await getAuthToken();
  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: FHIR_API,
    projectApiUrl: PROJECT_API,
  });
  console.log('Authenticated successfully.');
  console.log();

  let processed = 0;
  let updated = 0;
  let skipped = 0;
  let errorCount = 0;

  if (singlePatientId) {
    processed = 1;
    const result = await generateForPatient(oystehr, singlePatientId, isDryRun);
    updated = result.updated;
    errorCount = result.errorCount;
  } else {
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const page = await oystehr.fhir.search<Patient>({
        resourceType: 'Patient',
        params: [
          { name: '_count', value: PAGE_SIZE },
          { name: '_offset', value: offset },
          { name: '_total', value: 'accurate' },
          { name: 'identifier:not', value: `${friendlyIdSystem}|` },
        ],
      });
      const patients = page.unbundle();
      const total = page.total ?? '?';

      console.log(`Fetched ${patients.length} patients (offset=${offset}, total without friendly ID=${total})`);

      for (const patient of patients) {
        processed++;

        if (!patient.id) {
          console.warn('  SKIP: patient has no id');
          skipped++;
          continue;
        }

        const result = await generateForPatient(oystehr, patient.id, isDryRun);
        updated += result.updated;
        errorCount += result.errorCount;
      }

      if (patients.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        offset += PAGE_SIZE;
      }
    }
  }

  console.log();
  console.log('=== Migration Complete ===');
  console.log(`  Processed: ${processed}`);
  console.log(`  Updated:   ${updated}`);
  console.log(`  Skipped:   ${skipped}`);
  console.log(`  Errors:    ${errorCount}`);

  if (isDryRun) {
    console.log();
    console.log('This was a dry run. To apply changes, run without DRY_RUN=true.');
  }
}

migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
