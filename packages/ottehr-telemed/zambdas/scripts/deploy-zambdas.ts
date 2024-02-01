import { ZambdaClient } from '@zapehr/sdk';
import fs from 'fs';
import { createZambdaClient } from '../src/shared';
import { main } from './shared';

type TriggerMethod = 'cron' | 'http_auth' | 'http_open' | 'subscription';
interface ZambdaParameters {
  criteria?: string;
  event?: 'create' | 'update';
  schedule?: {
    end?: string;
    expression: string;
    start?: string;
  };
  triggerMethod: TriggerMethod;
}

const ZAMBDAS: Record<string, ZambdaParameters> = {
  /*
  E.g. a cron zambda that runs every other day starting on Jan 01, 2025 at noon UTC
  CRON_THING: {
    schedule: {
      expression: 'rate(2 days)',
      start: '2025-01-01T12:00',
    },
    triggerMethod: 'cron',
  },
 */
  CREATE_TELEMED_ROOM: {
    triggerMethod: 'http_open',
  },
  GET_PATIENT_QUEUE: {
    triggerMethod: 'http_auth',
  },
  GET_PROVIDER: {
    triggerMethod: 'http_open',
  },
  GET_SLUG_AVAILABILITY: {
    triggerMethod: 'http_open',
  },
  GET_TELEMED_TOKEN: {
    triggerMethod: 'http_open',
  },
  UPDATE_PROVIDER: {
    triggerMethod: 'http_open',
  },
  VERSION: {
    triggerMethod: 'http_open',
  },
};

const updateZambdas = async (config: any): Promise<void> => {
  const zambdaClient = await createZambdaClient(config);

  console.log('Getting list of zambdas');
  const deployedZambdas = await zambdaClient.getAllZambdas();

  // First check if any zambdas are not found
  for await (const zambdaName of Object.keys(ZAMBDAS)) {
    const zambdaToDeploy = ZAMBDAS[zambdaName];
    // Replace underscores with dashes to match zambda names
    const lowercaseName = zambdaName.toLowerCase().replace(/_/g, '-');
    const name = `Ottehr-${lowercaseName}`;
    let deployedZambda = deployedZambdas.find((zambda) => zambda.name === name);

    if (deployedZambda) {
      console.log(`\nZambda ${zambdaName} is found with ID ${deployedZambda.id}`);
    } else {
      console.log(`\nZambda ${zambdaName} is not found, creating it`);
      deployedZambda = await zambdaClient.createZambda({
        name,
      });
      console.log(`Zambda ${zambdaName} with ID ${deployedZambda.id}`);
    }

    await updateZambda({
      client: zambdaClient,
      name: lowercaseName,
      triggerMethod: zambdaToDeploy.triggerMethod,
      zambdaId: deployedZambda.id,
    });
  }
};

interface UpdateZambdaInput {
  client: ZambdaClient;
  name: string;
  triggerMethod: TriggerMethod;
  zambdaId: string;
}
async function updateZambda({ client, name, triggerMethod, zambdaId }: UpdateZambdaInput): Promise<void> {
  const file = fs.readFileSync(`.dist/${name}.zip`);

  console.group('Upload zambda file');
  await client.uploadZambdaFile({
    file,
    zambdaId,
  });
  console.groupEnd();
  console.debug('Upload zambda file success');

  console.group('Update zambda');
  await client.updateZambda({
    triggerMethod,
    zambdaId,
  });
  console.groupEnd();
  console.debug('Update zambda success');
}

if (process.argv.length < 3) {
  console.log(
    'You must provide an environment and an api as command-line arguments, e.g.: pnpm deploy-zambdas testing'
  );
  process.exit();
}

main(updateZambdas).catch((error) => {
  console.log('error', error, error.issue);
});
