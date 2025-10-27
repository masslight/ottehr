import Oystehr from '@oystehr/sdk';
import { ValueSet } from 'fhir/r4b';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from './helpers';

async function deleteValueSets(config: any): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });
  const valueSets = (
    await oystehr.fhir.search<ValueSet>({ resourceType: 'ValueSet', params: [{ name: '_count', value: '1000' }] })
  ).unbundle();

  console.log(`Found ${valueSets.length} ValueSets.`);

  for (const resource of valueSets) {
    if (resource.url && resource.url.startsWith('https://fhir.ottehr.com/ValueSet/')) {
      await oystehr.fhir.delete({ resourceType: 'ValueSet', id: resource.id! });
      console.log(`Deleted FHIR ValueSet: ${resource.url}, with id: ${resource.id}`);
    }
  }
}

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(deleteValueSets);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
