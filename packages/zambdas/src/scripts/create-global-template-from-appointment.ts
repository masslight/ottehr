import Oystehr from '@oystehr/sdk';
import { List, Patient } from 'fhir/r4b';
import { v4 as uuidV4 } from 'uuid';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from './helpers';

const getOystehr = async (config: any): Promise<Oystehr> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  return new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });
};

// ottehr-staging
const APPOINTMENT_ID = '68853b31-0e6a-4b87-98cb-0bd080b9887c';

async function createGlobalTemplateFromAppointment(config: any): Promise<void> {
  const oystehr = await getOystehr(config);

  // Get appointment bundle

  const appointmentBundle = await oystehr.fhir.search({
    resourceType: 'Appointment',
    params: [
      { name: '_id', value: APPOINTMENT_ID },
      { name: '_revinclude', value: 'Encounter:appointment' },
      { name: '_revinclude:iterate', value: 'Observation:encounter' },
      { name: '_revinclude:iterate', value: 'ClinicalImpression:encounter' },
      { name: '_revinclude:iterate', value: 'Communication:encounter' },
      { name: '_revinclude:iterate', value: 'Condition:encounter' },
    ],
  });

  // console.log(JSON.stringify(appointmentBundle));

  if (!appointmentBundle.entry) {
    console.log('No entries found in appointment bundle, cannot make a template');
    // TODO what else will we require in order to make a template? Some number of observation resources being present is a hint?
    return;
  }

  // Build List Resource with contained resources
  const listToCreate: List = {
    resourceType: 'List',
    status: 'current',
    mode: 'working',
    title: 'Otitis Media Left and Conjunctivitis Left',
    entry: [],
    contained: [],
  };

  const stubPatient: Patient = {
    resourceType: 'Patient',
    id: uuidV4(),
    name: [
      {
        family: 'stub',
        given: ['placeholder'],
      },
    ],
  };
  listToCreate.contained!.push(stubPatient);
  listToCreate.entry!.push({
    item: {
      reference: `#${stubPatient.id}`,
    },
  });

  // let counter = 0;
  let observationCounter = 0;
  for (const entry of appointmentBundle.entry) {
    // We need to push each resource into `contained` and also put a reference to the contained resource in `entry`
    if (!entry.resource) continue;
    // Skip the Appointment that was just used to fetch through to the resources we want.
    if (entry.resource.resourceType === 'Appointment') continue;
    // Skip the Encounter that was just used to fetch through to the resources we want.
    if (entry.resource.resourceType === 'Encounter') continue;
    if (entry.resource.resourceType === 'Observation' && observationCounter > 10) continue;
    const anonymizedResource: any = entry.resource; // We use any so we can scrub relevant fields from various types of resources.
    delete anonymizedResource.meta?.versionId;
    delete anonymizedResource.meta?.lastUpdated;
    delete anonymizedResource.encounter;

    // The stub patient makes the resources that require a subject valid
    anonymizedResource.subject = {
      reference: `#${stubPatient.id}`,
    };

    anonymizedResource.id = uuidV4();
    // if (counter < 90) {
    listToCreate.contained!.push(anonymizedResource);

    listToCreate.entry!.push({
      item: {
        reference: `#${anonymizedResource.id}`,
      },
    });

    // counter++;
    if (entry.resource.resourceType === 'Observation') observationCounter++; //TODO temp
  }
  // else {
  //   console.log('skipped an entry because over limit');
  // }
  // }

  console.log(JSON.stringify(listToCreate, null, 2));

  // Create List
  // console.time('create list');
  // const createdList = await oystehr.fhir.create(listToCreate);
  // console.timeEnd('create list');

  // // Print List without id, meta.version, meta.lastUpdated
  // const anonymizedCreatedList = { ...createdList };
  // delete anonymizedCreatedList.id;
  // delete anonymizedCreatedList.meta?.versionId;
  // delete anonymizedCreatedList.meta?.lastUpdated;

  // console.log(JSON.stringify(anonymizedCreatedList, null, 2));
}

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(createGlobalTemplateFromAppointment);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
