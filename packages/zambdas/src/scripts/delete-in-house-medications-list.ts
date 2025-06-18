import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from './helpers';
import { getMedicationName, getResourcesFromBatchInlineRequests, INVENTORY_MEDICATION_TYPE_CODE } from 'utils';
import { filterInHouseMedications } from './create-update-in-house-medications-list';
import Oystehr from '@oystehr/sdk';

async function deleteInHouseMedications(config: any): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });
  const allResources = await getResourcesFromBatchInlineRequests(oystehr, [
    `Medication?identifier=${INVENTORY_MEDICATION_TYPE_CODE}`,
  ]);
  console.log('Received all Medications from fhir.');

  const medicationsResources = filterInHouseMedications(allResources);

  for (const resource of medicationsResources) {
    console.log(`Updated FHIR Medication: ${getMedicationName(resource)}, with id: ${resource.id}`);
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
