import fs from 'fs';
import { pathToFileURL } from 'url';

const USER_FILE_LOCATION = 'apps/intake/playwright/user.json';
const TOKEN_VALIDITY_THRESHOLD_MINUTES = 60;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const validateE2EIntakeUser = (fileLocation) => {
  const expiries = [];

  try {
    const userFile = JSON.parse(fs.readFileSync(fileLocation, 'utf8'));
    if (!userFile) {
      throw new Error('Could not find user.json file');
    }

    // // oystehr, localhost, and stripe cookies
    // const cookies = userFile.cookies?.map((cookie) => cookie.expires);
    // expiries.push(...cookies);

    const authItem = userFile.origins?.flatMap((origin) =>
      origin.localStorage?.find(
        (item) =>
          item.name?.includes('@@auth0spajs@@') && !item.name?.includes('@@user@@') && item.value?.includes('expiresAt')
      )
    )[0];
    if (!authItem) {
      throw new Error('Could not find Auth0 token');
    }
    console.log('Found Auth0 token');

    const expiresAt = JSON.parse(authItem.value).expiresAt;
    expiries.push(expiresAt);
  } catch (e) {
    console.error('Failed token check:', e.message);
    throw new Error('Failed token check');
  }

  expiries.forEach((expiry) => {
    if (!doesTokenLastMoreThanNeeded(expiry)) {
      throw new Error('At least 1 token expires soon');
    }
  });
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const doesTokenLastMoreThanNeeded = (expiresAt) => {
  const timeLeft = (expiresAt * 1000 - Date.now()) / (1000 * 60);
  console.log(`Time left: ${timeLeft.toFixed(1)} minutes`);
  return timeLeft > TOKEN_VALIDITY_THRESHOLD_MINUTES;
};

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateE2EIntakeUser(USER_FILE_LOCATION);
}
