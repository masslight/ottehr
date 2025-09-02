import Oystehr, { BatchInputRequest, Bundle } from '@oystehr/sdk';
import { Identifier, Location, Organization } from 'fhir/r4b';
import fs from 'fs';
import { LAB_ACCOUNT_NUMBER_SYSTEM, OYSTEHR_LAB_GUID_SYSTEM } from 'utils';
import { createOystehrClient, getAuth0Token } from '../shared';

const VALID_ENVS = ['local', 'development', 'dev', 'testing', 'staging', 'demo', 'production', 'etc'];
const USAGE_STR = `Usage: npm run update-locations-for-lab-accounts [${VALID_ENVS.join(' | ')}]\n`;

main().catch((error) => {
  console.error('Script failed:', error);
  process.exit(1);
});

/**
 * Maps existing lab Organizations to Locations in a project. This enables each Location to order tests from the same Laboratory
 * using Location-specific account numbers. This should only be used to transition exsiting projects from the old model (one account number per Lab Org)
 * to the new model.
 */
async function main(): Promise<void> {
  if (process.argv.length !== 3) {
    console.error(`exiting, incorrect number of arguments passed\n`);
    console.log(USAGE_STR);
    process.exit(1);
  }

  let ENV = process.argv[2].toLowerCase();
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

  const requests: BatchInputRequest<Location>[] = [];

  // get all Locations (physical)
  // get all Lab Orgs
  const [locationsResponse, labOrgsResponse] = await Promise.all([
    getLocations(oystehrClient),
    getLabOrgs(oystehrClient),
  ]);

  const locations = locationsResponse
    .unbundle()
    .filter(
      (loc) =>
        !loc.extension?.some(
          (ext) =>
            ext.valueCoding?.code === 'vi' &&
            ext.valueCoding?.system === 'http://terminology.hl7.org/CodeSystem/location-physical-type'
        )
    );
  const labOrgs = labOrgsResponse.unbundle();
  console.log(`This is returned locations: ${JSON.stringify(locations)}`);
  console.log(`This is returned labOrgs: ${JSON.stringify(labOrgs)}`);

  // get the set of all the org info that needs to go on each location
  const labIdentifiers = labOrgs
    .map<Identifier | undefined>((org) => {
      const accountNumberIdentifier = org.identifier?.find((id) => id.system === LAB_ACCOUNT_NUMBER_SYSTEM);
      if (!accountNumberIdentifier || !accountNumberIdentifier.value) return undefined;
      return {
        ...accountNumberIdentifier,
        assigner: { type: 'Organization', reference: `Organization/${org.id}` },
      };
    })
    .filter((labId) => labId !== undefined);

  // for each location, figure out which identifiers are already present, grab a quick set difference and add them to the existing identifiers in a patch request
  locations.forEach((loc) => {
    const existingIdentifierAsStrings = new Set((loc.identifier ?? []).map((id) => makeIdentifierStringKey(id)));
    console.log(
      `\n\nThese are the ${loc.name}'s existing identifiers as strings: ${JSON.stringify([
        ...existingIdentifierAsStrings,
      ])}`
    );

    const identifiersToAdd: Identifier[] = [];
    labIdentifiers.forEach((labId) => {
      if (!existingIdentifierAsStrings.has(makeIdentifierStringKey(labId))) identifiersToAdd.push(labId);
    });
    if (identifiersToAdd.length) {
      console.log(`\n\nThese are the identifiers being added: ${JSON.stringify(identifiersToAdd, undefined, 2)}`);

      requests.push({
        method: 'PATCH',
        url: `Location/${loc.id}`,
        operations: [
          {
            op: loc.identifier ? 'replace' : 'add',
            path: '/identifier',
            value: loc.identifier ? [...loc.identifier, ...identifiersToAdd] : identifiersToAdd,
          },
        ],
      });
    }
  });

  console.log(`\n\nThese are the ${requests.length} requests to make: ${JSON.stringify(requests)}`);
  console.log(
    `\n\nMaking ${requests.length} patch requests across ${locations.length} locations to capture info from ${labOrgs.length} Lab Orgs`
  );

  if (!requests.length) {
    console.log('No requests to make. Exiting successfully.');
    process.exit(0);
  }

  try {
    const results = await oystehrClient.fhir.transaction({ requests });
    console.log(`Successfully patched Locations! Results: ${JSON.stringify(results)}`);
    process.exit(0);
  } catch (e) {
    console.error('Encountered error patching Locations');
    throw e;
  }
}

const getLocations = (oystehrClient: Oystehr): Promise<Bundle<Location>> => {
  return oystehrClient.fhir.search<Location>({
    resourceType: 'Location',
    params: [
      {
        name: 'status',
        value: 'active',
      },
    ],
  });
};

const getLabOrgs = (oystehrClient: Oystehr): Promise<Bundle<Organization>> => {
  return oystehrClient.fhir.search<Organization>({
    resourceType: 'Organization',
    params: [
      {
        name: 'identifier',
        value: `${OYSTEHR_LAB_GUID_SYSTEM}|`,
      },
      {
        name: 'identifier',
        value: `${LAB_ACCOUNT_NUMBER_SYSTEM}|`,
      },
    ],
  });
};

const makeIdentifierStringKey = (id: Identifier): string => {
  return `${id.system}|${id.value}|${id.assigner?.reference}`;
};
