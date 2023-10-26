import { FhirClient, ZambdaClient } from '@zapehr/sdk';
import { Operation } from 'fast-json-patch';
import { Subscription } from 'fhir/r4';
import fs from 'fs';
import fetch from 'node-fetch';
import devConfig from '../.env/dev.json';
// import testingConfig from '../.env/testing.json';
// import stagingConfig from '../.env/staging.json';
// import productionConfig from '../.env/production.json';
import { getAuth0Token } from '../src/shared';
import { fhirApiUrlFromAuth0Audience, projectApiUrlFromAuth0Audience } from './common';

interface DeployZambda {
  type: 'http_open' | 'http_auth' | 'subscription';
  event?: 'create' | 'update';
  criteria?: string;
}

const ZAMBDAS: { [name: string]: DeployZambda } = {
  VERSION: {
    type: 'http_open',
  },
  // 'CANCEL-APPOINTMENT': {
  //   type: 'http_open',
  // },
  // 'CHECK-IN': {
  //   type: 'http_open',
  // },
  // 'GET-LOCATIONS': {
  //   type: 'http_open',
  // },
  // 'GET-SLOTS-AVAILABILITY': {
  //   type: 'http_open',
  // },
  // 'REDOX-APPOINTMENT-UPDATED-WEBHOOK': {
  //   type: 'http_open',
  // },
  // 'REDOX-PATIENT-UPDATED-WEBHOOK': {
  //   type: 'http_open',
  // },
  // 'UPDATE-PAPERWORK': {
  //   type: 'http_open',
  // },
  // 'CHECK-PAPERWORK-STATUS': {
  //   type: 'http_auth',
  // },
  // 'CREATE-APPOINTMENT': {
  //   type: 'http_auth',
  // },
  // 'GET-APPOINTMENTS': {
  //   type: 'http_auth',
  // },
  // 'GET-PATIENTS': {
  //   type: 'http_auth',
  // },
  // 'UPDATE-APPOINTMENT': {
  //   type: 'http_auth',
  // },
  // 'PATIENT-READY-FOR-APPOINTMENT': {
  //   type: 'subscription',
  //   event: 'update',
  //   criteria: 'Appointment?status=fulfilled',
  // },
  // 'REDOX-PATIENT': {
  //   type: 'subscription',
  //   event: undefined,
  //   criteria: 'Patient',
  // },
};

const updateZambdas = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }
  const fhirClient = new FhirClient({
    apiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });
  const zambdaClient = new ZambdaClient({
    apiUrl: projectApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });
  console.log({
    apiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    accessToken: token,
  });

  console.log('Getting list of zambdas');
  const currentZambdas = await zambdaClient.getAllZambdas();

  // First check if any zambdas are not found
  for await (const zambda of Object.keys(ZAMBDAS)) {
    const currentZambda = ZAMBDAS[zambda];
    let currentDeployedZambda = currentZambdas.find(
      (tempZambda) => tempZambda.name === `Ottehr-${zambda.toLowerCase()}`
    );

    if (currentDeployedZambda) {
      console.log(`\nZambda ${zambda} is found with ID ${currentDeployedZambda.id}`);
    } else {
      console.log(`\nZambda ${zambda} is not found, creating it`);
      currentDeployedZambda = await zambdaClient.createZambda({
        name: `Ottehr-${zambda.toLowerCase()}`,
      });
      console.log(`Zambda ${zambda} with ID ${currentDeployedZambda.id}`);
    }

    await updateProjectZambda(
      currentDeployedZambda.id,
      zambda,
      currentZambda,
      config,
      projectApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
      token,
      fhirClient,
      zambdaClient
    );
  }
};

