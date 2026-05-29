import { input } from '@inquirer/prompts';
import { BatchInputPatchRequest } from '@oystehr/sdk';
import { Appointment, FhirResource } from 'fhir/r4b';
import { getAllFhirSearchPages } from '../../packages/utils/lib/fhir/getAllFhirSearchPages';
import {
  chunkThings,
  createOystehrClient,
  getPatchBinary,
  getPatchOperationToRemoveMetaTags,
  OTTEHR_TEST_DATA_HIDDEN_CODE,
  OTTEHR_TEST_DATA_HIDDEN_SYSTEM,
  OTTEHR_TEST_DATA_HIDDEN_TAG,
} from '../../packages/utils/lib/main';

/*
 "Put them back" — the reverse of soft-hiding e2e/smoke test data. Finds every Appointment that
 carries the reversible OTTEHR_TEST_DATA_HIDDEN tag and removes that tag, so the appointment
 reappears on the EHR tracking board. Because hiding only ever ADDS this tag (and never mutates
 clinical data), restoring is lossless.

 to run:
 npx env-cmd -f config/.env/{ENV}.json tsx scripts/restore-resources/unhide.ts
*/

const { FHIR_API, PROJECT_API, AUTH0_ENDPOINT, AUTH0_CLIENT, AUTH0_SECRET, AUTH0_AUDIENCE } = process.env;

for (const [name, value] of Object.entries({
  FHIR_API,
  PROJECT_API,
  AUTH0_ENDPOINT,
  AUTH0_CLIENT,
  AUTH0_SECRET,
  AUTH0_AUDIENCE,
})) {
  if (!value) {
    throw new Error(`${name} environment variable is required.`);
  }
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
  console.log('Restoring (un-hiding) soft-hidden test appointments...');

  const token = await getAuth0Token();
  const oystehr = createOystehrClient(token, FHIR_API!, PROJECT_API!);

  console.log(`Searching for Appointments tagged ${OTTEHR_TEST_DATA_HIDDEN_SYSTEM}|${OTTEHR_TEST_DATA_HIDDEN_CODE}...`);

  const hiddenAppointments = await getAllFhirSearchPages<Appointment>(
    {
      resourceType: 'Appointment',
      params: [{ name: '_tag', value: `${OTTEHR_TEST_DATA_HIDDEN_SYSTEM}|${OTTEHR_TEST_DATA_HIDDEN_CODE}` }],
    },
    oystehr
  );

  console.log(`Found ${hiddenAppointments.length} hidden appointment(s).`);
  if (hiddenAppointments.length === 0) {
    return;
  }

  hiddenAppointments.forEach((appointment) => console.log(`  - Appointment/${appointment.id}`));
  console.log('');
  console.log(`This will remove the ${OTTEHR_TEST_DATA_HIDDEN_SYSTEM} tag from the appointment(s) above,`);
  console.log('making them visible on the tracking board again.');
  await input({
    message: 'Type "yes" to confirm restore:',
    validate: (value) => value === 'yes' || 'Please type "yes" to confirm',
  });

  const patchRequests: BatchInputPatchRequest<FhirResource>[] = hiddenAppointments.map((appointment) =>
    getPatchBinary({
      resourceType: 'Appointment',
      resourceId: appointment.id!,
      patchOperations: [getPatchOperationToRemoveMetaTags(appointment, [OTTEHR_TEST_DATA_HIDDEN_TAG])],
    })
  );

  const chunkedRequests = chunkThings(patchRequests, 100);
  for (let i = 0; i < chunkedRequests.length; i++) {
    try {
      await oystehr.fhir.transaction({ requests: [...chunkedRequests[i]] });
      console.log(`Restored appointments, chunk ${i + 1} of ${chunkedRequests.length}`);
    } catch (e) {
      console.log(`Error restoring appointments, chunk ${i + 1} of ${chunkedRequests.length}: ${e}`, JSON.stringify(e));
    }
  }

  console.log('Done.');
}

main().catch((error) => {
  console.error('error', error);
  process.exit(1);
});
