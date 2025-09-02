import Oystehr from '@oystehr/sdk';
import { Medication } from 'fhir/r4b';
import fs from 'fs';
import { getMedicationName, getResourcesFromBatchInlineRequests, INVENTORY_VACCINE_TYPE_CODE } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from './helpers';

const recreateVaccines = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });
  const medicationsResources = (await getResourcesFromBatchInlineRequests(oystehr, [
    `Medication?identifier=${INVENTORY_VACCINE_TYPE_CODE}`,
  ])) as Medication[];

  console.log('\n--------- Deleting old vaccines ---------\n');

  for (const resource of medicationsResources) {
    console.log(`Deleted FHIR Medication: ${getMedicationName(resource)}, with id: ${resource.id}`);
    await oystehr.fhir.delete({ resourceType: 'Medication', id: resource.id! });
  }

  console.log('\n--------- Creating new vaccines ---------\n');

  const vaccinesJson = JSON.parse(fs.readFileSync(`../../config/vaccines.json`, 'utf8'));

  for (const medicationResourceToCreate of Object.values(vaccinesJson.fhirResources) as Medication[]) {
    const newResource = await oystehr.fhir.create(medicationResourceToCreate);
    console.log(`Created FHIR Medication: ${getMedicationName(newResource)}, with id: ${newResource.id}`);
  }
};

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(recreateVaccines);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
