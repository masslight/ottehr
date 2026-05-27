import { DEMO_USERS as _demoUsers, OYSTEHR_AUTH_TOKEN, PROJECT_ID } from './setup.config';
import { DemoUser } from './types';
import {
  buildConfig,
  getApplicationId,
  getRoleIds,
  resolveProjectId,
  sendUserInvite,
  setPasswordWithBrowser,
} from './utils';

const config = buildConfig(OYSTEHR_AUTH_TOKEN, resolveProjectId(PROJECT_ID));
const DEMO_USERS: DemoUser[] = _demoUsers;

async function main(): Promise<void> {
  const user = DEMO_USERS[0];

  const applicationId = await getApplicationId(config);

  const requiredRoles = ['Staff', 'Provider', 'Manager', 'Administrator'];
  const roleIds = await getRoleIds(config, requiredRoles);

  console.log(`\nSending invite for ${user.email}...`);

  const inviteResponse = await sendUserInvite(
    config,
    applicationId,
    user.email,
    user.firstName,
    user.lastName,
    roleIds,
    user.npi
  );

  console.log(`Invite sent! User ID: ${inviteResponse.id}`);
  console.log(`   Profile: ${inviteResponse.profile}`);

  const invitationUrl = inviteResponse.invitationUrl;

  if (!invitationUrl) {
    console.error('ERROR: No invitationUrl in response!');
    console.error('Response:', JSON.stringify(inviteResponse, null, 2));
    process.exit(1);
  }

  console.log(`Invitation URL: ${invitationUrl}`);

  await setPasswordWithBrowser(invitationUrl, user.password);

  console.log(`   You can now log in with: ${user.email} / ${user.password}`);
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
