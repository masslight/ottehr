import Oystehr from '@oystehr/sdk';
import fs from 'fs';
import secretsSpec from '../../../../config/oystehr/secrets.json';
import { Schema20250925 } from '../../../spec/src/schema-20250925';
import { replaceSecretValue } from '../local-server/utils';
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

const prepareSecretsFromSpecAndEnv = async (env: string): Promise<Record<string, string>> => {
  const envFile = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const schema = new Schema20250925(
    [{ path: '../../../../config/oystehr/secrets.json', spec: secretsSpec }],
    envFile,
    '',
    ''
  );
  const secrets: Record<string, string> = {};
  await Promise.all(
    Object.entries(secretsSpec.secrets).map(async ([_key, secret]) => {
      secrets[secret.name] = await replaceSecretValue(secret, schema);
    })
  );

  return secrets;
};

// So we can use await
const main = async (): Promise<void> => {
  const env = process.argv[2];

  if (!env) {
    throw new Error('Please provide an environment to configure secrets.');
  }

  const secrets = await prepareSecretsFromSpecAndEnv(env);
  await setupSecrets(secrets);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
