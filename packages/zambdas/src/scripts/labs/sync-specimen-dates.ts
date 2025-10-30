import { BatchInputRequest } from '@oystehr/sdk';
import { ServiceRequest, Specimen } from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import { OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM } from 'utils';
import { createOystehrClient, getAuth0Token } from '../../shared';

const VALID_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];
const USAGE_STR = `Usage: npm run sync-lab-specimen-dates [ORDER NUMBER] [${VALID_ENVS.join(' | ')}]\n`;

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

/**
 * Syncs all specimens within a bundle to the same collectedDateTime. This makes LabCorp happy. Only an issue for testing; LabCorp doesn't care in prod.
 */
async function main(): Promise<void> {
  if (process.argv.length !== 4) {
    console.error(`exiting, incorrect number of arguments passed\n`);
    console.log(USAGE_STR);
    process.exit(1);
  }

  const orderNumber = process.argv[2];
  if (!orderNumber) {
    console.error('No order number passed');
    process.exit(5);
  }

  let ENV = process.argv[3].toLowerCase();
  ENV = ENV === 'dev' ? 'development' : ENV;

  if (!ENV) {
    console.error(`exiting, ENV variable must be populated`);
    console.log(USAGE_STR);
    process.exit(2);
  }

  let envConfig: any | undefined = undefined;

  try {
    envConfig = JSON.parse(fs.readFileSync(`.env/${ENV}.json`, 'utf8'));
  } catch (e) {
    console.error(`Unable to read env file. Error: ${JSON.stringify(e)}`);
    process.exit(3);
  }

  const token = await getAuth0Token(envConfig);

  if (!token) {
    console.error('Failed to fetch auth token.');
    process.exit(4);
  }

  const oystehrClient = createOystehrClient(token, envConfig);

  console.log(`Searching for ServiceRequests matching order number ${orderNumber} on env: ${ENV}`);
  const resources = (
    await oystehrClient.fhir.search<ServiceRequest | Specimen>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: 'identifier',
          value: `${OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM}|${orderNumber}`,
        },
        {
          name: '_include',
          value: 'ServiceRequest:specimen',
        },
      ],
    })
  ).unbundle();

  console.log(`Found ${resources.length} results`);

  // ensure all the ServiceRequests have status === draft
  const now = DateTime.now().toISO();
  const requests: BatchInputRequest<Specimen>[] = [];
  resources.forEach((res) => {
    if (res.resourceType === 'ServiceRequest' && res.status !== 'draft') {
      console.error(`ServiceRequest/${res.id} is in status=${res.status}. Cannot update specimen`);
      process.exit(6);
    }

    if (res.resourceType === 'Specimen') {
      console.log(`Setting Specimen/${res.id} collection.collectedDateTime to ${now}`);
      requests.push({
        method: 'PATCH',
        url: `Specimen/${res.id}`,
        operations: [
          {
            op: res.collection?.collectedDateTime ? 'replace' : 'add',
            path: '/collection/collectedDateTime',
            value: now,
          },
        ],
      });
    }
  });

  console.log(`\n\nThese are the ${requests.length} requests to make: ${JSON.stringify(requests)}\n`);

  if (!requests.length) {
    console.log('No requests to make. Exiting successfully.');
    process.exit(0);
  }

  try {
    const results = await oystehrClient.fhir.transaction({ requests });
    console.log(`Successfully patched Specimens! Results: ${JSON.stringify(results)}`);
    process.exit(0);
  } catch (e) {
    console.error('Encountered error patching Specimens');
    throw e;
  }
}
