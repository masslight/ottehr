import { getMedicationName } from 'utils/lib/fhir/medication-administration';
import { createClinicalOystehrClient } from '../shared/helpers';
import { getAuth0Token } from '../shared/getAuth0Token';
import { getInHouseInventoryMedications, performEffectWithEnvFile } from './helpers';

async function checkInHouseMedications(config: any): Promise<void> {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = createClinicalOystehrClient(token, config);
  const medicationsResources = await getInHouseInventoryMedications(oystehr);

  for (const resource of medicationsResources) {
    console.log(`FHIR Medication: ${getMedicationName(resource)}, with id: ${resource.id}`);
  }
  console.log('Received');
}

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(checkInHouseMedications);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
