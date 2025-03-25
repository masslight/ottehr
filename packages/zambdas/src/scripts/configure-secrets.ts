import Oystehr from '@oystehr/sdk';
import fs from 'fs';
import { getAuth0Token } from '../ehr/shared';
import { projectApiUrlFromAuth0Audience } from './helpers';

const setupSecrets = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }

  try {
    const oystehr = new Oystehr({
      accessToken: token,
      projectApiUrl: projectApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    });
    for await (const entry of Object.entries(config)) {
      const [key, value] = entry;
      if (typeof value !== 'string') {
        throw 'A secret value was unexpectedly not a string.';
      }
      await oystehr.secret.set({
        name: key,
        value: value,
      });
      console.log(`Create/update secret ${key} succeeded`);
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (e) {
    console.log('error setting up secrets: ', JSON.stringify(e));
  }
};

// So we can use await
const main = async (): Promise<void> => {
  const env = process.argv[2];

  const configuration = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  await setupSecrets(configuration);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
