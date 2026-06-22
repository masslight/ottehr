import { OYSTEHR_AUTH_TOKEN, PROJECT_ID, REGULAR_USERS as _regularUsers } from './setup.config';
import { RegularUser } from './types';
import { buildConfig, fetchRoleMap, getApplicationId, resolveProjectId, sendUserInvite } from './utils';

const config = buildConfig(OYSTEHR_AUTH_TOKEN, resolveProjectId(PROJECT_ID));
const REGULAR_USERS: RegularUser[] = _regularUsers;

const ROLE_KEYWORD_MAP: Record<string, string> = {
  staff: 'Staff',
  provider: 'Provider',
  manager: 'Manager',
  admin: 'Administrator',
  'customer-support': 'Customer Support',
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const applicationId = await getApplicationId(config);

  console.log('Fetching role IDs...');
  const roleMap = await fetchRoleMap(config);

  const requiredRoleNames = Object.values(ROLE_KEYWORD_MAP);
  const missingRoles = requiredRoleNames.filter((name) => !roleMap[name]);

  if (missingRoles.length) {
    throw new Error(`ERROR: Missing roles: ${missingRoles.join(', ')}. Check role names or authentication.`);
  }

  console.log('Roles:');

  for (const [keyword, name] of Object.entries(ROLE_KEYWORD_MAP)) {
    console.log(`  ${keyword}: ${roleMap[name]}`);
  }

  console.log('');
  const batchSize = 5;
  const totalUsers = REGULAR_USERS.length;
  console.log(`Total users to invite: ${totalUsers}`);
  console.log(`Sending invites in batches of ${batchSize}...\n`);

  for (let i = 0; i < totalUsers; i += batchSize) {
    const batchNum = Math.floor(i / batchSize) + 1;
    const batchEnd = Math.min(i + batchSize - 1, totalUsers - 1);

    console.log(`Processing batch ${batchNum} (users ${i + 1}-${batchEnd + 1})...\n`);

    const batchPromises: Promise<void>[] = [];
    for (let j = i; j <= batchEnd && j < totalUsers; j++) {
      const user = REGULAR_USERS[j];

      const roleIds = user.roles.map((keyword) => {
        const roleName = ROLE_KEYWORD_MAP[keyword];
        if (!roleName || !roleMap[roleName]) {
          throw new Error(`ERROR: Unknown role keyword: "${keyword}" for user ${user.email}`);
        }
        return roleMap[roleName];
      });

      const promise = (async () => {
        console.log(`Sending invite to ${user.firstName} ${user.lastName} <${user.email}>...`);
        try {
          await sendUserInvite(config, applicationId, user.email, user.firstName, user.lastName, roleIds);
          console.log(`Invite sent to ${user.firstName} ${user.lastName}`);
        } catch (err: any) {
          console.error(`ERROR: Failed to send invite to ${user.firstName} ${user.lastName}: ${err.message}`);
        }
      })();

      batchPromises.push(promise);
    }

    await Promise.all(batchPromises);
    console.log(`\nBatch ${batchNum} completed!`);

    if (batchEnd + 1 < totalUsers) {
      console.log('Waiting 2 seconds before next batch...\n');
      await sleep(2000);
    }
  }

  console.log('\nAll invites have been sent!');
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
