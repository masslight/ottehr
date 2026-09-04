import { BatchInputRequest } from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { FhirResource, Identifier, ServiceRequest, Task } from 'fhir/r4b';
import fs from 'fs';
import { createOrderNumber } from 'utils/lib/helpers/labs/helpers';
import { OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { parseTaskPST } from '../../ehr/lab/shared/labs';
import { getAuth0Token } from '../../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../../shared/helpers';

const VALID_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];
const USAGE_STR = `Usage: npm run reset-lab-order [ORDER NUMBER] [${VALID_ENVS.join(' | ')}] [resetCollection]\n`;

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

/**
 * Resets all tests in the provided order number. ServiceRequests are put back into draft, and a new order number is assigned,
 * allowing us to re-submit the same set of resources. Useful for LabCorp testing.
 *
 * If resetCollection is passed (and isn't "false"), the PSC "collect sample" Task (PST) for each ServiceRequest is also
 * reset to "ready" with its owner and relevantHistory cleared, so specimen collection can be redone from scratch.
 */
async function main(): Promise<void> {
  if (process.argv.length !== 4 && process.argv.length !== 5) {
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

  const resetCollectionArg = process.argv[4];
  const resetCollection = resetCollectionArg !== undefined && resetCollectionArg.toLowerCase() !== 'false';

  let envConfig: any | undefined = undefined;

  try {
    envConfig = JSON.parse(fs.readFileSync(`../../config/.env/${ENV}.json`, 'utf8'));
  } catch (e) {
    console.error(`Unable to read env file. Error: ${JSON.stringify(e)}`);
    process.exit(3);
  }

  const token = await getAuth0Token(envConfig);

  if (!token) {
    console.error('Failed to fetch auth token.');
    process.exit(4);
  }

  const oystehrClient = createClinicalOystehrClient(token, envConfig);

  console.log(`Searching for ServiceRequests matching order number ${orderNumber} on env: ${ENV}`);
  const searchResults = (
    await oystehrClient.fhir.search<ServiceRequest | Task>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: 'identifier',
          value: `${OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM}|${orderNumber}`,
        },
        {
          name: '_revinclude',
          value: 'Task:based-on',
        },
      ],
    })
  ).unbundle();

  const serviceRequests = searchResults.filter(
    (resource): resource is ServiceRequest => resource.resourceType === 'ServiceRequest'
  );
  const tasks = searchResults.filter((resource): resource is Task => resource.resourceType === 'Task');

  console.log(`Found ${serviceRequests.length} ServiceRequests`);
  const newOrderNumber = createOrderNumber();
  console.log(`New order number is: ${newOrderNumber}`);

  const requests: BatchInputRequest<FhirResource>[] = [];
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

  if (resetCollection) {
    serviceRequests.forEach((sr) => {
      if (!sr.id) return;

      const pstTask = parseTaskPST(tasks, sr.id);
      if (!pstTask) {
        console.log(`No PST "collect sample" Task found for ServiceRequest/${sr.id}, skipping collection reset`);
        return;
      }

      console.log(`Resetting collection for Task/${pstTask.id}`);

      const operations: Operation[] = [
        {
          op: 'replace',
          path: '/status',
          value: 'ready',
        },
      ];
      if (pstTask.owner) {
        operations.push({ op: 'remove', path: '/owner' });
      }
      if (pstTask.relevantHistory) {
        operations.push({ op: 'remove', path: '/relevantHistory' });
      }

      requests.push({
        method: 'PATCH',
        url: `Task/${pstTask.id}`,
        operations,
      });
    });
  }

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
