import { Coverage } from 'fhir/r4b';
import { createClinicalOystehrClient, fetchAllPages } from '../packages/zambdas/src/shared';

/**
 * How to use: npm run find-deleted-referenced-payors -- --project-id=some_project_id  --token=some_token
 */

function getArg(name: string): string {
  const appArg = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!appArg) {
    throw new Error(`${name} is required`);
  }
  return appArg.split('=')[1];
}

async function main(): Promise<void> {
  const oystehr = createClinicalOystehrClient(
    getArg('token'),
    {},
    {
      projectId: getArg('project-id'),
      services: {
        fhirApiUrl: 'https://fhir-api.zapehr.com',
      },
    }
  );

  let coverages: Coverage[] = [];
  await fetchAllPages(async (offset, count) => {
    console.log(`Fetching coverages offset=${offset}, count=${count}`);
    const bundle = await oystehr.fhir.search<Coverage>({
      resourceType: 'Coverage',
      params: [
        { name: '_count', value: count.toString() },
        { name: '_offset', value: offset.toString() },
      ],
    });
    const resources = bundle.unbundle();
    coverages = coverages.concat(resources);
    console.log(`Fetched ${resources.length} more coverages (total: ${coverages.length})`);
    return bundle;
  }, 1000);

  const payors: Set<string> = new Set<string>();
  for (const coverage of coverages) {
    coverage.payor?.forEach((payor) => {
      if (payor?.reference && payor.reference.startsWith('Organization')) {
        payors.add(payor.reference);
      }
    });
  }

  console.log('All organization payors:');
  for (const payor of payors) {
    console.log(payor);
  }

  const deleted: string[] = [];

  for (const payor of payors) {
    try {
      await oystehr.fhir.get({
        resourceType: 'Organization',
        id: payor.split('/')[1],
      });
      console.log(payor + ' - OK');
    } catch (e: any) {
      if (e.code === 410) {
        console.log(payor + ' - GONE!');
        deleted.push(payor);
      } else {
        throw e;
      }
    }
  }

  console.log('All DELETED organization payors:');
  console.log(deleted);
}

main().catch((error) => {
  console.error(`script failed:\n${JSON.stringify(error, null, 2)}`, error);
  process.exit(1);
});
