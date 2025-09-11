import Oystehr from '@oystehr/sdk';
import { BundleEntry, Encounter, List, Patient } from 'fhir/r4b';
import { examConfig } from 'utils';
import { v4 as uuidV4 } from 'uuid';
import { getAuth0Token } from '../shared';
import { GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM } from '../shared/templates';
import { fhirApiUrlFromAuth0Audience, performEffectWithEnvFile } from './helpers';

const getOystehr = async (config: any): Promise<Oystehr> => {
  const token = await getAuth0Token(config);
  if (!token) throw new Error('Failed to fetch auth token.');
  return new Oystehr({
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });
};

const APPOINTMENT_ID = '9eb49356-0f04-48e8-b070-d48f13ed7f9e';

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
    code: {
      coding: [
        {
          system: GLOBAL_TEMPLATE_IN_PERSON_CODE_SYSTEM,
          code: `default`,
          version: examConfig.inPerson.default.version,
          display: 'Global Template In-Person',
        },
      ],
    },
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

  const oldIdToNewIdMap = new Map<string, string>();

  // Sort and take most only the most recent resource matching tags for resources subject to the bug that leads to multiple resources with the same meta tag.
  // Sort by lastUpdated
  appointmentBundle.entry.sort((a, b) => {
    if (!a.resource || !b.resource) return 0;
    if (!a.resource.meta?.lastUpdated || !b.resource.meta?.lastUpdated) return 0;
    return a.resource.meta.lastUpdated > b.resource.meta.lastUpdated ? 1 : -1;
  });
  // Remove all but the first entry resource with matching meta.tags on system + code
  const seenTags = new Set<string>();
  appointmentBundle.entry = appointmentBundle.entry.filter((entry) => {
    const tags = entry.resource?.meta?.tag?.map((tag) => `${tag.system}|${tag.code}`);
    if (!tags) return true;
    const isDuplicate = tags.some((tag) => seenTags.has(tag!));
    if (!isDuplicate) tags.forEach((tag) => seenTags.add(tag!));
    return !isDuplicate;
  });

  // let counter = 0;
  // let observationCounter = 0;
  for (const entry of appointmentBundle.entry) {
    // We need to push each resource into `contained` and also put a reference to the contained resource in `entry`
    if (!entry.resource) continue;
    // Skip the Appointment that was just used to fetch through to the resources we want.
    if (entry.resource.resourceType === 'Appointment') continue;
    // Skip the Encounter that was just used to fetch through to the resources we want.
    if (entry.resource.resourceType === 'Encounter') continue;
    // if (entry.resource.resourceType === 'Observation' && observationCounter > 10) continue; // TODO temporary
    const anonymizedResource: any = entry.resource; // We use any so we can scrub relevant fields from various types of resources.
    delete anonymizedResource.meta?.versionId;
    delete anonymizedResource.meta?.lastUpdated;
    delete anonymizedResource.encounter;

    // The stub patient makes the resources that require a subject valid
    anonymizedResource.subject = {
      reference: `#${stubPatient.id}`,
    };

    const newId = uuidV4();
    oldIdToNewIdMap.set(entry.resource.id!, newId);
    anonymizedResource.id = newId;
    // if (counter < 90) {
    listToCreate.contained!.push(anonymizedResource);

    listToCreate.entry!.push({
      item: {
        reference: `#${anonymizedResource.id}`,
      },
    });

    // counter++;
    // if (entry.resource.resourceType === 'Observation') observationCounter++; //TODO temp
  }

  const oldEncounter = appointmentBundle.entry.find(
    (entry) => entry.resource?.resourceType === 'Encounter'
  ) as BundleEntry<Encounter>;
  if (!oldEncounter) {
    throw new Error('Unexpectedly found no Encounter when preparing template');
  }
  // Write stub encounter with ICD-10 code Conditions leveraging oldIdToNewIdMap
  const stubEncounter: Encounter = {
    resourceType: 'Encounter',
    id: uuidV4(),
    status: 'unknown', // Stub will be replaced when template is applied.
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', // Stub will be replaced when template is applied.
      code: 'AMB',
      display: 'Ambulatory',
    },
    diagnosis: oldEncounter.resource?.diagnosis?.map((diagnosis) => {
      if (!diagnosis.condition?.reference) {
        throw new Error('Unexpectedly found no condition reference in diagnosis');
      }
      // We keep this information when the template is applied. This is why we make the encounter stub.
      return {
        ...diagnosis,
        condition: {
          reference: `Condition/${oldIdToNewIdMap.get(diagnosis.condition?.reference?.split('/')[1])}`,
        },
      };
    }),
  };
  listToCreate.contained!.push(stubEncounter);
  listToCreate.entry!.push({
    item: {
      reference: `#${stubEncounter.id}`,
    },
  });

  console.log(JSON.stringify(listToCreate, null, 2));

  // Create List -- TODO we could create the list and update the global templates list holder to have a reference?
  // console.time('create list');
  // const createdList = await oystehr.fhir.create(listToCreate);
  // console.timeEnd('create list');
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
