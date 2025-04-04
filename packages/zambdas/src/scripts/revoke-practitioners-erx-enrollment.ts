import Oystehr, { BatchInputRequest } from '@oystehr/sdk';
import { Extension, Practitioner } from 'fhir/r4b';
import * as fs from 'fs';
import { getPatchBinary } from 'utils';
import { FHIR_EXTENSION } from 'utils';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

async function getPractitionersBatch(oystehr: Oystehr, offset: number, count: number): Promise<Practitioner[]> {
  const practitioners = (
    await oystehr.fhir.search<Practitioner>({
      resourceType: 'Practitioner',
      params: [
        {
          name: '_count',
          value: `${count}`,
        },
        {
          name: '_offset',
          value: `${offset}`,
        },
      ],
    })
  ).unbundle();

  return practitioners;
}

async function main(): Promise<void> {
  const env = process.argv[2];
  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });
  const BATCH_SIZE = 100;
  let length = -1;

  for (let i = 0; length !== 0; i += BATCH_SIZE) {
    console.log(`Processing practitioners ${i / BATCH_SIZE} batch`);
    const batch = await getPractitionersBatch(oystehr, i, BATCH_SIZE);
    const batchRequests: BatchInputRequest<Practitioner>[] = [];
    length = batch.length;
    if (length >= 0) {
      batch.forEach((practitioner) => {
        const extIndex = practitioner.extension?.findIndex(
          (ext) => ext.url === FHIR_EXTENSION.Practitioner.isEnrolledInPhoton.url
        );
        const ext = practitioner?.extension?.[extIndex || 0];
        if (ext && ext.valueBoolean === true) {
          console.log(
            `Will update practitioner with id: ${practitioner.id}, name: ${practitioner.name?.[0]?.given?.[0]} ${practitioner.name?.[0]?.family}`
          );
          batchRequests.push(
            getPatchBinary({
              resourceId: practitioner.id!,
              resourceType: 'Practitioner',
              patchOperations: [
                {
                  op: 'replace',
                  path: `/extension/${extIndex}`,
                  value: <Extension>{ url: FHIR_EXTENSION.Practitioner.isEnrolledInPhoton.url, valueBoolean: false },
                },
              ],
            })
          );
        }
      });
      if (batchRequests.length) {
        console.log('Performing updates for this batch.');
        const result = await oystehr.fhir.batch({ requests: batchRequests });
        console.debug(`Response: ${JSON.stringify(result)}`);
      }
    }
  }
}

main()
  .then(() => console.log('Completed processing practitioners'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
