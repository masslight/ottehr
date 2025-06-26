import Oystehr from '@oystehr/sdk';
import { Medication } from 'fhir/r4b';
import {
  CODE_SYSTEM_NDC,
  getMedicationName,
  InHouseMedicationInfo,
  InHouseMedications,
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience, getInHouseInventoryMedications, performEffectWithEnvFile } from './helpers';

const recreateInHouseMedications = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  const oystehr = new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });
  const medicationsResources = await getInHouseInventoryMedications(oystehr);

  console.log('\n--------- Deleting old medications ---------\n');

  for (const resource of medicationsResources) {
    console.log(`Deleted FHIR Medication: ${getMedicationName(resource)}, with id: ${resource.id}`);
    await oystehr.fhir.delete({ resourceType: 'Medication', id: resource.id! });
  }

  console.log('\n--------- Creating new medications ---------\n');

  for (const jsonMedication of InHouseMedications) {
    const newMedication = createMedicationResource(jsonMedication);
    const newResource = await oystehr.fhir.create(newMedication);
    console.log(`Created FHIR Medication: ${getMedicationName(newResource)}, with id: ${newResource.id}`);
  }
};

function createMedicationResource(inHouseMedInfo: InHouseMedicationInfo): Medication {
  return {
    resourceType: 'Medication',
    identifier: [
      {
        system: MEDICATION_TYPE_SYSTEM,
        value: INVENTORY_MEDICATION_TYPE_CODE,
      },
      {
        system: MEDICATION_IDENTIFIER_NAME_SYSTEM,
        value: inHouseMedInfo.name,
      },
    ],
    code: {
      coding: [
        {
          system: CODE_SYSTEM_NDC,
          code: inHouseMedInfo.NDC,
        },
        {
          system: MEDICATION_DISPENSABLE_DRUG_ID,
          code: `${inHouseMedInfo.erxData.id}`, // drug id from erx medication search
        },
      ],
    },
  };
}

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(recreateInHouseMedications);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
