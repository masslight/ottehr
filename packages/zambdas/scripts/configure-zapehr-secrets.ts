import devConfig from '../.env/dev.json';
// import testingConfig from '../.env/testing.json';
// import stagingConfig from '../.env/staging.json';
// import productionConfig from '../.env/production.json';
import { getAuth0Token } from '../src/shared';
import { ZambdaClient } from '@zapehr/sdk';

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

const setupSecrets = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }

  const zambdaClient = new ZambdaClient({
    apiUrl: projectApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
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
    // case 'staging':
    //   await setupSecrets(stagingConfig);
    //   break;
    // case 'production':
    //   await setupSecrets(productionConfig);
    //   break;
    default:
      throw new Error('¯\\_(ツ)_/¯ environment must match a valid zapEHR environment.');
  }
};

main().catch((error) => {
  console.log('error', error);
});
