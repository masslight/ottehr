import Oystehr from '@oystehr/sdk';
import { getMedicationName } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience, getInHouseInventoryMedications, performEffectWithEnvFile } from './helpers';

async function deleteInHouseMedications(config: any): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });
  const medicationsResources = await getInHouseInventoryMedications(oystehr);

  for (const resource of medicationsResources) {
    console.log(`Deleted FHIR Medication: ${getMedicationName(resource)}, with id: ${resource.id}`);
    await oystehr.fhir.delete({ resourceType: 'Medication', id: resource.id! });
  }
}

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(deleteInHouseMedications);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
