import Oystehr from '@oystehr/sdk';
import fs from 'fs';
import ottehrSpec from '../../ottehr-spec.json';
import { getAuth0Token } from '../shared/';
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

const prepareSecretsFromSpecAndEnv = (env: string): Record<string, string> => {
  const envFile = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const secrets: Record<string, string> = {};
  Object.entries(ottehrSpec.secrets).forEach(([_key, secret]) => {
    if (secret.value.startsWith('#var/')) {
      const varName = secret.value.split('#var/')[1];
      const secretValue = envFile[varName];
      if (secretValue == null) {
        throw new Error(`Secret ${secret.name} was not found in the env file.`);
      }
      secrets[secret.name] = envFile[varName];
    } else {
      secrets[secret.name] = secret.value;
    }
  });

  return secrets;
};

// So we can use await
const main = async (): Promise<void> => {
  const env = process.argv[2];

  if (!env) {
    throw new Error('Please provide an environment to configure secrets.');
  }

  const secrets = prepareSecretsFromSpecAndEnv(env);
  await setupSecrets(secrets);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
