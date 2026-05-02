/**
 * copy-medications.ts — copy in-house medication catalog from one Oystehr
 * project to another, deduplicating by identifier value (the medication name).
 *
 * Looks for `Medication` resources whose `identifier[].system` includes
 * `virtual-medication-identifier-name-system` (Ottehr's in-house formulary
 * convention). Any source medication whose name doesn't already exist on the
 * destination gets copied. Source duplicates are collapsed to one entry per
 * name; first-seen wins.
 *
 * Usage:
 *   npx tsx scripts/synthetic-patient-data/copy-medications.ts \
 *     --source-env packages/zambdas/.env/demo.json \
 *     --dest-env packages/zambdas/.env/synth.json \
 *     [--execute] [--also-create '<name>=<type>=<route>=<dose>=<units>']
 *
 * Defaults to dry-run. Use `--execute` to actually write.
 *
 * `--also-create` adds an extra medication if not already present, e.g.:
 *   --also-create 'Ibuprofen 200mg Tablet PO=tablet=PO=200=mg'
 */
import Oystehr from '@oystehr/sdk';
import type { Medication } from 'fhir/r4b';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
function getFlag(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx === -1 ? undefined : args[idx + 1];
}
function getAllFlag(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) if (args[i] === name && args[i + 1]) out.push(args[i + 1]);
  return out;
}

const sourceEnvPath = resolve(getFlag('--source-env') ?? '');
const destEnvPath = resolve(getFlag('--dest-env') ?? '');
const isExecute = args.includes('--execute');
const alsoCreate = getAllFlag('--also-create');

if (!sourceEnvPath || !destEnvPath) {
  console.error('Usage: tsx copy-medications.ts --source-env <path> --dest-env <path> [--execute]');
  process.exit(1);
}

const NAME_IDENTIFIER_SYSTEM = 'virtual-medication-identifier-name-system';

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

async function createOystehrFromEnv(env: EnvConfig, label: string): Promise<Oystehr> {
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
  if (!tokenRes.ok) throw new Error(`[${label}] Oystehr IAM auth failed: ${tokenRes.status} ${await tokenRes.text()}`);
  const { access_token } = (await tokenRes.json()) as { access_token: string };
  return new Oystehr({
    accessToken: access_token,
    projectId: env.PROJECT_ID,
    services: { projectApiUrl: env.PROJECT_API },
  });
}

function nameOf(m: Medication): string | undefined {
  return m.identifier?.find((i) => i.system === NAME_IDENTIFIER_SYSTEM)?.value;
}

async function main(): Promise<void> {
  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Source: ${sourceEnvPath}`);
  console.log(`Dest:   ${destEnvPath}`);

  const sourceEnv = loadEnv(sourceEnvPath);
  const destEnv = loadEnv(destEnvPath);
  if (sourceEnv.PROJECT_ID === destEnv.PROJECT_ID) throw new Error('Source and dest are the same project');
  console.log(`Source PROJECT_ID: ${sourceEnv.PROJECT_ID}`);
  console.log(`Dest PROJECT_ID:   ${destEnv.PROJECT_ID}`);

  console.log('Authenticating...');
  const [source, dest] = await Promise.all([
    createOystehrFromEnv(sourceEnv, 'source'),
    createOystehrFromEnv(destEnv, 'dest'),
  ]);

  // Source medications
  const sourceAll = (
    await source.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [{ name: '_count', value: '500' }],
    })
  ).unbundle();
  console.log(`Source has ${sourceAll.length} Medications`);

  // Collapse to unique by name (first-seen wins). Skip ones without a name identifier.
  const uniqueByName = new Map<string, Medication>();
  for (const m of sourceAll) {
    const n = nameOf(m);
    if (!n || uniqueByName.has(n)) continue;
    uniqueByName.set(n, m);
  }
  console.log(`Unique by name: ${uniqueByName.size}`);

  // Dest medications (so we can skip already-present)
  const destAll = (
    await dest.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [{ name: '_count', value: '500' }],
    })
  ).unbundle();
  const destNames = new Set(destAll.map((m) => nameOf(m)).filter((v): v is string => !!v));
  console.log(`Dest already has ${destNames.size} named Medications`);

  // Also-create entries
  for (const spec of alsoCreate) {
    const [name, type, route, dose, units] = spec.split('=');
    if (!name) continue;
    if (uniqueByName.has(name)) continue;
    const synthetic: Medication = {
      resourceType: 'Medication',
      identifier: [
        { system: NAME_IDENTIFIER_SYSTEM, value: name },
        ...(type ? [{ system: 'virtual-medication-type', value: type }] : []),
      ],
      code: { text: name, coding: [{ system: 'http://snomed.info/sct', code: 'todo', display: name }] },
      ...(route || dose || units
        ? {
            extension: [
              ...(route ? [{ url: 'route', valueString: route }] : []),
              ...(dose ? [{ url: 'dose', valueString: dose }] : []),
              ...(units ? [{ url: 'units', valueString: units }] : []),
            ],
          }
        : {}),
    };
    uniqueByName.set(name, synthetic);
  }

  // Plan
  let toCopy = 0;
  let toSkip = 0;
  for (const [name] of uniqueByName) {
    if (destNames.has(name)) toSkip += 1;
    else toCopy += 1;
  }
  console.log('');
  console.log(`Will copy: ${toCopy}, skip (already present): ${toSkip}`);

  if (!isExecute) {
    console.log('Dry-run only. Re-run with --execute.');
    for (const [name] of uniqueByName) {
      if (!destNames.has(name)) console.log(`  +  ${name}`);
    }
    return;
  }

  // Execute
  let copied = 0;
  let failed = 0;
  for (const [name, m] of uniqueByName) {
    if (destNames.has(name)) continue;
    const { id, meta, ...rest } = m;
    void id;
    void meta;
    const newMed: Medication = { ...(rest as Medication) };
    try {
      const created = await dest.fhir.create<Medication>(newMed);
      console.log(`  ✓ ${name} → ${created.id}`);
      copied += 1;
    } catch (err) {
      console.warn(`  ✗ ${name}: ${err instanceof Error ? err.message : err}`);
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
