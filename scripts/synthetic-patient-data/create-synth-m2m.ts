/**
 * Create a new M2M client on the target Oystehr project for use by the synth pipeline.
 *
 * Why this exists: save-chart-data (and a few other EHR zambdas) call oystehr.m2m.me()
 * to look up the caller's profile, then load that profile as a Practitioner. If the
 * M2M's profile is `Device/...` (the default for newly-created M2M clients), the lookup
 * fails with a 404. This script creates a new M2M whose profile is `Practitioner/<id>`,
 * copying the access policy from a reference M2M so the new one can do everything the
 * synth pipeline needs.
 *
 * Usage:
 *   npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-patient-data/create-synth-m2m.ts \
 *     --reference-m2m-name "Example M2M Client" \
 *     --practitioner-id <id> \
 *     --name "Synth Pipeline (dabrams)" \
 *     --description "Used by the synth pipeline to create realistic test visits" \
 *     --execute
 *
 * Without --execute, the script prints the plan and exits.
 */
import type { M2m } from '@oystehr/sdk';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { arg, flag } from './shared/cli';
import { createOystehrFromEnv, need } from './shared/oystehr-client';

const referenceName = arg('--reference-m2m-name');
const practitionerId = arg('--practitioner-id');
const newName = arg('--name');
const newDescription = arg('--description') ?? 'Created by create-synth-m2m.ts for use by the synth pipeline.';
const isExecute = flag('--execute');

if (!referenceName || !practitionerId || !newName) {
  console.error(
    'Usage: tsx create-synth-m2m.ts --reference-m2m-name <name> --practitioner-id <id> --name <name> [--description <desc>] [--execute]'
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const oystehr = await createOystehrFromEnv();

  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Project: ${need('PROJECT_ID')}`);

  // Verify the practitioner exists and is active
  console.log(`\nVerifying Practitioner/${practitionerId}...`);
  const prac = await oystehr.fhir.get<any>({ resourceType: 'Practitioner', id: practitionerId! });
  const name = prac.name?.[0];
  const display = name ? `${name.given?.join(' ') ?? ''} ${name.family ?? ''}`.trim() : '(no name)';
  console.log(`  ✓ ${prac.id}  "${display}"  active=${prac.active}`);

  // Find the reference M2M and copy its accessPolicy
  console.log(`\nLooking up reference M2M client "${referenceName}"...`);
  const all = await oystehr.m2m.list();
  const ref = (all as M2m[]).find((m) => m.name === referenceName);
  if (!ref) throw new Error(`No M2M client named "${referenceName}" found on this project.`);
  console.log(`  ✓ id=${ref.id}  profile=${ref.profile}  has accessPolicy=${!!ref.accessPolicy}`);
  if (!ref.accessPolicy) throw new Error(`Reference M2M "${referenceName}" has no accessPolicy to copy.`);

  if (!isExecute) {
    console.log(`\n[DRY RUN] Would create M2M:`);
    console.log(`  name: "${newName}"`);
    console.log(`  description: "${newDescription}"`);
    console.log(`  profile: "Practitioner/${practitionerId}"`);
    console.log(`  accessPolicy: <copied from "${referenceName}">`);
    console.log(
      `\nPass --execute to create. After creation, the script rotates the secret and writes it to a 0600 temp file (one-time; the path is printed, the secret is not).`
    );
    return;
  }

  console.log(`\nCreating new M2M "${newName}"...`);
  const created = await oystehr.m2m.create({
    name: newName!,
    description: newDescription,
    profile: `Practitioner/${practitionerId}`,
    accessPolicy: ref.accessPolicy,
  });
  console.log(`  ✓ created id=${created.id}  clientId=${created.clientId}`);
  console.log(`  ✓ profile=${created.profile}`);

  console.log(`\nRotating secret to obtain the client secret...`);
  const { secret } = await oystehr.m2m.rotateSecret({ id: created.id });
  // Never print the secret to stdout — this script often runs under a `tee`'d
  // wrapper and the secret would land in a log file. Write it to a 0600 temp
  // file instead and print only the path.
  const secretDir = mkdtempSync(join(tmpdir(), 'synth-m2m-'));
  const secretPath = join(secretDir, 'm2m-credentials.json');
  writeFileSync(secretPath, JSON.stringify({ AUTH0_CLIENT: created.clientId, AUTH0_SECRET: secret }, null, 2) + '\n', {
    mode: 0o600,
  });
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`Client secret rotated — it will not be retrievable again.`);
  console.log(`  AUTH0_CLIENT = ${created.clientId}`);
  console.log(`  AUTH0_SECRET written to (owner-only 0600, NOT printed here):`);
  console.log(`    ${secretPath}`);
  console.log(`────────────────────────────────────────────────────────────`);
  console.log(
    `\nNext: copy the values from that file into both packages/zambdas/.env/<env>.json and packages/zambdas/.env/zambda-secrets-<env>.json, restart the zambda server, then delete the temp file.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
