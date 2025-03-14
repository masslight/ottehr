import Oystehr from '@oystehr/sdk';
import fs from 'fs';
import { Secrets } from 'zambda-utils';
import { getAuth0Token } from '../src/shared';

const projectApiUrlFromAuth0Audience = (auth0Audience: string): string => {
  switch (auth0Audience) {
    case 'https://dev.api.zapehr.com':
      return 'https://dev.project-api.zapehr.com/v1';
    case 'https://dev2.api.zapehr.com':
      return 'https://dev2.project-api.zapehr.com/v1';
    case 'https://testing.api.zapehr.com':
      return 'https://testing.project-api.zapehr.com/v1';
    case 'https://staging.api.zapehr.com':
      return 'https://staging.project-api.zapehr.com/v1';
    case 'https://api.zapehr.com':
      return 'https://project-api.zapehr.com/v1';
    default:
      throw `Unexpected auth0 audience value, could not map to a projectApiUrl. auth0Audience was: ${auth0Audience}`;
  }
};

const setupSecrets = async (config: Secrets): Promise<void> => {
  const token = await getAuth0Token(config);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    projectApiUrl: projectApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
  });

  console.log('updating secrets');
  for await (const entry of Object.entries(config)) {
    const [key, value] = entry;
    if (typeof value !== 'string') {
      throw 'A secret value was unexpectedly not a string.';
    }
    console.log(`Updating secret ${key}...`);
    await oystehr.secret.set({
      name: key,
      value: value,
    });
    console.log(`Create/update secret ${key} succeeded`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
};

// So we can use await
const main = async (): Promise<void> => {
  const env = process.argv[2];

  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  await setupSecrets(secrets);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
