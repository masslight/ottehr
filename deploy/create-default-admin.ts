/**
 * Creates a default admin user (demo@ottehr.com) in the EHR application.
 * Run after terraform apply has created the core resources (apps, roles).
 *
 * Usage: tsx create-default-admin.ts [environment]
 *   environment defaults to "local"
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import Oystehr from '@oystehr/sdk';

const DEMO_EMAIL = 'demo@ottehr.com';
const DEMO_PASSWORD = 'Oystehr1!';
const DEMO_FIRST_NAME = 'Demo';
const DEMO_LAST_NAME = 'Admin';

async function main(): Promise<void> {
  const env = process.argv[2] || 'local';
  const envFile = path.resolve(__dirname, `../packages/zambdas/.env/${env}.json`);

  if (!fs.existsSync(envFile)) {
    throw new Error(`Environment file not found: ${envFile}`);
  }

  const config = JSON.parse(fs.readFileSync(envFile, 'utf-8'));

  // Get M2M token
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
    throw new Error(`Failed to get token: ${tokenResponse.status} ${await tokenResponse.text()}`);
  }

  const { access_token } = (await tokenResponse.json()) as { access_token: string };

  // Get EHR application ID — try terraform output first, fall back to Oystehr API
  console.log('Getting EHR application ID...');
  let ehrAppId = '';
  try {
    const ehrAppIdRaw = execSync('terraform output -no-color -raw app_ehr_id 2>&1', {
      cwd: __dirname,
      encoding: 'utf-8',
    });
    const cleaned = ehrAppIdRaw.replace(/\x1b\[[0-9;]*m/g, '').trim();
    // Validate it looks like a UUID (terraform output returns warnings as text if missing)
    if (/^[0-9a-f-]{36}$/.test(cleaned)) {
      ehrAppId = cleaned;
    }
  } catch {
    // terraform output may not work if state hasn't been refreshed
  }

  if (!ehrAppId) {
    // Fall back to querying the Oystehr Project API for the EHR application
    console.log('Terraform output unavailable, querying Oystehr API for EHR application...');
    const appsResponse = await fetch(`${config.PROJECT_API}/application`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
        'x-zapehr-project-id': config.PROJECT_ID,
      },
    });
    if (!appsResponse.ok) {
      throw new Error(`Failed to list applications: ${appsResponse.status}`);
    }
    const apps = (await appsResponse.json()) as { id: string; name: string }[];
    const ehrApp = apps.find((a) => a.name === 'OTTEHR_EHR' || a.name === 'EHR');
    if (!ehrApp) {
      throw new Error('EHR application not found. Has terraform apply created the apps?');
    }
    ehrAppId = ehrApp.id;
  }

  console.log(`EHR Application ID: ${ehrAppId}`);

  // Ensure email login is enabled on the EHR application
  console.log('Enabling email login on EHR application...');
  const enableEmailRes = await fetch(`${config.PROJECT_API}/application/${ehrAppId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`,
      'x-zapehr-project-id': config.PROJECT_ID,
    },
    body: JSON.stringify({ loginWithEmailEnabled: true }),
  });
  if (!enableEmailRes.ok) {
    console.warn(`Warning: Could not enable email login (${enableEmailRes.status}). User invite may fail.`);
  }

  // Initialize Oystehr SDK
  const oystehr = new Oystehr({
    accessToken: access_token,
    projectId: config.PROJECT_ID,
  });

  // Check if user already exists
  console.log(`Checking if ${DEMO_EMAIL} already exists...`);
  const existingUsers = await oystehr.user.listV2({});
  const existingUser = existingUsers.data.find((u: any) => u.email === DEMO_EMAIL);

  if (existingUser) {
    console.log(`User ${DEMO_EMAIL} already exists. Ensuring password is set...`);
    await oystehr.user.changePassword({
      id: existingUser.id,
      password: DEMO_PASSWORD,
    });
    console.log(`✓ Password updated for existing user.`);
    return;
  }

  // Get Administrator role ID
  console.log('Looking up Administrator role...');
  const roles = await oystehr.role.list();
  const adminRole = roles.find((r: any) => r.name === 'Administrator');

  if (!adminRole) {
    throw new Error('Administrator role not found. Has terraform apply created the roles?');
  }

  // Invite the user
  console.log(`Inviting ${DEMO_EMAIL} as Administrator (role ID: ${adminRole.id})...`);
  const invitedUser = await oystehr.user.invite({
    email: DEMO_EMAIL,
    applicationId: ehrAppId,
    resource: {
      resourceType: 'Practitioner',
      active: true,
      name: [{ family: DEMO_LAST_NAME, given: [DEMO_FIRST_NAME] }],
      telecom: [{ system: 'email', value: DEMO_EMAIL }],
    },
    roles: [adminRole.id],
  });

  console.log(`User invited. Setting password...`);

  // Set password
  await oystehr.user.changePassword({
    id: invitedUser.id,
    password: DEMO_PASSWORD,
  });

  console.log('');
  console.log(`✓ Default admin user created successfully!`);
  console.log(`  Email:    ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(`  Role:     Administrator`);
}

main().catch((err) => {
  console.error('Error creating default admin:', err);
  process.exit(1);
});
