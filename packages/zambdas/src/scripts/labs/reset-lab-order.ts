import { BatchInputRequest } from '@oystehr/sdk';
import { Identifier, ServiceRequest, Specimen } from 'fhir/r4b';
import fs from 'fs';
import { createOrderNumber, OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM } from 'utils';
import { createOystehrClient, getAuth0Token } from '../../shared';

const VALID_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];
const USAGE_STR = `Usage: npm run reset-lab-order [ORDER NUMBER] [${VALID_ENVS.join(' | ')}]\n`;

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

/**
 * Resets all tests in the provided order number. ServiceRequests are put back into draft, and a new order number is assigned,
 * allowing us to re-submit the same set of resources. Useful for LabCorp testing.
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
  const serviceRequests = (
    await oystehrClient.fhir.search<ServiceRequest>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: 'identifier',
          value: `${OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM}|${orderNumber}`,
        },
      ],
    })
  ).unbundle();

  console.log(`Found ${serviceRequests.length} ServiceRequests`);
  const newOrderNumber = createOrderNumber();
  console.log(`New order number is: ${newOrderNumber}`);

  const requests: BatchInputRequest<Specimen>[] = [];
  serviceRequests.forEach((sr) => {
    if (!sr.identifier) {
      console.error(`ServiceRequest/${sr.id} has no identifier but was returned in the fhir search`);
      process.exit(6);
    }
    console.log(`Updating ServiceRequest/${sr.id}`);

    const newIdentifiers: Identifier[] = [
      ...sr.identifier.filter((id) => id.value !== orderNumber && id.system !== OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM),
      {
        system: OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM,
        value: newOrderNumber,
      },
    ];

    requests.push({
      method: 'PATCH',
      url: `ServiceRequest/${sr.id}`,
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: 'draft',
        },
        {
          op: 'replace',
          path: '/identifier',
          value: newIdentifiers,
        },
      ],
    });
  });

  console.log(`\n\nThese are the ${requests.length} requests to make: ${JSON.stringify(requests)}\n`);

  if (!requests.length) {
    console.log('No requests to make. Exiting successfully.');
    process.exit(0);
  }

  try {
    const results = await oystehrClient.fhir.transaction({ requests });
    console.log(`Successfully patched ServiceRequests! Results: ${JSON.stringify(results)}`);
    process.exit(0);
  } catch (e) {
    console.error('Encountered error patching ServiceRequests');
    throw e;
  }
}
