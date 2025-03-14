import Oystehr, { ZambdaFunction } from '@oystehr/sdk';
import fs from 'fs';
import { ZambdaTriggerType } from 'utils';
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

// we don't have to do this all that often. just update this const with the name(s) of the new zambda(s)
const stubsToWrite: { name: string; triggerMethod: ZambdaTriggerType }[] = [
  { name: 'urgent-care-patch-paperwork', triggerMethod: 'http_open' },
  { name: 'urgent-care-submit-paperwork', triggerMethod: 'http_open' },
];

const writeStub = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    projectApiUrl: projectApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
  });

  let newZambdas: ZambdaFunction[] = [];
  try {
    newZambdas = await Promise.all(
      stubsToWrite.map((stubInput) => {
        const { name, triggerMethod } = stubInput;
        return oystehr.zambda.create({
          name,
          triggerMethod,
        });
      })
    );
  } catch (e) {
    console.log('writing zambdas failed: ', JSON.stringify(e));
  }

  console.log('success! ', JSON.stringify(newZambdas));
};

// So we can use await
const main = async (): Promise<void> => {
  const env = process.argv[2];

  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  await writeStub(secrets);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
