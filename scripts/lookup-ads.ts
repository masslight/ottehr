import Oystehr from '@oystehr/sdk';
import { ActivityDefinition } from 'fhir/r4b';

async function main(): Promise<void> {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error('Please provide a project ID');
    process.exit(1);
  }
  const accessToken = process.argv[3];
  if (!accessToken) {
    console.error('Please provide an access token');
    process.exit(1);
  }

  const oystehr = new Oystehr({
    accessToken,
    projectId,
  });

  const ads = (
    await oystehr.fhir.search<ActivityDefinition>({
      resourceType: 'ActivityDefinition',
      params: [
        {
          name: '_count',
          value: 1000,
        },
        {
          name: 'status',
          value: 'active',
        },
      ],
    })
  ).unbundle();

  console.log('');
  console.log(`Found ${ads.length} ActivityDefinitions:`);
  const byUrl = ads.reduce(
    (acc, ad) => {
      if (!ad.url || !ad.url.startsWith('https://ottehr.com/FHIR/InHouseLab/ActivityDefinition')) return acc;
      if (!acc[ad.url]) {
        acc[ad.url] = ad;
        return acc;
      }
      const oldVersion = parseInt(acc[ad.url].version ?? '0', 10);
      const newVersion = parseInt(ad.version ?? '0', 10);
      if (newVersion > oldVersion) {
        acc[ad.url] = ad;
      }
      return acc;
    },
    {} as Record<string, ActivityDefinition>
  );
  Object.entries(byUrl).forEach(([_, ad]) => {
    console.log('');
    console.log(JSON.stringify(ad, null, 2));
  });
}

main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error in script execution:', error);
    process.exit(1);
  });