async function updateProjectZambda(
  zambdaId: string,
  zambdaName: string,
  zambda: DeployZambda,
  config: any,
  projectApiUrl: string,
  auth0Token: string,
  fhirClient: FhirClient,
  zambdaClient: ZambdaClient
): Promise<void> {
  // todo use zambda client https://github.com/masslight/zapehr/issues/2586
  const endpoint = `${projectApiUrl}/zambda/${zambdaId}/s3-upload`;

  console.log(`Getting S3 upload URL for zambda ${zambdaName}`);
  const zapehrResponse = await fetch(endpoint, {
    method: 'post',
    headers: {
      Authorization: `Bearer ${auth0Token}`,
      'x-zapehr-project-id': config.PROJECT_ID,
    },
  });

  if (!zapehrResponse.ok) {
    const zapehrResponseJson = await zapehrResponse.json();
    console.log(
      `status, ${zapehrResponse.status}, status text, ${
        zapehrResponse.statusText
      }, zapehrResponseJson, ${JSON.stringify(zapehrResponseJson)}`
    );
    throw Error('An error occurred during the zapEHR Zambda S3 URL request');
  }
  const s3Url = (await zapehrResponse.json())['signedUrl'];
  console.log(`Got S3 upload URL for zambda ${zambdaName}`);

  console.log('Uploading zip file to S3');
  // zip file names are lowercase with dashes
  const zipFile = zambdaName.toLowerCase().replace(/_/g, '-');
  const file = fs.readFileSync(`.dist/${zipFile}.zip`);
  const awsResponse = await fetch(s3Url, {
    method: 'put',
    body: file,
  });

  if (!awsResponse.ok) {
    const awsResponseJson = await awsResponse.json();
    console.log(
      `status, ${awsResponse.status}, status text, ${awsResponse.statusText}, awsResponseJson, ${JSON.stringify(
        awsResponseJson
      )}`
    );
    throw Error('An error occurred during the AWS upload zip file request');
  }
  console.log('Uploaded zip file to S3');

  console.log('Updating zambda');
  await zambdaClient.updateZambda({
    zambdaId: zambdaId,
    triggerMethod: zambda.type,
  });
  console.log('Updated zambda');

  if (zambda.type === 'subscription') {
    // if (!zambda.criteria) {
    //   console.log('Zambda is subscription type but does not have criteria');
    // }
    const endpoint = `zapehr-lambda:${zambdaId}`;
    const subscriptions: Subscription[] = await fhirClient.searchResources({
      resourceType: 'Subscription',
      searchParams: [
        {
          name: 'url',
          value: endpoint,
        },
      ],
    });
    const EXTENSION_URL = 'http://zapehr.com/fhir/r4/extension/SubscriptionTriggerEvent';
    let subscription: Subscription | null = null;
    if (subscriptions.length === 0) {
      console.log('Subscription not found, creating one');
      subscription = await fhirClient.createResource<Subscription>({
        resourceType: 'Subscription',
        status: 'active',
        reason: 'Ottehr',
        criteria: zambda.criteria || '',
        channel: {
          type: 'rest-hook',
          endpoint: endpoint,
        },
        extension: [
          {
            url: EXTENSION_URL,
            valueString: zambda.event,
          },
        ],
      });
      console.log(`Created subscription with ID ${subscription.id}`);
    } else {
      console.log(1);
      subscription = subscriptions[0];
      console.log(`Got subscription with ID ${subscription.id}`);
      const patchOperations: Operation[] = [];

      if (subscription.criteria !== zambda.criteria) {
        console.log(`criteria was ${subscription.criteria}, is now ${zambda.criteria}`);
        patchOperations.push({
          op: 'replace',
          path: '/criteria',
          value: zambda.criteria,
        });
      }
      let extension = subscription.extension;
      const extensionIndex = subscription.extension?.findIndex((tempExtension) => tempExtension.url === EXTENSION_URL);
      let extensionUpdated = false;
      if (extension && extensionIndex !== undefined && extensionIndex !== -1) {
        const event = extension[extensionIndex];
        if (event.valueString && !zambda.event) {
          console.log(`event was ${event.valueString}, is now undefined`);
          extension.splice(extensionIndex, 1);
          extensionUpdated = true;
        } else if (event.valueString !== zambda.event) {
          console.log(`event was ${event.valueString}, is now ${zambda.event}`);
          extension[extensionIndex].valueString = zambda.event;
          extensionUpdated = true;
        }
      } else if (!extension) {
        console.log(`subscription did not have extension, event is now ${zambda.event}`);
        extension = [
          {
            url: EXTENSION_URL,
            valueString: zambda.event,
          },
        ];
        extensionUpdated = true;
      } else {
        console.log(`subscription had extension but not event, event is now ${zambda.event}`);
        extension.push({
          url: EXTENSION_URL,
          valueString: zambda.event,
        });
        extensionUpdated = true;
      }

      if (extensionUpdated) {
        console.log('extension changed');
        patchOperations.push({
          op: subscription.extension ? 'replace' : 'add',
          path: '/extension',
          value: extension,
        });
      }

      if (patchOperations.length > 0) {
        console.log('Patching Subscription');
        await fhirClient.patchResource({
          resourceType: 'Subscription',
          resourceId: subscription.id || '',
          operations: patchOperations,
        });
      }
    }
  }
}

if (process.argv.length < 3) {
  console.log(
    'You must provide an environment and an api as command-line arguments, e.g.: pnpm deploy-zambdas testing'
  );
  process.exit();
}

// So we can use await
const main = async (): Promise<void> => {
  const env = process.argv[2];

  switch (env) {
    case 'dev':
      await updateZambdas(devConfig);
      break;
    // case 'testing':
    //   await setupZambda(testingConfig);
    //   break;
    // case 'staging':
    //   await setupZambda(stagingConfig);
    //   break;
    // case 'production':
    //   await setupZambda(productionConfig);
    //   break;
    default:
      throw new Error('¯\\_(ツ)_/¯ environment must match a valid zapEHR environment.');
  }
};

main().catch((error) => {
  console.log('error', error, error.issue);
});
