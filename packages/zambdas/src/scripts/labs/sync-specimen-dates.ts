import { BatchInputRequest } from '@oystehr/sdk';
import { ServiceRequest, Specimen } from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import { OYSTEHR_LAB_ORDER_PLACER_ID_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { getAuth0Token } from '../../shared/getAuth0Token';
import { createClinicalOystehrClient } from '../../shared/helpers';

const VALID_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];
const USAGE_STR = `Usage: npm run sync-lab-specimen-dates [ORDER NUMBER] [${VALID_ENVS.join(' | ')}] [?timestamp]\n`;

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

/**
 * Syncs all specimens within a bundle to the same collectedDateTime. This makes LabCorp and Quest happy.
 * Only an issue for testing; neither care in prod.
 *
 * If given a value, will set the specimen to that value. Otherwise sets it to "now".
 *
 * The provided value can be an ISO string, or an HL7 format string, e.g.
 */
async function main(): Promise<void> {
  if (process.argv.length < 4) {
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

  const providedTimestamp = parseDateStringInput(process.argv[4] ?? '');
  console.log(`processed provided timestamp is: `, providedTimestamp);

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
  const newCollectionISO = providedTimestamp ?? DateTime.now().toISO();
  const requests: BatchInputRequest<Specimen>[] = [];
  resources.forEach((res) => {
    if (res.resourceType === 'Specimen') {
      console.log(`Setting Specimen/${res.id} collection.collectedDateTime to ${newCollectionISO}`);
      requests.push({
        method: 'PATCH',
        url: `Specimen/${res.id}`,
        operations: [
          {
            op: res.collection?.collectedDateTime ? 'replace' : 'add',
            path: '/collection/collectedDateTime',
            value: newCollectionISO,
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

const parseDateStringInput = (dateString: string): string | undefined => {
  // will use the offset specified if it exists, otherwise defaults to utc
  const isoAttempt = DateTime.fromISO(dateString, { setZone: true, zone: 'UTC' });
  if (isoAttempt.isValid) {
    console.log('Original iso attempt was valid. In zone:', isoAttempt.zone);
    return isoAttempt.toISO();
  }

  // Normalize timezone: e.g., -0000 → -00:00
  const normalized = dateString.replace(/([+-])(\d{2})(\d{2})$/, '$1$2:$3');

  // HL7 DTM patterns in decreasing precision
  const formats = [
    'yyyyMMddHHmmss.SSSZZ', // with fractional seconds and TZ
    'yyyyMMddHHmmssZZ',
    'yyyyMMddHHmmZZ',
    'yyyyMMddHHZZ',
    'yyyyMMddZZ',
    'yyyyMMZZ',
    'yyyyZZ',
    'yyyyMMddHHmmss.SSS', // without TZ
    'yyyyMMddHHmmss',
    'yyyyMMddHHmm',
    'yyyyMMddHH',
    'yyyyMMdd',
    'yyyyMM',
    'yyyy',
  ];

  for (const fmt of formats) {
    const dt = DateTime.fromFormat(normalized, fmt, { setZone: true, zone: 'UTC' });
    if (dt.isValid) {
      console.log('Matched format was: ', fmt);
      return dt.toISO();
    }
  }

  console.log(`Could not determine format for ${dateString}`);
  return undefined;
};
