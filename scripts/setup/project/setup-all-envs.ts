import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProject, ENV_MAP, ProjectEnv } from './create-project';
import { deleteZambdasByName } from './delete-zambdas';
import {
  DEMO_USERS,
  DEVELOPERS,
  E2E_USERS,
  OYSTEHR_AUTH_TOKEN,
  PROJECT_DOMAIN_PREFIX,
  PROJECT_NAME,
  SENDGRID_AUTH_TOKEN,
  TESTS_CONFIG,
} from './setup.config';
import { DemoUser, InviteConfig } from './types';
import { getApplicationId, getRoleIds, sendDeveloperInvite, sendUserInvite, setPasswordWithBrowser } from './utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROGRESS_FILE = resolve(__dirname, 'setup-progress.json');
const OTTEHR_ROOT = resolve(__dirname, '../../../');

const ENVS: ProjectEnv[] = ['local', 'staging', 'production'];
const REQUIRED_ROLES = ['Staff', 'Provider', 'Manager', 'Administrator'];

interface DistributionIds {
  patientPortal?: string;
  ehr?: string;
}

interface EnvProgress {
  projectSetup: boolean;
  applyDone: boolean;
  distributionIds?: DistributionIds;
  e2eM2mFetched: boolean;
  testsFilesWritten: boolean;
  demoUserInvited: boolean;
  e2eUserInvited: boolean;
  developersInvited: boolean;
}

type Progress = Record<string, EnvProgress>;

function loadProgress(): Progress {
  if (existsSync(PROGRESS_FILE)) {
    try {
      return JSON.parse(readFileSync(PROGRESS_FILE, 'utf8')) as Progress;
    } catch {
      console.warn('WARNING: Could not parse setup-progress.json, starting fresh.');
    }
  }
  return {};
}

function saveProgress(progress: Progress): void {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2) + '\n');
}

function getEnvProgress(progress: Progress, env: string): EnvProgress {
  return (
    progress[env] ?? {
      projectSetup: false,
      applyDone: false,
      e2eM2mFetched: false,
      testsFilesWritten: false,
      demoUserInvited: false,
      e2eUserInvited: false,
      developersInvited: false,
    }
  );
}

function readProjectIdFromConfig(env: ProjectEnv): string {
  const configEnvPath = resolve(OTTEHR_ROOT, 'config/.env', ENV_MAP[env].zambdaEnv);
  const cfg = JSON.parse(readFileSync(configEnvPath, 'utf8'));
  return cfg.PROJECT_ID;
}

async function inviteUserAndSetPassword(config: InviteConfig, user: DemoUser): Promise<void> {
  const applicationId = await getApplicationId(config);
  const roleIds = await getRoleIds(config, REQUIRED_ROLES);

  console.log(`\nSending invite for ${user.email}...`);
  const inviteResponse = await sendUserInvite(
    config,
    applicationId,
    user.email,
    user.firstName,
    user.lastName,
    roleIds
  );
  console.log(`Invite sent! User ID: ${inviteResponse.id}`);

  if (!inviteResponse.invitationUrl) {
    throw new Error(`No invitationUrl in response: ${JSON.stringify(inviteResponse)}`);
  }

  await setPasswordWithBrowser(inviteResponse.invitationUrl, user.password);
  console.log(`   You can now log in with: ${user.email}`);
}

async function inviteAllDevelopers(config: InviteConfig): Promise<void> {
  console.log(`\nTotal developers to invite: ${DEVELOPERS.length}`);
  for (const dev of DEVELOPERS) {
    console.log(`Sending invite to ${dev.firstName} Dev <${dev.email}>...`);
    try {
      await sendDeveloperInvite(config, dev.email, dev.firstName);
      console.log(`Invite sent to ${dev.firstName} Dev`);
    } catch (err: any) {
      console.error(`ERROR: Failed to send invite to ${dev.firstName} Dev: ${err.message}`);
    }
  }
}

