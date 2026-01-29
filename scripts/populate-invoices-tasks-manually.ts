import Oystehr from '@oystehr/sdk';
import { CandidApiClient, CandidApiEnvironment } from 'candidhealth';
import { InventoryRecord } from 'candidhealth/api/resources/patientAr/resources/v1';
import fs from 'fs';
import { DateTime } from 'luxon';
import { getCandidInventoryPagesRecursive } from 'utils';
import { createTaskForEncounter, getEncountersWithoutTaskFhir } from 'zambdas/src/cron/create-invoices-tasks';

async function createOyst(zambdaEnv: Record<string, string>, token: string): Promise<Oystehr> {
  const oystehr = new Oystehr({
    accessToken: token,
    projectId: zambdaEnv.PROJECT_ID,
    services: {
      fhirApiUrl: zambdaEnv.FHIR_API,
      projectApiUrl: zambdaEnv.PROJECT_API,
    },
  });
  console.log(`Created Oystehr client`);
  return oystehr;
}

async function createCandid(
  zambdaEnv: Record<string, string>,
  candidEnv: CandidApiEnvironment
): Promise<CandidApiClient> {
  const candidClientId = zambdaEnv.CANDID_CLIENT_ID || '';
  const candidClientSecret = zambdaEnv.CANDID_CLIENT_SECRET || '';
  console.log(`Creating Candid client`);

  return new CandidApiClient({
    clientId: candidClientId,
    clientSecret: candidClientSecret,
    environment: candidEnv,
  });
}

async function main(): Promise<void> {
  const environment: 'local' | 'development' | 'testing' | 'staging' | 'production' = 'testing';
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const candidEnv = environment === 'production' ? CandidApiEnvironment.Production : CandidApiEnvironment.Staging;
  const startFrom = DateTime.fromFormat('01/14/2026', 'MM/dd/yyyy');
  const endOn = startFrom.plus({ weeks: 2 });
  const token = '<a-key-from-ottehr-console-here>';
  const maxCandidPages = 18;

  console.log(`Reading environment variables from packages/zambdas/.env/${environment}.json.`);
  const zambdaEnv: Record<string, string> = JSON.parse(
    fs.readFileSync(`packages/zambdas/.env/${environment}.json`, 'utf8')
  );
  const oystehr = await createOyst(zambdaEnv, token);
  const candid = await createCandid(zambdaEnv, candidEnv);

  let candidClaims = await getAllCandidClaims(candid, startFrom, maxCandidPages);

  candidClaims = candidClaims.sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  candidClaims = candidClaims.filter((claim) => DateTime.fromJSDate(claim.timestamp) <= endOn);

  let firstDate = '';
  let lastDate = '';
  if (candidClaims.length > 0) {
    firstDate = DateTime.fromJSDate(candidClaims[0].timestamp).toFormat('MM/dd/yyyy') ?? '';
    const lastClaim = candidClaims[candidClaims.length - 1];
    lastDate = DateTime.fromJSDate(lastClaim.timestamp).toFormat('MM/dd/yyyy') ?? '';
  }
  console.log(`Found ${candidClaims.length} claims between ${firstDate} and ${lastDate}`);

  const pkgs = await getEncountersWithoutTaskFhir(oystehr, candid, candidClaims);
  console.log('Encounters without a task and positive amount: ', pkgs.length);

  const promises: Promise<void>[] = [];
  pkgs.forEach((encounter) => {
    promises.push(createTaskForEncounter(oystehr, encounter));
  });
  await Promise.all(promises);
}

async function getAllCandidClaims(
  candid: CandidApiClient,
  sinceDate: DateTime,
  maxPages?: number
): Promise<InventoryRecord[]> {
  const inventoryPages = await getCandidInventoryPagesRecursive({
    candid,
    claims: [],
    limitPerPage: 100,
    pageCount: 0,
    maxPages,
    onlyInvoiceable: true,
    since: sinceDate,
  });

  const claimsFetched = inventoryPages?.claims;
  console.log('fetched claims: ', claimsFetched?.length);
  if (claimsFetched?.length && claimsFetched.length > 0) {
    return claimsFetched;
  }
  return [];
}

main().catch((error) => {
  console.log('Error: ', error);
});
