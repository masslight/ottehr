import { ZambdaClient } from '@zapehr/sdk';
import { SecretsKeys, getAuth0Token, getSecret } from '../src/shared';
import { Secrets } from '../src/types';

enum environment {
  dev = 'dev',
  testing = 'testing',
}

export async function createZambdaClient(secrets: Secrets | null): Promise<ZambdaClient> {
  const PROJECT_API = getSecret(SecretsKeys.PROJECT_API, secrets);

  const accessToken = await getAuth0Token(secrets);
  try {
    console.group(`Fetch from ${PROJECT_API}`);
    const fhirClient = new ZambdaClient({
      accessToken,
      apiUrl: PROJECT_API,
    });
    console.groupEnd();
    console.debug(`Fetch from ${PROJECT_API} success`);
    return fhirClient;
  } catch (error) {
    console.groupEnd();
    console.error(`Fetch from ${PROJECT_API} failure`);
    throw new Error('Failed to create ZambdaClient');
  }
}

// So we can use await in the scripts' root functions
export const setupDeploy = async (functionName: (config: object) => any): Promise<void> => {
  // If the argument isn't a valid environment, quit
  const env = process.argv[2] as environment;
  if (!Object.values(environment).includes(env)) {
    throw new Error('¯\\_(ツ)_/¯ environment must match a valid environment.');
  }

  const configModule = await import(`../.env/${env}.json`);
  await functionName(configModule.default);
};
