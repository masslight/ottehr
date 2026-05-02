/**
 * copy-payer-organizations.ts — copy a small curated sample of payer
 * `Organization` resources (insurance carriers) from a source project
 * (typically demo) to a destination synth project.
 *
 * Real payer Organizations carry a Candid `XX` identifier (the payer-id) that
 * the intake harvest uses when building Coverage. The synth project's IaC
 * doesn't seed payer Orgs, so synthesis fails to create Coverage. Instead of
 * synthesizing a fake Org, we copy real ones from a working env so the harvest
 * code paths run unchanged.
 *
 * By default copies a small curated sample of national carriers (Aetna,
 * Cigna, BCBS, UnitedHealth, Humana, Kaiser). Use `--carrier <name>` to
 * narrow further or `--all` to copy every type=pay Organization (NOT
 * recommended — there are thousands).
 *
 * Dedup: matches by exact `Organization.name`. Already-present payers on
 * dest are skipped.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/synth.json \
 *     npx tsx scripts/synthetic-patient-data/copy-payer-organizations.ts \
 *     --source-env packages/zambdas/.env/demo.json \
 *     --dest-env  packages/zambdas/.env/synth.json \
 *     [--carrier "Blue Cross"] [--limit 10] [--all] [--execute]
 */
import Oystehr from '@oystehr/sdk';
import type { Organization } from 'fhir/r4b';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
function getFlag(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx === -1 ? undefined : args[idx + 1];
}

const sourceEnvPath = resolve(getFlag('--source-env') ?? '');
const destEnvPath = resolve(getFlag('--dest-env') ?? '');
const carrierFilter = getFlag('--carrier');
const limit = Number(getFlag('--limit') ?? '20');
const copyAll = args.includes('--all');
const isExecute = args.includes('--execute');

if (!sourceEnvPath || !destEnvPath) {
  console.error(
    'Usage: tsx copy-payer-organizations.ts --source-env <path> --dest-env <path> [--carrier <name>] [--limit N] [--all] [--execute]'
  );
  process.exit(1);
}

// Curated list of national carriers we'd want for a demo. The script searches
// for each by `name:contains` and copies the first match. Designed to give
// a recognizable sample without copying all 4000+ payer Orgs from demo.
const CURATED_CARRIERS = [
  'Aetna',
  'Blue Cross Blue Shield',
  'Cigna',
  'UnitedHealthcare',
  'Humana',
  'Kaiser',
  'Anthem',
  'Medicare',
  'Medicaid',
  'Tricare',
];

interface EnvConfig {
  AUTH0_ENDPOINT: string;
  AUTH0_CLIENT: string;
  AUTH0_SECRET: string;
  AUTH0_AUDIENCE: string;
  PROJECT_ID: string;
  PROJECT_API: string;
}

function loadEnv(path: string): EnvConfig {
  return JSON.parse(readFileSync(path, 'utf-8')) as EnvConfig;
}

async function createOystehr(env: EnvConfig, label: string): Promise<Oystehr> {
  const tokenRes = await fetch(env.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: env.AUTH0_CLIENT,
      client_secret: env.AUTH0_SECRET,
      audience: env.AUTH0_AUDIENCE,
    }),
  });
  if (!tokenRes.ok) throw new Error(`[${label}] Auth0 failed: ${tokenRes.status} ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  return new Oystehr({
    accessToken: access_token,
    projectId: env.PROJECT_ID,
    services: { projectApiUrl: env.PROJECT_API },
  });
}

async function searchPayerByName(oystehr: Oystehr, name: string, limitN = 5): Promise<Organization[]> {
  const result = await oystehr.fhir.search<Organization>({
    resourceType: 'Organization',
    params: [
      { name: 'name:contains', value: name },
      { name: 'type', value: 'http://terminology.hl7.org/CodeSystem/organization-type|pay' },
      { name: '_count', value: String(limitN) },
    ],
  });
  return result.unbundle();
}

async function main(): Promise<void> {
  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Source: ${sourceEnvPath}`);
  console.log(`Dest:   ${destEnvPath}`);

  const sourceEnv = loadEnv(sourceEnvPath);
  const destEnv = loadEnv(destEnvPath);
  if (sourceEnv.PROJECT_ID === destEnv.PROJECT_ID) throw new Error('Source and dest are the same project');

  console.log('Authenticating...');
  const [source, dest] = await Promise.all([createOystehr(sourceEnv, 'source'), createOystehr(destEnv, 'dest')]);

  // Build the candidate set from source.
  const candidates: Organization[] = [];
  if (copyAll) {
    console.log('--all set — copying every type=pay Organization from source (this may take a while)');
    let next: string | undefined;
    do {
      const result = await source.fhir.search<Organization>({
        resourceType: 'Organization',
        params: [
          { name: 'type', value: 'http://terminology.hl7.org/CodeSystem/organization-type|pay' },
          { name: '_count', value: '500' },
        ],
      });
      candidates.push(...result.unbundle());
      const linkNext = (result as any).link?.find?.((l: { relation: string; url: string }) => l.relation === 'next');
      next = linkNext?.url;
      if (next) console.log(`  fetched ${candidates.length} so far, paginating...`);
    } while (next && candidates.length < 5000);
  } else if (carrierFilter) {
    const found = await searchPayerByName(source, carrierFilter, limit);
    candidates.push(...found);
    console.log(`Source matches for "${carrierFilter}": ${found.length}`);
  } else {
    for (const term of CURATED_CARRIERS) {
      const found = await searchPayerByName(source, term, 1);
      if (found.length) {
        candidates.push(found[0]);
        console.log(`  + "${term}" → "${found[0].name}" (Organization/${found[0].id})`);
      } else {
        console.log(`  - "${term}" not found in source`);
      }
    }
  }

  if (candidates.length === 0) {
    console.log('Nothing to copy.');
    return;
  }

  // Existing dest payer names so we can dedup.
  const destExisting = await dest.fhir.search<Organization>({
    resourceType: 'Organization',
    params: [
      { name: 'type', value: 'http://terminology.hl7.org/CodeSystem/organization-type|pay' },
      { name: '_count', value: '500' },
    ],
  });
  const destNames = new Set(
    destExisting
      .unbundle()
      .map((o) => o.name)
      .filter((n): n is string => !!n)
  );
  console.log(`\nDest already has ${destNames.size} payer Organizations`);

  let toCopy = 0;
  let toSkip = 0;
  for (const o of candidates) {
    if (o.name && destNames.has(o.name)) toSkip += 1;
    else toCopy += 1;
  }
  console.log(`Will copy: ${toCopy}, skip (already present): ${toSkip}`);

  if (!isExecute) {
    console.log('Dry-run only. Re-run with --execute.');
    return;
  }

  let copied = 0;
  let failed = 0;
  for (const o of candidates) {
    if (o.name && destNames.has(o.name)) continue;
    const { id, meta, ...rest } = o;
    void id;
    void meta;
    const newOrg: Organization = { ...(rest as Organization) };
    try {
      const created = await dest.fhir.create<Organization>(newOrg);
      console.log(`  ✓ "${o.name}" → ${created.id}`);
      copied += 1;
    } catch (err) {
      console.warn(`  ✗ "${o.name}": ${err instanceof Error ? err.message : err}`);
      failed += 1;
    }
  }

  console.log('');
  console.log(`-- summary --`);
  console.log(`Copied: ${copied}`);
  console.log(`Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
