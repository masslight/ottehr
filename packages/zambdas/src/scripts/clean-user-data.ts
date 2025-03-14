import { Person } from 'fhir/r4b';
import { getPatchBinary } from 'utils';
import { performEffectWithEnvFile } from 'zambda-utils';
import { createOystehrClientFromConfig } from './helpers';

const cleanUserData = async (config: any): Promise<void> => {
  if (process.argv[2] === 'production') {
    throw Error('This script is forbidden in production mode');
  }

  const oystehr = await createOystehrClientFromConfig(config);

  const phone = process.argv[3];

  const resources = (
    await oystehr.fhir.search<Person>({
      resourceType: 'Person',
      params: [{ name: 'telecom', value: phone }],
    })
  ).unbundle();

  for (const person of resources) {
    if (!person.id) {
      break;
    }

    await oystehr.fhir.batch({
      requests: [
        getPatchBinary({
          resourceId: person.id,
          resourceType: 'Person',
          patchOperations: [{ op: 'remove', path: '/link' }],
        }),
      ],
    });
  }

  console.log('User data clear');
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile('ehr', cleanUserData);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});

// tsx ./scripts/clean-user-data.ts <env> <phone>
