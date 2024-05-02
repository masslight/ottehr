import devConfig from '../.env/dev.json';
// import testingConfig from '../.env/testing.json';
import { getAuth0Token } from '../src/shared';
import { ZambdaClient } from '@zapehr/sdk';

const setupSecrets = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }

  const zambdaClient = new ZambdaClient({
    apiUrl: 'https://project-api.zapehr.com/v1',
    accessToken: token,
  });

  for await (const entry of Object.entries(config)) {
    const [key, value] = entry;
    if (typeof value !== 'string') {
      throw 'A secret value was unexpectedly not a string.';
    }
    await zambdaClient.createOrUpdateSecret({
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

  switch (env) {
    case 'dev':
      await setupSecrets(devConfig);
      break;
    // case 'testing':
    //   await setupSecrets(testingConfig);
    //   break;
    default:
      throw new Error('¯\\_(ツ)_/¯ environment must match a valid zapEHR environment.');
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});