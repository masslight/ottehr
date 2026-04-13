import { createProject, ProjectEnv } from './create-project';
import {
  DEMO_USERS as _demoUsers,
  DEVELOPERS as _developers,
  E2E_USERS as _e2eUsers,
  OYSTEHR_AUTH_TOKEN,
  PROJECT_NAME,
  SENDGRID_AUTH_TOKEN,
} from './setup.config';
import { DemoUser, Developer, InviteConfig } from './types';
import { getApplicationId, getRoleIds, sendDeveloperInvite, sendUserInvite, setPasswordWithBrowser } from './utils';

const DEMO_USERS: DemoUser[] = _demoUsers;
const E2E_USERS: DemoUser[] = _e2eUsers;
const DEVELOPERS: Developer[] = _developers;

const ENVS: ProjectEnv[] = ['local', 'staging', 'production'];
const REQUIRED_ROLES = ['Staff', 'Provider', 'Manager', 'Administrator'];

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

async function setupOneEnv(env: ProjectEnv): Promise<void> {
  console.log('\n' + '='.repeat(60));
  console.log(`🏗  Setting up environment: ${env.toUpperCase()}`);
  console.log('='.repeat(60));

  const result = await createProject({
    projectName: PROJECT_NAME,
    env,
    oystehrToken: OYSTEHR_AUTH_TOKEN,
    sendgridToken: SENDGRID_AUTH_TOKEN,
  });

  const config: InviteConfig = { authToken: OYSTEHR_AUTH_TOKEN, projectId: result.projectId };

  // Demo user — skip on production
  if (env === 'production') {
    console.log('\nℹ️  Skipping demo user invite for production environment.');
  } else if (DEMO_USERS[0]) {
    console.log(`\n--- Inviting demo user (${env}) ---`);
    await inviteUserAndSetPassword(config, DEMO_USERS[0]);
  }

  // E2E user
  if (E2E_USERS[0]) {
    console.log(`\n--- Inviting E2E user (${env}) ---`);
    await inviteUserAndSetPassword(config, E2E_USERS[0]);
  }

  // Developers
  console.log(`\n--- Inviting developers (${env}) ---`);
  await inviteAllDevelopers(config);

  console.log(`\n✅ Done with ${env}.`);
}

async function main(): Promise<void> {
  if (!OYSTEHR_AUTH_TOKEN) {
    console.error('❌ OYSTEHR_AUTH_TOKEN is required in setup.config.ts');
    process.exit(1);
  }
  if (!PROJECT_NAME) {
    console.error('❌ PROJECT_NAME is required in setup.config.ts');
    process.exit(1);
  }

  for (const env of ENVS) {
    await setupOneEnv(env);
  }

  console.log('\n🎉 All environments provisioned.');
}

main().catch((err) => {
  console.error('❌ Error:', err.message || err);
  process.exit(1);
});
