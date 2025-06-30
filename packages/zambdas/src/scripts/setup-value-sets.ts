import { BatchInputPostRequest, BatchInputPutRequest, BatchInputRequest } from '@oystehr/sdk';
import { ValueSet } from 'fhir/r4b';
import fs from 'fs';
import path from 'path';
import { createOystehrClient, getAuth0Token } from '../shared';

const VALUE_SETS_DIR = '../../../../packages/utils/lib/deployed-resources/value-sets';

async function main(): Promise<void> {
  const env = process.argv[2];
  const envConfig = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  const token = await getAuth0Token(envConfig);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }

  console.log(`Setup value sets on "${env}" env`);

  try {
    const valueSetFiles = fs.readdirSync(path.join(__dirname, VALUE_SETS_DIR));
    const valueSets: ValueSet[] = await Promise.all(
      valueSetFiles.map(async (file) => JSON.parse(fs.readFileSync(path.join(__dirname, VALUE_SETS_DIR, file), 'utf8')))
    );

    const oystehrClient = createOystehrClient(token, envConfig);
    const existingValueSets = (
      await oystehrClient.fhir.search<ValueSet>({
        resourceType: 'ValueSet',
        params: [
          {
            name: 'url',
            value: valueSets.map((valueSet) => valueSet.url).join(','),
          },
        ],
      })
    ).unbundle();

    const requests: BatchInputRequest<ValueSet>[] = valueSets.flatMap((valueSet) => {
      const existing = existingValueSets.find((existingValueSet) => existingValueSet.url === valueSet.url);
      if (existing == null) {
        const request: BatchInputPostRequest<ValueSet> = {
          method: 'POST',
          url: '/ValueSet',
          resource: valueSet,
        };
        return request;
      }
      const request: BatchInputPutRequest<ValueSet> = {
        method: 'PUT',
        url: `/ValueSet/${existing.id}`,
        resource: {
          ...valueSet,
          id: existing.id,
        },
      };
      return request;
    });
    console.log(`Transaction requests:\n${JSON.stringify(requests, null, 2)}`);

    const oystehrResponse = await oystehrClient.fhir.transaction<ValueSet>({ requests });
    console.log(`Transaction response:\n${JSON.stringify(oystehrResponse, null, 2)}`);
  } catch (e) {
    console.log('Value sets set up failed: ', e);
  }
}

main().catch((error) => {
  console.log('error', error);
  throw error;
});
