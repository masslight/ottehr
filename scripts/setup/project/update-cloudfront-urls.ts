/**
 * Reads CloudFront distribution IDs from setup-progress.json,
 * fetches their domain names via AWS CLI, and updates WEBSITE_URL /
 * PATIENT_* / PROVIDER_* variables in config/.env/{env}.json.
 *
 * Usage:
 *   tsx update-cloudfront-urls.ts [local|staging|production] [--dry-run]
 *   tsx update-cloudfront-urls.ts --dry-run    # preview all envs, no writes
 *   tsx update-cloudfront-urls.ts staging      # update staging only
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ENV_MAP, ProjectEnv } from './create-project';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROGRESS_FILE = resolve(__dirname, 'setup-progress.json');
const OTTEHR_ROOT = resolve(__dirname, '../../../');

interface DistributionIds {
  patientPortal?: string;
  ehr?: string;
}

interface EnvProgress {
  distributionIds?: DistributionIds;
  [key: string]: unknown;
}

function getCloudfrontDomain(distributionId: string): string {
  const output = execSync(
    `aws cloudfront get-distribution --id ${distributionId} --query 'Distribution.DomainName' --output text`,
    { encoding: 'utf8' }
  ).trim();
  if (!output || output === 'None') {
    throw new Error(`Could not get domain for distribution ${distributionId}`);
  }
  return output;
}

function replaceHost(existingUrl: string | undefined, newHost: string): string {
  if (!existingUrl) return `https://${newHost}`;
  try {
    const u = new URL(existingUrl);
    u.host = newHost;
    return u.toString();
  } catch {
    return `https://${newHost}`;
  }
}

const URL_KEYS = [
  'WEBSITE_URL',
  'PATIENT_LOGIN_REDIRECT_URL',
  'PATIENT_ALLOWED_URL_1',
  'PATIENT_ALLOWED_URL_2',
  'PATIENT_ALLOWED_URL_3',
  'PATIENT_ALLOWED_URL_4',
  'PROVIDER_LOGIN_REDIRECT_URL',
  'PROVIDER_ALLOWED_URL_1',
  'PROVIDER_ALLOWED_URL_2',
  'PROVIDER_ALLOWED_URL_3',
  'PROVIDER_ALLOWED_URL_4',
] as const;

type UrlKey = (typeof URL_KEYS)[number];

function isPatientKey(key: UrlKey): boolean {
  return key === 'WEBSITE_URL' || key.startsWith('PATIENT_');
}

async function updateEnv(env: ProjectEnv, ids: DistributionIds, dryRun: boolean): Promise<void> {
  console.log(`\n--- ${dryRun ? '[DRY RUN] ' : ''}${env.toUpperCase()} ---`);

  let patientDomain: string | undefined;
  let ehrDomain: string | undefined;

  if (ids.patientPortal) {
    console.log(`Fetching domain for patient portal distribution ${ids.patientPortal}...`);
    patientDomain = getCloudfrontDomain(ids.patientPortal);
    console.log(`  Patient portal domain: ${patientDomain}`);
  }

  if (ids.ehr) {
    console.log(`Fetching domain for EHR distribution ${ids.ehr}...`);
    ehrDomain = getCloudfrontDomain(ids.ehr);
    console.log(`  EHR domain: ${ehrDomain}`);
  }

  const configPath = resolve(OTTEHR_ROOT, 'config/.env', ENV_MAP[env].zambdaEnv);
  const cfg = JSON.parse(readFileSync(configPath, 'utf8'));

  const changes: { key: string; from: string; to: string }[] = [];

  for (const key of URL_KEYS) {
    if (!(key in cfg)) continue;
    const newHost = isPatientKey(key) ? patientDomain : ehrDomain;
    if (!newHost) continue;
    const newValue = replaceHost(cfg[key], newHost);
    if (newValue !== cfg[key]) {
      changes.push({ key, from: cfg[key], to: newValue });
      cfg[key] = newValue;
    }
  }

  if (changes.length === 0) {
    console.log('  No changes.');
    return;
  }

  console.log(`  ${dryRun ? 'Would change' : 'Changed'} ${changes.length} value(s):`);
  for (const { key, from, to } of changes) {
    console.log(`    ${key}:`);
    console.log(`      - ${from}`);
    console.log(`      + ${to}`);
  }

  if (!dryRun) {
    writeFileSync(configPath, JSON.stringify(cfg, null, 2) + '\n');
    console.log(`  Written to ${configPath}`);
  }
}

async function main(): Promise<void> {
  if (!existsSync(PROGRESS_FILE)) {
    console.error(`ERROR: ${PROGRESS_FILE} not found. Run setup:all-envs first.`);
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const envArg = args.find((a) => !a.startsWith('--')) as ProjectEnv | undefined;

  const allEnvs: ProjectEnv[] = ['local', 'staging', 'production'];
  const envs = envArg ? [envArg] : allEnvs;

  if (dryRun) console.log('DRY RUN — no files will be written.\n');

  const progress = JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')) as Record<string, EnvProgress>;

  for (const env of envs) {
    const ids = progress[env]?.distributionIds;
    if (!ids?.patientPortal && !ids?.ehr) {
      console.log(`[SKIP] No distribution IDs saved for ${env}.`);
      continue;
    }
    await updateEnv(env, ids, dryRun);
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