async function fetchE2eM2mCredentials(env: ProjectEnv): Promise<void> {
  const configEnvPath = resolve(OTTEHR_ROOT, 'config/.env', ENV_MAP[env].zambdaEnv);
  const configEnv = JSON.parse(readFileSync(configEnvPath, 'utf8'));

  // Get a project-scoped access token using the main M2M credentials
  const tokenRes = await fetch('https://auth.zapehr.com/oauth/token', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: configEnv.AUTH0_CLIENT,
      client_secret: configEnv.AUTH0_SECRET,
      audience: 'https://api.zapehr.com',
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Failed to get access token for ${env}: ${await tokenRes.text()}`);
  }
  const { access_token: accessToken } = (await tokenRes.json()) as { access_token: string };

  // List all M2M clients in the project
  const m2msRes = await fetch('https://project-api.zapehr.com/v1/m2m', {
    headers: {
      authorization: `Bearer ${accessToken}`,
      'x-oystehr-project-id': configEnv.PROJECT_ID,
    },
  });
  if (!m2msRes.ok) {
    throw new Error(`Failed to list M2M clients for ${env}: ${await m2msRes.text()}`);
  }
  const m2ms = (await m2msRes.json()) as { id: string; clientId: string; name: string }[];

  const e2eM2m = m2ms.find((m) => m.name === 'E2E Tests M2M Client');
  if (!e2eM2m) {
    throw new Error(`"E2E Tests M2M Client" not found in project for ${env}. Make sure apply has completed.`);
  }

  // Rotate the E2E M2M secret
  const rotateRes = await fetch(`https://project-api.zapehr.com/v1/m2m/${e2eM2m.id}/rotate-secret`, {
    method: 'POST',
    body: '{}',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
      'x-oystehr-project-id': configEnv.PROJECT_ID,
    },
  });
  if (!rotateRes.ok) {
    throw new Error(`Failed to rotate E2E M2M secret for ${env}: ${await rotateRes.text()}`);
  }
  const { secret } = (await rotateRes.json()) as { secret: string };

  configEnv.AUTH0_CLIENT_TESTS = e2eM2m.clientId;
  configEnv.AUTH0_SECRET_TESTS = secret;
  writeFileSync(configEnvPath, JSON.stringify(configEnv, null, 2) + '\n');
  console.log(`  Updated AUTH0_CLIENT_TESTS (${e2eM2m.clientId}) and AUTH0_SECRET_TESTS in ${configEnvPath}`);
}

function writeTestsFiles(env: ProjectEnv): void {
  const configEnvPath = resolve(OTTEHR_ROOT, 'config/.env', ENV_MAP[env].zambdaEnv);
  const configEnv = JSON.parse(readFileSync(configEnvPath, 'utf8'));
  const auth0ClientTests: string = configEnv.AUTH0_CLIENT_TESTS ?? '';
  const auth0SecretTests: string = configEnv.AUTH0_SECRET_TESTS ?? '';

  // apps/ehr/env/tests.{env}.json — EHR E2E user credentials
  if (E2E_USERS[0]) {
    const ehrTestsPath = resolve(OTTEHR_ROOT, 'apps/ehr/env', `tests.${env}.json`);
    const ehrTests = existsSync(ehrTestsPath) ? JSON.parse(readFileSync(ehrTestsPath, 'utf8')) : {};
    ehrTests.TEXT_USERNAME = E2E_USERS[0].email;
    ehrTests.TEXT_PASSWORD = E2E_USERS[0].password;
    ehrTests.AUTH0_CLIENT_TESTS = auth0ClientTests;
    ehrTests.AUTH0_SECRET_TESTS = auth0SecretTests;
    writeFileSync(ehrTestsPath, JSON.stringify(ehrTests, null, 2) + '\n');
    console.log(`  Written: ${ehrTestsPath}`);
  }

  // apps/intake/env/tests.{env}.json — intake test config
  if (TESTS_CONFIG) {
    const intakeTestsPath = resolve(OTTEHR_ROOT, 'apps/intake/env', `tests.${env}.json`);
    const intakeTests = existsSync(intakeTestsPath) ? JSON.parse(readFileSync(intakeTestsPath, 'utf8')) : {};
    intakeTests.PHONE_NUMBER = TESTS_CONFIG.PHONE_NUMBER;
    intakeTests.TEXT_USERNAME = TESTS_CONFIG.TEXT_USERNAME;
    intakeTests.TEXT_PASSWORD = TESTS_CONFIG.TEXT_PASSWORD;
    intakeTests.AUTH0_CLIENT_TESTS = auth0ClientTests;
    intakeTests.AUTH0_SECRET_TESTS = auth0SecretTests;
    writeFileSync(intakeTestsPath, JSON.stringify(intakeTests, null, 2) + '\n');
    console.log(`  Written: ${intakeTestsPath}`);
  }
}

