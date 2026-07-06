import { Coverage } from 'fhir/r4b';
import { replaceOperation } from 'utils';
import { createClinicalOystehrClient, fetchAllPages, getPatchBinary } from '../packages/zambdas/src/shared';

/**
 * How to use (won't update coverages): npm run replace-payor-organization -- --project-id=some_project_id  --token=some_token --old-id=id_to_replace --new-id=id_to_insert
 * To actually update coverages add an explicit --dry-run=false
 */

function getArg(name: string): string {
  const appArg = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (!appArg) {
    throw new Error(`${name} is required`);
  }
  return appArg.split('=')[1];
}

function getOptionalArg(name: string): string | undefined {
  const appArg = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return appArg?.split('=')?.[1];
}

async function main(): Promise<void> {
  const oldPayorId = getArg('old-id');
  const newPayorId = getArg('new-id');
  const dryRun = getOptionalArg('dry-run') !== 'false';

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
        { name: 'payor', value: 'Organization/' + oldPayorId },
      ],
    });
    const resources = bundle.unbundle();
    coverages = coverages.concat(resources);
    console.log(`Fetched ${resources.length} more coverages (total: ${coverages.length})`);
    return bundle;
  }, 1000);

  console.log(`${coverages.length} Coverages to be updated:`);
  for (const coverage of coverages) {
    console.log('Coverage/' + coverage.id);
  }

  if (dryRun === false) {
    await oystehr.fhir.transaction<Coverage>({
      requests: coverages.map((coverage) => {
        return getPatchBinary<Coverage>({
          resourceId: coverage.id!,
          resourceType: 'Coverage',
          patchOperations: [
            replaceOperation('/payor', [
              ...coverage.payor.filter((p) => !p.reference?.includes(oldPayorId)),
              {
                reference: 'Organization/' + newPayorId,
              },
            ]),
          ],
        });
      }),
    });
    console.log('Coverages updated!');
  } else {
    console.log('DRY RUN! No coverages were updated');
  }
}

main().catch((error) => {
  console.error(`script failed:\n${JSON.stringify(error, null, 2)}`, error);
  process.exit(1);
});
