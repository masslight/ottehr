import { ZambdaClient } from '@zapehr/sdk';
import fs from 'fs';
import { createZambdaClient } from '../src/shared';
import { main } from './shared';
import { Operation } from 'fast-json-patch';
import { Subscription } from 'fhir/r4';
import console from 'console';

type TriggerMethod = 'cron' | 'http_auth' | 'http_open' | 'subscription';
interface ZambdaParameters {
  triggerMethod: TriggerMethod;
  event?: 'create' | 'update';
  criteria?: string;
  schedule?: {
    end: string;
    expression: string;
    start: string;
  };
}

const ZAMBDAS: Record<string, ZambdaParameters> = {
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
    const name = `Ottehr-${zambdaName.toLowerCase()}`;
    const deployedZambda = deployedZambdas.find((zambda) => zambda.name === name);

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
      name: zambdaName,
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
  // zip file names are lowercase with dashes
  const zipFile = name.toLowerCase().replace(/_/g, '-');
  const file = fs.readFileSync(`.dist/${zipFile}.zip`);

  console.group('Upload zambda file');
  await client.uploadZambdaFile({
    zambdaId,
    file,
  });
  console.groupEnd();
  console.debug('Upload zambda file success');

  console.group('Update zambda');
  await client.updateZambda({
    zambdaId,
    triggerMethod,
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
