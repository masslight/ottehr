/**
 * Sync ALL project secrets from Oystehr into the local zambda server's secrets
 * file, so a local server pointed at a REMOTE env (e.g. development) has the exact
 * secret set the deployed zambdas use — including terraform-GENERATED values that
 * aren't in config/.env, most importantly ORGANIZATION_ID (the OTTEHR_ORGANIZATION
 * FHIR id). Without it, zambdas like change-in-person-visit-status 500 (their
 * audit log writes Organization/<ORGANIZATION_ID>).
 *
 * This is the runtime equivalent of `generate-local-env.ts` (which reads the same
 * values out of terraform state) — but it needs no terraform/AWS, just IAM read
 * access to the project secrets.
 *
 * Auth (needs IAM: App:ListAllSecrets / App:GetSecret): OYSTEHR_ACCESS_TOKEN →
 * OYSTEHR_ADMIN_CLIENT_ID/SECRET → default M2M (likely 403 without perms).
 *
 * Usage:
 *   OYSTEHR_ADMIN_CLIENT_ID=… OYSTEHR_ADMIN_CLIENT_SECRET=… \
 *     npx env-cmd -f packages/zambdas/.env/<env>.json \
 *     npx tsx scripts/synthetic-patient-data/sync-project-secrets.ts --env <env>
 */
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { arg, flag } from './shared/cli';
import { createOystehrFromToken, mintAccessToken, mintAccessTokenForClient, need } from './shared/oystehr-client';

const env = arg('--env');
const outArg = arg('--out'); // explicit target; defaults to the local-server secrets file for --env
const isDry = flag('--dry');

async function adminToken(): Promise<string> {
  if (process.env.OYSTEHR_ACCESS_TOKEN) return process.env.OYSTEHR_ACCESS_TOKEN;
  const id = process.env.OYSTEHR_ADMIN_CLIENT_ID;
  const secret = process.env.OYSTEHR_ADMIN_CLIENT_SECRET;
  if (id && secret) return mintAccessTokenForClient(id, secret);
  return mintAccessToken();
}

async function main(): Promise<void> {
  const outPath = outArg ?? (env ? `packages/zambdas/.env/zambda-secrets-${env}.json` : undefined);
  if (!outPath) throw new Error('Pass --env <env> (or --out <path>).');
  const out = resolve(outPath);

  const oystehr = createOystehrFromToken(await adminToken());
  console.log(`Project: ${need('PROJECT_ID')} — syncing project secrets → ${out}${isDry ? '  [DRY RUN]' : ''}`);

  const names = (await oystehr.secret.list()).map((s) => s.name);
  console.log(`Found ${names.length} project secret(s).`);
  if (isDry) return;

  // Fetch values at bounded concurrency (list returns names only).
  const secrets: Record<string, string> = {};
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < names.length) {
      const n = names[cursor++];
      secrets[n] = (await oystehr.secret.get({ name: n })).value;
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, names.length) }, () => worker()));

  writeFileSync(out, JSON.stringify(secrets, null, 2) + '\n', { mode: 0o600 });
  console.log(`Wrote ${Object.keys(secrets).length} secret(s) → ${out} (0600). Values never printed.`);
}

main().catch((e) => {
  console.error(e?.message ?? e);
  process.exit(1);
});
