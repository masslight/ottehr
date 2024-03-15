import fs from 'fs';
import { projectApiUrlFromAuth0Audience, createZambdaClient, performEffectWithEnvFile } from './common';
import { getM2MClientToken } from '../src/shared';

interface DeployZambda {
  type: 'http_open' | 'http_auth' | 'subscription';
  event?: 'create' | 'update';
  criteria?: string;
}

const ZAMBDAS: { [name: string]: DeployZambda } = {
  'GET-PATIENTS': {
    type: 'http_auth',
  },
  'GET-PAPERWORK': {
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
  'CANCEL-APPOINTMENT': {
    type: 'http_open',
  },
  'GET-WAIT-STATUS': {
    type: 'http_open',
  },
};

const updateZambdas = async (config: any): Promise<void> => {
  const token = await getM2MClientToken(config);
  const zambdaClient = await createZambdaClient(config);

  console.log('Getting list of zambdas');
  const currentZambdas = await zambdaClient.getAllZambdas();

  // First check if any zambdas are not found
  for await (const zambda of Object.keys(ZAMBDAS)) {
    const currentZambda = ZAMBDAS[zambda];
    let currentDeployedZambda = currentZambdas.find(
      (tempZambda) => tempZambda.name === `telemed-${zambda.toLowerCase()}`
    );

    if (currentDeployedZambda) {
      console.log(`\nZambda ${zambda} is found with ID ${currentDeployedZambda.id}`);
    } else {
      console.log(`\nZambda ${zambda} is not found, creating it`);
      currentDeployedZambda = await zambdaClient.createZambda({
        name: `telemed-${zambda.toLowerCase()}`,
      });
      console.log(`Zambda ${zambda} with ID ${currentDeployedZambda.id}`);
    }

    console.log('Uploading zambda file');
    const zipFile = zambda.toLowerCase().replace(/_/g, '-');
    const file = fs.readFileSync(`.dist/${zipFile}.zip`);
    zambdaClient.uploadZambdaFile({ zambdaId: currentDeployedZambda.id, file: new Blob([file]) });

    await updateProjectZambda(currentDeployedZambda.id, currentZambda, config, token);
  }
};

async function updateProjectZambda(zambdaId: string, zambda: DeployZambda, config: any, token: string): Promise<void> {
  console.log('Updating zambda');
  //TODO: change this code back to zambdaClient.updateZambda() function, this is temporary fix
  const updateZambda = await fetch(`${projectApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE)}/zambda/${zambdaId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      triggerMethod: zambda.type,
    }),
  });
  if (updateZambda.status !== 200) {
    throw new Error(`Error updating the zambda ${JSON.stringify(await updateZambda.json())}`);
  }
  console.log('Updated zambda');
}

if (process.argv.length < 3) {
  console.log(
    'You must provide an environment and an api as command-line arguments, e.g.: npm run deploy-zambdas testing'
  );
  process.exit();
}

// So we can use await
const main = async (): Promise<void> => {
  await performEffectWithEnvFile(updateZambdas);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
