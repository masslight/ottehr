import devConfig from '../.env/dev.json';
// import testingConfig from '../.env/testing.json';
import { FhirClient, ZambdaClient } from '@zapehr/sdk';
import { getM2MClientToken } from '../src/shared';

export const performEffectWithEnvFile = async (callback: (config: any) => void) => {
  const env = process.argv[2];

  switch (env) {
    case 'dev':
      await callback(devConfig);
      break;
    // case 'testing':
    //   await callback(testingConfig);
    //   break;
    default:
      throw new Error('¯\\_(ツ)_/¯ environment must match a valid zapEHR environment.');
  }
};

export const createZambdaClient = async (config: any): Promise<ZambdaClient> => {
  const token = await getM2MClientToken(config);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }

  const zambdaClient = new ZambdaClient({
    apiUrl: 'https://project-api.zapehr.com/v1',
    accessToken: token,
  });

  return zambdaClient;
};

