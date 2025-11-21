import Oystehr from '@oystehr/sdk';
import { Organization } from 'fhir/r4b';
import fs from 'fs';
import { getAuth0Token } from '../shared';
import { fhirApiUrlFromAuth0Audience } from './helpers';

async function getPayerOrganizations(oystehr: Oystehr): Promise<Organization[]> {
  let currentIndex = 0;
  let total = 1;
  const result: Organization[] = [];
  while (currentIndex < total) {
    const bundledResponse = await oystehr.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        {
          name: 'name',
          value: 'Default Billing Provider',
        },
        {
          name: '_offset',
          value: currentIndex,
        },
        {
          name: '_count',
          value: 1000,
        },
        {
          name: '_total',
          value: 'accurate',
        },
      ],
    });
    total = bundledResponse.total || 0;
    const unbundled = bundledResponse.unbundle();
    result.push(...unbundled);
    currentIndex += unbundled.length;
  }

  console.log('Found', result.length, 'organizations');
  console.log(result);
  return result;
}

async function main(): Promise<void> {
  const env = process.argv[2];
  if (!env) {
    throw new Error('Environment argument is required.');
  }
  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  const token = await getAuth0Token(secrets);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }

  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(secrets.AUTH0_AUDIENCE),
  });

  const organizations = await getPayerOrganizations(oystehr);
  console.log(organizations.length);

  //   let currentIndex = 0;
  //   let total = organizations.length;
  //   const batchSize = 50;

  //   while (currentIndex < total) {
  //     const endIndex = Math.min(currentIndex + batchSize, total);
  //     const batch = organizations.slice(currentIndex, endIndex);

  //     console.log(`Removing batch ${Math.floor(currentIndex / batchSize) + 1}: organizations ${currentIndex + 1}-${endIndex} of ${total}`);

  //     // Process batch in parallel
  //     const deletePromises = batch.map(org =>
  //       oystehr.fhir.delete<Organization>({
  //         resourceType: 'Organization',
  //         id: org.id!,
  //       })
  //     );

  //     await Promise.all(deletePromises);
  //     currentIndex = endIndex;
  //   }
}

main()
  .then(() => console.log('Completed processing CSV file'))
  .catch((error) => {
    console.error(error);
    throw error;
  });
