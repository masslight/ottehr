/**
 * Thin CLI over ensureSynthM2MInProcess() (shared/synth-m2m.ts) for manual/local
 * use. Normally you don't run this directly — run-population and the daily census
 * provision the Practitioner-profile M2M in-process at startup (given admin creds).
 * Use this to provision it once by hand, or to capture the rotated creds (--out).
 *
 * Auth (admin, needs IAM): OYSTEHR_ACCESS_TOKEN → OYSTEHR_ADMIN_CLIENT_ID/SECRET.
 * The existing project M2M is never modified; a SEPARATE client is used.
 *
 * Usage:
 *   OYSTEHR_ADMIN_CLIENT_ID=… OYSTEHR_ADMIN_CLIENT_SECRET=… \
 *     npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-patient-data/ensure-synth-m2m.ts [--out creds.json] [--dry]
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { arg, flag } from './shared/cli';
import { need } from './shared/oystehr-client';
import { ensureSynthM2MInProcess } from './shared/synth-m2m';

const name = arg('--name', 'Synth Pipeline (manual)');
const practitionerId = arg('--practitioner-id');
const outPath = arg('--out'); // capture { AUTH0_CLIENT, AUTH0_SECRET } to a 0600 file
const isDry = flag('--dry');

async function main(): Promise<void> {
  console.log(`Project: ${need('PROJECT_ID')}${isDry ? '  [DRY RUN]' : ''}`);
  if (isDry) {
    console.log(`[DRY] would find-or-create M2M "${name}" with a Practitioner profile and rotate its secret.`);
    return;
  }
  const result = await ensureSynthM2MInProcess({ name, practitionerId });
  if (!result) {
    console.error('No admin creds — set OYSTEHR_ADMIN_CLIENT_ID/SECRET (or OYSTEHR_ACCESS_TOKEN).');
    process.exit(1);
  }
  if (outPath) {
    writeFileSync(
      resolve(outPath),
      JSON.stringify({ AUTH0_CLIENT: result.clientId, AUTH0_SECRET: result.secret }, null, 2) + '\n',
      { mode: 0o600 }
    );
    console.log(`Wrote synth M2M creds → ${resolve(outPath)} (0600). The secret is not retrievable again.`);
  } else {
    console.log(
      `Synth M2M ready: clientId=${result.clientId}, profile=${result.profile}. (Pass --out to capture the secret.)`
    );
  }
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
