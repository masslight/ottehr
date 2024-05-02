import { ZambdaClient } from '@zapehr/sdk';
import fs from 'fs';
import { createZambdaClient, setupDeploy } from './shared';

type TriggerMethod = 'cron' | 'http_auth' | 'http_open' | 'subscription';
interface ZambdaParameters {
  criteria?: string;
  event?: 'create' | 'update';
  schedule?: {
    end?: string;
    expression: string;
    start?: string;
  };
  type: TriggerMethod;
}

const ZAMBDAS: Record<string, ZambdaParameters> = {
  'CANCEL-APPOINTMENT': {
    type: 'http_open',
  },
  'CHECK-IN': {
    type: 'http_open',
  },
  'GET-LOCATION': {
    type: 'http_open',
  },
  'UPDATE-PAPERWORK': {
    type: 'http_open',
  },
  'CREATE-APPOINTMENT': {
    type: 'http_auth',
  },
  'GET-APPOINTMENTS': {
    type: 'http_auth',
  },
  'GET-PATIENTS': {
    type: 'http_auth',
  },
  'GET-PAPERWORK': {
    type: 'http_open',
  },
  'UPDATE-APPOINTMENT': {
    type: 'http_open',
  },
  'GET-PRESIGNED-FILE-URL': {
    type: 'http_open',
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
      triggerMethod: zambdaToDeploy.type,
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
    file: new Blob([file]),
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

setupDeploy(updateZambdas).catch((error) => {
  console.log('error', error, error.issue);
});