function runApply(env: ProjectEnv, deployDir: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    const child = spawn('npm', ['run', `apply-${env}`], {
      cwd: deployDir,
      env: { ...process.env, CI: 'true' },
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: false,
    });

    let output = '';
    child.stdout.on('data', (chunk: Buffer) => {
      const str = chunk.toString();
      output += str;
      process.stdout.write(str);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const str = chunk.toString();
      output += str;
      process.stderr.write(str);
    });
    child.on('close', (code) => resolve({ ok: code === 0, output }));
  });
}

function parseDistributionIds(output: string): DistributionIds {
  const patientMatch = output.match(/patient_portal_cf[^[]*\[id=([A-Z0-9]+)\]/);
  const ehrMatch = output.match(/ehr_cf[^[]*\[id=([A-Z0-9]+)\]/);
  return {
    patientPortal: patientMatch?.[1],
    ehr: ehrMatch?.[1],
  };
}

// Runs `npm run apply-{env}`. On failure, checks if any zambdas already exist,
// deletes only those, then retries once. Returns the combined output.
async function runApplyWithZambdaRetry(env: ProjectEnv, deployDir: string): Promise<string> {
  const first = await runApply(env, deployDir);
  if (first.ok) return first.output;

  // Parse zambda names from lines like:
  //   with module.oystehr.oystehr_zambda.SOME-ZAMBDA-NAME,
  const conflictingNames = [...first.output.matchAll(/oystehr_zambda\.([A-Z0-9_-]+),/g)].map((m) => m[1]);

  if (conflictingNames.length === 0) {
    throw new Error(`Apply failed for ${env} with no zambda conflicts — check the output above.`);
  }

  console.log(`\nZambda conflicts detected: ${conflictingNames.join(', ')}`);
  const projectId = readProjectIdFromConfig(env);
  await deleteZambdasByName(projectId, OYSTEHR_AUTH_TOKEN, conflictingNames);

  console.log('\nRetrying apply...');
  const second = await runApply(env, deployDir);
  if (!second.ok) {
    throw new Error(`Apply failed for ${env} after zambda cleanup — check the output above.`);
  }
  return second.output;
}

async function main(): Promise<void> {
  if (!OYSTEHR_AUTH_TOKEN) {
    console.error('ERROR: OYSTEHR_AUTH_TOKEN is required in setup.config.ts');
    process.exit(1);
  }
  if (!PROJECT_NAME) {
    console.error('ERROR: PROJECT_NAME is required in setup.config.ts');
    process.exit(1);
  }

  const progress = loadProgress();

  if (existsSync(PROGRESS_FILE)) {
    console.log(`Resuming from progress file: ${PROGRESS_FILE}`);
  }

  // ─── Phase 1: create all projects and write config files ─────────────────
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1: Project setup');
  console.log('='.repeat(60));

  for (const env of ENVS) {
    const ep = getEnvProgress(progress, env);

    if (ep.projectSetup) {
      console.log(`\n[SKIP] Project already set up for ${env}.`);
      continue;
    }

    console.log(`\n--- Setting up project for ${env.toUpperCase()} ---`);
    await createProject({
      projectName: PROJECT_NAME,
      domainPrefix: PROJECT_DOMAIN_PREFIX || undefined,
      env,
      oystehrToken: OYSTEHR_AUTH_TOKEN,
      sendgridToken: SENDGRID_AUTH_TOKEN,
    });

    ep.projectSetup = true;
    progress[env] = ep;
    saveProgress(progress);
    console.log(`Project setup complete for ${env}.`);
  }

  // ─── Phase 1.5: Terraform apply ──────────────────────────────────────────
  const envsNeedingApply = ENVS.filter((env) => !getEnvProgress(progress, env).applyDone);

  if (envsNeedingApply.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('PHASE 1.5: Terraform apply');
    console.log('='.repeat(60));
    console.log(`
NOTE: Make sure deploy/backend.config has the correct S3 bucket before continuing.
      If unsure, check the file and re-run — .terraform will be cleaned automatically.
`);

    const deployDir = resolve(OTTEHR_ROOT, 'deploy');

    console.log('\nInitializing Terraform...');
    execSync('npm run terraform-init', { cwd: deployDir, stdio: 'inherit' });

    const workspaces = ['e2e', 'e2e2', 'e2e3', 'local', 'development', 'testing', 'staging', 'demo', 'production'];
    for (const ws of workspaces) {
      try {
        execSync(`terraform workspace new ${ws}`, { cwd: deployDir, stdio: 'inherit' });
      } catch {
        console.log(`Workspace "${ws}" already exists, skipping.`);
      }
    }
    execSync('terraform workspace select local', { cwd: deployDir, stdio: 'inherit' });
    console.log('Terraform setup complete.');

    for (const env of envsNeedingApply) {
      console.log(`\n--- Running apply for ${env.toUpperCase()} ---`);
      const output = await runApplyWithZambdaRetry(env, deployDir);

      const ep = getEnvProgress(progress, env);
      ep.applyDone = true;
      ep.distributionIds = parseDistributionIds(output);
      if (ep.distributionIds.patientPortal || ep.distributionIds.ehr) {
        console.log(
          `CloudFront distribution IDs: patient=${ep.distributionIds.patientPortal ?? 'not found'}, ehr=${
            ep.distributionIds.ehr ?? 'not found'
          }`
        );
      }
      progress[env] = ep;
      saveProgress(progress);
      console.log(`Apply complete for ${env}.`);
    }
  } else {
    console.log('\n[SKIP] Terraform apply already done for all environments.');
  }

  // ─── Phase 1.6: Fetch E2E M2M credentials (created by Terraform) ─────────
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1.6: Fetch E2E M2M credentials');
  console.log('='.repeat(60));

  for (const env of ENVS) {
    const ep = getEnvProgress(progress, env);
    if (ep.e2eM2mFetched) {
      console.log(`\n[SKIP] E2E M2M credentials already fetched for ${env}.`);
      continue;
    }
    console.log(`\n--- Fetching E2E M2M credentials for ${env.toUpperCase()} ---`);
    await fetchE2eM2mCredentials(env);
    ep.e2eM2mFetched = true;
    progress[env] = ep;
    saveProgress(progress);
  }

  // ─── Phase 1.7: Write tests env files ────────────────────────────────────
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1.7: Write tests env files');
  console.log('='.repeat(60));

  for (const env of ENVS) {
    const ep = getEnvProgress(progress, env);
    if (ep.testsFilesWritten) {
      console.log(`\n[SKIP] Tests files already written for ${env}.`);
      continue;
    }
    console.log(`\n--- Writing tests files for ${env.toUpperCase()} ---`);
    writeTestsFiles(env);
    ep.testsFilesWritten = true;
    progress[env] = ep;
    saveProgress(progress);
  }

  // ─── Phase 2: invite users (only reached after apply has been run) ────────
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 2: Inviting users');
  console.log('='.repeat(60));

  for (const env of ENVS) {
    console.log(`\n--- Inviting users for ${env.toUpperCase()} ---`);
    const ep = getEnvProgress(progress, env);
    const projectId = readProjectIdFromConfig(env);
    const config: InviteConfig = { authToken: OYSTEHR_AUTH_TOKEN, projectId };

    // Demo user — skip on production
    if (env === 'production') {
      ep.demoUserInvited = true;
    } else if (ep.demoUserInvited) {
      console.log(`[SKIP] Demo user already invited for ${env}.`);
    } else if (DEMO_USERS[0]) {
      console.log(`\nInviting demo user...`);
      await inviteUserAndSetPassword(config, DEMO_USERS[0]);
      ep.demoUserInvited = true;
      progress[env] = ep;
      saveProgress(progress);
    }

    // E2E user — skip on production
    if (env === 'production') {
      ep.e2eUserInvited = true;
    } else if (ep.e2eUserInvited) {
      console.log(`[SKIP] E2E user already invited for ${env}.`);
    } else if (E2E_USERS[0]) {
      console.log(`\nInviting E2E user...`);
      await inviteUserAndSetPassword(config, E2E_USERS[0]);
      ep.e2eUserInvited = true;
      progress[env] = ep;
      saveProgress(progress);
    }

    // Developers
    if (ep.developersInvited) {
      console.log(`[SKIP] Developers already invited for ${env}.`);
    } else {
      await inviteAllDevelopers(config);
      ep.developersInvited = true;
      progress[env] = ep;
      saveProgress(progress);
    }

    progress[env] = ep;
    saveProgress(progress);
    console.log(`Completed invites for ${env}.`);
  }

  console.log('\nAll environments provisioned successfully.');
  console.log(`Progress saved to: ${PROGRESS_FILE}`);
  console.log('To start fresh, delete that file and re-run.');
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
