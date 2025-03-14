import Oystehr from '@oystehr/sdk';
import { Medication, Resource } from 'fhir/r4b';
import {
  getMedicationName,
  InHouseMedicationInfo,
  InHouseMedications,
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_IDENTIFIER_ADMIN_CODE_SYSTEM,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils';

import { CODE_SYSTEM_CPT, CODE_SYSTEM_NDC, getMedicationTypeCode, getResourcesFromBatchInlineRequests } from 'utils';
import { performEffectWithEnvFile } from 'zambda-utils';
import { getAuth0Token } from '../src/shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

const checkAndUpdateInHouseMedications = async (config: any): Promise<void> => {
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

  for (const jsonMedication of InHouseMedications) {
    const existedMedication = medicationsResources.find((medRes) => getMedicationName(medRes) === jsonMedication.name);
    const newMedication = createMedicationResource(jsonMedication);
    if (existedMedication) {
      newMedication.id = existedMedication.id;
      await oystehr.fhir.update(newMedication);
      console.log(`Updated FHIR Medication: ${getMedicationName(newMedication)}, with id: ${newMedication.id}`);
    } else {
      const resultResource = await oystehr.fhir.create(newMedication);
      console.log(`Created FHIR Medication: ${getMedicationName(newMedication)}, with id: ${resultResource.id}`);
    }
  }
};

function createMedicationResource(data: InHouseMedicationInfo): Medication {
  return {
    resourceType: 'Medication',
    identifier: [
      {
        system: MEDICATION_IDENTIFIER_ADMIN_CODE_SYSTEM,
        value: data.adminCode,
      },
      {
        system: MEDICATION_TYPE_SYSTEM,
        value: INVENTORY_MEDICATION_TYPE_CODE,
      },
      {
        system: MEDICATION_IDENTIFIER_NAME_SYSTEM,
        value: data.name,
      },
    ],
    code: {
      coding: [
        {
          system: CODE_SYSTEM_CPT,
          code: data.CPT,
        },
        {
          system: CODE_SYSTEM_NDC,
          code: data.NDC,
        },
      ],
    },
  };
}

function filterInHouseMedications(allResources: Resource[]): Medication[] {
  return allResources.filter(
    (res) =>
      res.resourceType === 'Medication' && getMedicationTypeCode(res as Medication) === INVENTORY_MEDICATION_TYPE_CODE
  ) as Medication[];
}

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile('ehr', checkAndUpdateInHouseMedications);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
