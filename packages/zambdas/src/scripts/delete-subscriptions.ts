import Oystehr from '@oystehr/sdk';
import { Subscription } from 'fhir/r4b';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from './helpers';

async function deleteSubscriptions(config: any): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });
  const subscriptions = (
    await oystehr.fhir.search<Subscription>({
      resourceType: 'Subscription',
      params: [{ name: '_count', value: '1000' }],
    })
  ).unbundle();

  console.log(`Found ${subscriptions.length} subscriptions.`);

  for (const resource of subscriptions) {
    if (resource.channel.endpoint && resource.channel.endpoint.startsWith('zapehr-lambda:')) {
      await oystehr.fhir.delete({ resourceType: 'Subscription', id: resource.id! });
      console.log(`Deleted FHIR Subscription: ${resource.channel.endpoint}, with id: ${resource.id}`);
    }
  }
}

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(deleteSubscriptions);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
