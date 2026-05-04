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
import Oystehr from '@oystehr/sdk';

function getFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const referenceName = getFlag('--reference-m2m-name');
const practitionerId = getFlag('--practitioner-id');
const newName = getFlag('--name');
const newDescription = getFlag('--description') ?? 'Created by create-synth-m2m.ts for use by the synth pipeline.';
const isExecute = process.argv.includes('--execute');

if (!referenceName || !practitionerId || !newName) {
  console.error(
    'Usage: tsx create-synth-m2m.ts --reference-m2m-name <name> --practitioner-id <id> --name <name> [--description <desc>] [--execute]'
  );
  process.exit(1);
}

async function mintToken(): Promise<string> {
  const res = await fetch(process.env.AUTH0_ENDPOINT!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.AUTH0_CLIENT,
      client_secret: process.env.AUTH0_SECRET,
      audience: process.env.AUTH0_AUDIENCE,
      grant_type: 'client_credentials',
    }),
  });
  if (!res.ok) throw new Error(`Failed to mint token: ${res.status} ${await res.text()}`);
  const { access_token } = (await res.json()) as { access_token: string };
  return access_token;
}

async function main(): Promise<void> {
  const accessToken = await mintToken();
  const oystehr = new Oystehr({
    accessToken,
    projectId: process.env.PROJECT_ID!,
    services: { projectApiUrl: process.env.PROJECT_API! },
  });

  console.log(`Mode: ${isExecute ? 'EXECUTE' : 'DRY RUN'}`);
  console.log(`Project: ${process.env.PROJECT_ID}`);

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
      `\nPass --execute to create. After creation, the script will rotate-secret to print the client_secret (one-time).`
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
  console.log(`\n────────────────────────────────────────────────────────────`);
  console.log(`SAVE THESE — the client secret will not be retrievable again:`);
  console.log(`  AUTH0_CLIENT = ${created.clientId}`);
  console.log(`  AUTH0_SECRET = ${secret}`);
  console.log(`────────────────────────────────────────────────────────────`);
  console.log(
    `\nNext: update both packages/zambdas/.env/<env>.json and packages/zambdas/.env/zambda-secrets-<env>.json with these values, then restart the zambda server.`
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
