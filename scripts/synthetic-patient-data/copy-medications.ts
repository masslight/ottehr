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
import type { Medication } from 'fhir/r4b';
import { resolve } from 'path';
import { arg, argAll, flag } from './shared/cli';
import { createOystehrFromEnvFile, loadEnvFile } from './shared/oystehr-client';

const sourceEnvPath = resolve(arg('--source-env') ?? '');
const destEnvPath = resolve(arg('--dest-env') ?? '');
const isExecute = flag('--execute');
const alsoCreate = argAll('--also-create');

if (!sourceEnvPath || !destEnvPath) {
  console.error('Usage: tsx copy-medications.ts --source-env <path> --dest-env <path> [--execute]');
  process.exit(1);
}

const NAME_IDENTIFIER_SYSTEM = 'virtual-medication-identifier-name-system';

function nameOf(m: Medication): string | undefined {
  return m.identifier?.find((i) => i.system === NAME_IDENTIFIER_SYSTEM)?.value;
}

async function main(): Promise<void> {
  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Source: ${sourceEnvPath}`);
  console.log(`Dest:   ${destEnvPath}`);

  const sourceEnv = loadEnvFile(sourceEnvPath);
  const destEnv = loadEnvFile(destEnvPath);
  if (sourceEnv.PROJECT_ID === destEnv.PROJECT_ID) throw new Error('Source and dest are the same project');
  console.log(`Source PROJECT_ID: ${sourceEnv.PROJECT_ID}`);
  console.log(`Dest PROJECT_ID:   ${destEnv.PROJECT_ID}`);

  console.log('Authenticating...');
  const [{ oystehr: source }, { oystehr: dest }] = await Promise.all([
    createOystehrFromEnvFile(sourceEnvPath, 'source'),
    createOystehrFromEnvFile(destEnvPath, 'dest'),
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
