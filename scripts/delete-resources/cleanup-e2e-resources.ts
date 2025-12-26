import { input } from '@inquirer/prompts';
import { Appointment } from 'fhir/r4b';
import { getAllFhirSearchPages } from '../../packages/utils/lib/fhir/getAllFhirSearchPages';
import {
  cleanAppointmentGraph,
  createOystehrClient,
  E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM,
} from '../../packages/utils/lib/main';

/*
 This is a temporary solution; the current resource deletion script 'packages/zambdas/src/scripts/clean-up-e2e.ts' needs to be improved.

 to run:
 npx env-cmd -f packages/zambdas/.env/{ENV}.json tsx scripts/delete-resources/cleanup-e2e-resources.ts
*/

const { FHIR_API, PROJECT_API, AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = process.env;

if (!FHIR_API) {
  throw new Error('FHIR_API environment variable is required.');
}

if (!PROJECT_API) {
  throw new Error('PROJECT_API environment variable is required.');
}

if (!AUTH0_ENDPOINT) {
  throw new Error('AUTH0_ENDPOINT environment variable is required.');
}

if (!AUTH0_CLIENT) {
  throw new Error('AUTH0_CLIENT environment variable is required.');
}

if (!AUTH0_SECRET) {
  throw new Error('AUTH0_SECRET environment variable is required.');
}

if (!AUTH0_AUDIENCE) {
  throw new Error('AUTH0_AUDIENCE environment variable is required.');
}

async function getAuth0Token(): Promise<string> {
  if (!AUTH0_ENDPOINT || !AUTH0_CLIENT || !AUTH0_SECRET || !AUTH0_AUDIENCE) {
    throw new Error('Missing Auth0 configuration.');
  }

  console.log('Fetching Auth0 token...');
  const response = await fetch(AUTH0_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      client_id: AUTH0_CLIENT,
      client_secret: AUTH0_SECRET,
      audience: AUTH0_AUDIENCE,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get Auth0 token: ${response.statusText}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function main(): Promise<void> {
  console.log('Starting E2E resources cleanup...');

  if (!FHIR_API) {
    throw new Error('FHIR_API environment variable is required.');
  }

  if (!PROJECT_API) {
    throw new Error('PROJECT_API environment variable is required.');
  }

  const token = await getAuth0Token();

  const oystehr = createOystehrClient(token, FHIR_API, PROJECT_API);

  console.log(`Searching for Appointments with tag system: ${E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM}`);

  // 1. Find all appointments with the E2E tag system to discover all unique run IDs
  // We fetch only 'meta' to keep it lightweight
  const allAppointments = await getAllFhirSearchPages<Appointment>(
    {
      resourceType: 'Appointment',
      params: [
        { name: '_tag', value: `${E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM}|` },
        { name: '_elements', value: 'meta' },
      ],
    },
    oystehr
  );

  console.log(`Found ${allAppointments.length} appointments (indicating potential test runs).`);

  // 2. Extract unique codes (which serve as run IDs)
  const uniqueCodes = new Set<string>();
  allAppointments.forEach((app) => {
    const tag = app.meta?.tag?.find((t) => t.system === E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM);
    if (tag && tag.code) {
      uniqueCodes.add(tag.code);
    }
  });

  console.log(`Found ${uniqueCodes.size} unique test run IDs.`);

  if (uniqueCodes.size === 0) {
    console.log('No E2E test resources found to delete.');
    return;
  }

  console.log(`This will permanently delete all FHIR resources associated with ${uniqueCodes.size} E2E test runs!`);
  console.log('This action cannot be undone.');
  console.log('');
  await input({
    message: 'Type "yes" to confirm deletion:',
    validate: (input) => input === 'yes' || 'Please type "yes" to confirm',
  });

  // 3. Iterate over each run ID and perform cleanup
  let index = 0;
  for (const code of uniqueCodes) {
    index++;
    console.log(`\n[${index}/${uniqueCodes.size}] Cleaning up resources for run ID: ${code}`);
    try {
      const success = await cleanAppointmentGraph({ system: E2E_TEST_RESOURCE_PROCESS_ID_SYSTEM, code }, oystehr);
      if (success) {
        console.log(`Cleanup successful for ${code}`);
      } else {
        console.log(`Cleanup finished with issues for ${code}`);
      }
    } catch (e) {
      console.error(`Failed cleanup for ${code}:`, e);
    }
  }

  console.log('\nAll cleanup operations completed.');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
