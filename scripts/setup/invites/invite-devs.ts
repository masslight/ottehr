import { AUTH_TOKEN, DEVELOPERS as _developers, PROJECT_ID } from './invite.config';
import { Developer } from './types';
import { buildConfig, sendDeveloperInvite } from './utils';

const config = buildConfig(AUTH_TOKEN, PROJECT_ID);
const DEVELOPERS: Developer[] = _developers;

async function main(): Promise<void> {
  console.log(`Total developers to invite: ${DEVELOPERS.length}\n`);

  for (const dev of DEVELOPERS) {
    console.log(`Sending invite to ${dev.firstName} Dev <${dev.email}>...`);
    try {
      await sendDeveloperInvite(config, dev.email, dev.firstName);
      console.log(`Invite sent to ${dev.firstName} Dev`);
    } catch (err: any) {
      console.error(`ERROR: Failed to send invite to ${dev.firstName} Dev: ${err.message}`);
    }
    console.log('---\n');
  }

  console.log('All invites have been sent!');
}

main().catch((err) => {
  console.error('ERROR:', err.message || err);
  process.exit(1);
});
