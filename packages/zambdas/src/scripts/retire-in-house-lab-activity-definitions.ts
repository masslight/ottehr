import { ActivityDefinition } from 'fhir/r4b';
import { createClinicalOystehrClient, getAuth0Token } from '../shared';
import { performEffectWithEnvFile } from './helpers';

async function retireADs(config: any): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = createClinicalOystehrClient(token, config);
  const activityDefinitions = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        { name: '_count', value: '1000' },
        { name: 'status', value: 'active' },
      ],
    })
  ).unbundle();

  console.log(`Found ${activityDefinitions.length} ActivityDefinitions.`);

  for (const resource of activityDefinitions) {
    if (resource.url && resource.url.startsWith('https://ottehr.com/FHIR/InHouseLab/ActivityDefinition')) {
      await oystehr.fhir.patch({
        resourceType: 'ActivityDefinition',
        id: resource.id!,
        operations: [{ op: 'replace', path: '/status', value: 'retired' }],
      });
      console.log(`Retired FHIR ActivityDefinition: ${resource.url}, with id: ${resource.id}`);
    }
  }
}

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(retireADs);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
