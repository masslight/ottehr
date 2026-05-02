/**
 * create-demo-user.ts — provision a demo Administrator user on an Oystehr project.
 *
 * Pattern adapted from the Ottehr local-setup guide. Authenticates via M2M,
 * locates the EHR Application by name, enables email-login on it, invites the
 * user with the Administrator role, then sets a known password directly via
 * `oystehr.user.changePassword`. Idempotent — if the user already exists, only
 * the password is updated.
 *
 * Usage:
 *   npx tsx scripts/synthetic-patient-data/create-demo-user.ts \
 *     --env-file packages/zambdas/.env/synth.json
 *
 * Optional flags:
 *   --email <email>        default: demo@ottehr.com
 *   --password <password>  default: Oystehr1!
 *   --first <name>         default: Demo
 *   --last <name>          default: Admin
 *   --app-name <name>      EHR application name to look up; default: tries
 *                          OTTEHR_EHR, then EHR, then "Ottehr EHR".
 *
 * Env file must contain: AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET,
 * AUTH0_AUDIENCE, PROJECT_ID, PROJECT_API.
 */
import Oystehr from '@oystehr/sdk';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const args = process.argv.slice(2);
function getFlag(name: string): string | undefined {
  const idx = args.indexOf(name);
  return idx === -1 ? undefined : args[idx + 1];
}

const envFilePath = resolve(getFlag('--env-file') ?? '');
const email = getFlag('--email') ?? 'demo@ottehr.com';
const password = getFlag('--password') ?? 'Oystehr1!';
const firstName = getFlag('--first') ?? 'Demo';
const lastName = getFlag('--last') ?? 'Admin';
const appNameOverride = getFlag('--app-name');

if (!envFilePath) {
  console.error('Usage: tsx create-demo-user.ts --env-file <path> [--email ...] [--password ...]');
  process.exit(1);
}

interface EnvConfig {
  AUTH0_ENDPOINT: string;
  AUTH0_CLIENT: string;
  AUTH0_SECRET: string;
  AUTH0_AUDIENCE: string;
  PROJECT_ID: string;
  PROJECT_API: string;
}

async function main(): Promise<void> {
  console.log(`Env file: ${envFilePath}`);
  const config = JSON.parse(readFileSync(envFilePath, 'utf-8')) as EnvConfig;
  console.log(`Project:  ${config.PROJECT_ID}`);
  console.log(`Email:    ${email}`);
  console.log('');

  // ── Auth ────────────────────────────────────────────────────────────────────
  console.log('Authenticating with M2M credentials...');
  const tokenResponse = await fetch(config.AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: config.AUTH0_CLIENT,
      client_secret: config.AUTH0_SECRET,
      audience: config.AUTH0_AUDIENCE,
    }),
  });
  if (!tokenResponse.ok) {
    throw new Error(`Oystehr IAM token request failed: ${tokenResponse.status} ${await tokenResponse.text()}`);
  }
  const { access_token } = (await tokenResponse.json()) as { access_token: string };

  // ── Find EHR Application ID ────────────────────────────────────────────────
  console.log('Looking up EHR Application...');
  const appsResponse = await fetch(`${config.PROJECT_API}/application`, {
    headers: { Authorization: `Bearer ${access_token}`, 'x-zapehr-project-id': config.PROJECT_ID },
  });
  if (!appsResponse.ok) {
    throw new Error(`Failed to list applications: ${appsResponse.status} ${await appsResponse.text()}`);
  }
  const apps = (await appsResponse.json()) as { id: string; name: string }[];
  const candidateNames = appNameOverride ? [appNameOverride] : ['OTTEHR_EHR', 'EHR', 'Ottehr EHR'];
  const ehrApp = apps.find((a) => candidateNames.includes(a.name));
  if (!ehrApp) {
    console.error(`No EHR application found by names: ${candidateNames.join(', ')}`);
    console.error(`Available applications:`);
    for (const a of apps) console.error(`  ${a.id}  "${a.name}"`);
    throw new Error('EHR Application not found — pass --app-name to override');
  }
  console.log(`EHR Application: ${ehrApp.id} (${ehrApp.name})`);

  // ── Enable email login on the EHR Application ─────────────────────────────
  console.log('Enabling email login on EHR Application...');
  const enableEmailRes = await fetch(`${config.PROJECT_API}/application/${ehrApp.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
      'x-zapehr-project-id': config.PROJECT_ID,
    },
    body: JSON.stringify({ loginWithEmailEnabled: true }),
  });
  if (!enableEmailRes.ok) {
    console.warn(`Warning: could not enable email login (${enableEmailRes.status}). User invite may still succeed.`);
  }

  // ── SDK client for user/role operations ────────────────────────────────────
  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: config.PROJECT_ID,
  });

  // ── Idempotent: check if user exists, just update password if so ──────────
  console.log(`Checking if ${email} already exists...`);
  let existingUser: { id: string; email?: string } | undefined;
  let cursor: string | undefined;
  do {
    const page = await oystehr.user.listV2(cursor ? { cursor } : {});
    existingUser = page.data.find((u) => u.email === email);
    if (existingUser) break;
    cursor = page.metadata?.nextCursor;
  } while (cursor);

  if (existingUser) {
    console.log(`User exists (${existingUser.id}). Updating password...`);
    await oystehr.user.changePassword({ id: existingUser.id, password });
    console.log('');
    console.log('✓ Password updated.');
    console.log(`  Email:    ${email}`);
    console.log(`  Password: ${password}`);
    return;
  }

  // ── Look up Administrator role ────────────────────────────────────────────
  console.log('Looking up Administrator role...');
  const roles = await oystehr.role.list();
  const adminRole = roles.find((r) => r.name === 'Administrator');
  if (!adminRole) {
    console.error(`Administrator role not found. Available roles:`);
    for (const r of roles) console.error(`  ${r.id}  ${r.name}`);
    throw new Error('Administrator role not found');
  }
  console.log(`Administrator role: ${adminRole.id}`);

  // ── Invite + set password ──────────────────────────────────────────────────
  console.log(`Inviting ${email} as Administrator...`);
  const invitedUser = await oystehr.user.invite({
    email,
    applicationId: ehrApp.id,
    resource: {
      resourceType: 'Practitioner',
      active: true,
      name: [{ family: lastName, given: [firstName] }],
      telecom: [{ system: 'email', value: email }],
    },
    roles: [adminRole.id],
  });
  console.log(`User invited: ${invitedUser.id}`);

  console.log('Setting password...');
  await oystehr.user.changePassword({ id: invitedUser.id, password });

  console.log('');
  console.log('✓ User created.');
  console.log(`  Email:    ${email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Role:     Administrator`);
}

main().catch((err) => {
  console.error('');
  console.error('Fatal error:', err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) {
    console.error(err.stack.split('\n').slice(1, 4).join('\n'));
  }
  process.exit(1);
});
