import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { BundleEntry, Encounter, List, Patient } from 'fhir/r4b';
import * as fs from 'fs';
import * as path from 'path';
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

// Function to convert title to key format
function titleToKey(title: string): string {
  return title
    .replace(/[(),]/g, '') // Remove parentheses and commas
    .replace(/"/g, '') // Remove quotes
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .replace(/-/g, '_') // Replace hyphens with underscores
    .replace(/[^A-Za-z0-9_]/g, '') // Remove any other special characters
    .toUpperCase();
}

// Function to parse CSV properly handling quoted fields
function parseCSV(csvContent: string): any[] {
  const lines = csvContent.split('\n');
  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const result = [];

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue; // Skip empty lines

    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;

    const row: any = {};
    for (let k = 0; k < headers.length; k++) {
      row[headers[k]] = values[k] || '';
    }
    result.push(row);
  }

  return result;
}

// Function to parse a single CSV line handling quotes properly
function parseCSVLine(line: string): string[] {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Handle escaped quotes
        current += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim()); // Push the last value
  return result;
}

async function createGlobalTemplateFromAppointment(config: any, appointmentId: string, title: string): Promise<List> {
  const oystehr = await getOystehr(config);

  // Get appointment bundle
  const appointmentBundle = await oystehr.fhir.search({
    resourceType: 'Appointment',
    params: [
      { name: '_id', value: appointmentId },
      { name: '_revinclude', value: 'Encounter:appointment' },
      { name: '_revinclude:iterate', value: 'Observation:encounter' },
      { name: '_revinclude:iterate', value: 'ClinicalImpression:encounter' },
      { name: '_revinclude:iterate', value: 'Communication:encounter' },
      { name: '_revinclude:iterate', value: 'Condition:encounter' },
    ],
  });

  // console.log(JSON.stringify(appointmentBundle));

  if (!appointmentBundle.entry) {
    throw new Error('No entries found in appointment bundle, cannot make a template');
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
    title: title,
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
    if (entry.resource?.resourceType === 'Condition') return true; // We do want multiple ICD-10 codes though!
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

  return listToCreate;
}

async function processGlobalTemplatesFromCSV(config: any): Promise<void> {
  // const csvPath = path.join(__dirname, 'data/templates/global-templates-source.csv');
  const csvPath = path.join(__dirname, 'data/templates/adult-templates.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const csvData = parseCSV(csvContent);

  const results: { [key: string]: List } = {};

  for (const row of csvData) {
    const title = row.Title;
    const appointmentId = row['appointment-id'];

    if (!title || !appointmentId) {
      console.log(`Skipping row due to missing title or appointment-id: ${JSON.stringify(row)}`);
      continue;
    }

    try {
      console.log(`Processing: ${title} (${appointmentId})`);
      const list = await createGlobalTemplateFromAppointment(config, appointmentId, title);
      const key = titleToKey(title);
      results[key] = list;
    } catch (error) {
      console.log(`Error processing ${title}: ${error}`);
      captureException(error);
    }
  }

  console.log(JSON.stringify(results, null, 2));
}

const main = async (): Promise<void> => {
  try {
    await performEffectWithEnvFile(processGlobalTemplatesFromCSV);
  } catch (e) {
    console.log('Catch some error while running all effects: ', e);
    console.log('Stringifies: ', JSON.stringify(e));
    captureException(e);
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
