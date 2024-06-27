import { BatchInputDeleteRequest, BatchInputPostRequest } from '@zapehr/sdk';
import { Subscription } from 'fhir/r4';
import fs from 'fs';
import { getM2MClientToken } from '../src/shared';
import { createZambdaClient, performEffectWithEnvFile } from './common';
import { createFhirClient } from 'ottehr-utils';

interface SubscriptionDetils {
  criteria: string;
  reason: string;
  event?: 'create' | 'update';
}

interface DeployZambda {
  type: 'http_open' | 'http_auth' | 'subscription' | 'cron';
  subscriptionDetils?: SubscriptionDetils[];
  schedule?: {
    start?: string;
    end?: string;
    expression: string;
  };
  environments?: string[];
}

const ZAMBDAS: { [name: string]: DeployZambda } = {
  'GET-PATIENTS': {
    type: 'http_auth',
  },
  'GET-PAPERWORK': {
    type: 'http_auth',
  },
  'CREATE-PAPERWORK': {
    type: 'http_auth',
  },
  'UPDATE-PAPERWORK': {
    type: 'http_auth',
  },
  'CREATE-APPOINTMENT': {
    type: 'http_auth',
  },
  'GET-APPOINTMENTS': {
    type: 'http_auth',
  },
  'GET-SCHEDULE': {
    type: 'http_open',
  },
  'CANCEL-APPOINTMENT': {
    type: 'http_auth',
  },
  'GET-WAIT-STATUS': {
    type: 'http_open',
  },
  'JOIN-CALL': {
    type: 'http_open',
  },
  'VIDEO-CHAT-INVITES-CREATE': {
    type: 'http_auth',
  },
  'VIDEO-CHAT-INVITES-CANCEL': {
    type: 'http_auth',
  },
  'VIDEO-CHAT-INVITES-LIST': {
    type: 'http_auth',
  },
  'GET-PRESIGNED-FILE-URL': {
    type: 'http_open',
  },
  'CREATE-SAMPLE-APPOINTMENTS': {
    type: 'cron',
    schedule: {
      expression: 'cron(0 0 * * ? *)',
    },
  },
};

const updateZambdas = async (config: any): Promise<void> => {
  const token = await getM2MClientToken(config);
  console.log('token', token);
  const zambdaClient = await createZambdaClient(config);

  console.log(config, 'config');

  console.log('Getting list of zambdas');
  const currentZambdas = await zambdaClient.getAllZambdas();
  console.log('currentZambdas', currentZambdas);

  // First check if any zambdas are not found
  for await (const zambda of Object.keys(ZAMBDAS)) {
    const currentZambda = ZAMBDAS[zambda];
    console.log(config.ENVIRONMENT, 'config.ENVIRONMENT');
    console.log(currentZambda.environments, 'currentZambda.environments');
    if (currentZambda.environments && !currentZambda.environments.includes(config.ENVIRONMENT)) {
      console.log(`\nZambda ${zambda} is not run in ${config.ENVIRONMENT}`);
      continue;
    }

    let currentDeployedZambda = currentZambdas.find(
      (tempZambda) => tempZambda.name === `telemed-${zambda.toLowerCase()}`,
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

    await updateProjectZambda(currentDeployedZambda.id, zambda, currentZambda, config, token);
  }
};

async function updateProjectZambda(
  zambdaId: string,
  zambdaName: string,
  zambda: DeployZambda,
  config: any,
  token: string,
): Promise<void> {
  const projectApiUrl = 'https://project-api.zapehr.com/v1';
  // todo use zambda client https://github.com/masslight/zapehr/issues/2586
  const endpoint = `${projectApiUrl}/zambda/${zambdaId}/s3-upload`;

  console.log(`Getting S3 upload URL for zambda ${zambdaName}`);
  const zapehrResponse = await fetch(endpoint, {
    method: 'post',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-zapehr-project-id': config.PROJECT_ID,
    },
  });

  if (!zapehrResponse.ok) {
    const zapehrResponseJson = await zapehrResponse.json();
    console.log(
      `status, ${zapehrResponse.status}, status text, ${
        zapehrResponse.statusText
      }, zapehrResponseJson, ${JSON.stringify(zapehrResponseJson)}`,
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
        awsResponseJson,
      )}`,
    );
    throw Error('An error occurred during the AWS upload zip file request');
  }
  console.log('Uploaded zip file to S3');

  console.log('Updating zambda');
  //TODO: change this code back to zambdaClient.updateZambda() function, this is temporary fix
  const updateZambda = await fetch(`${projectApiUrl}/zambda/${zambdaId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      triggerMethod: zambda.type,
      schedule: zambda.schedule,
    }),
  });
  if (updateZambda.status !== 200) {
    throw new Error(`Error updating the zambda ${JSON.stringify(await updateZambda.json())}`);
  }
  console.log('Updated zambda');

  if (zambda.type === 'subscription') {
    if (zambda.subscriptionDetils === undefined) {
      console.log('Zambda is subscription type but does not have details on the subscription');
      return;
    }
    const endpoint = `zapehr-lambda:${zambdaId}`;
    const fhirClient = await createFhirClient(config);
    const subscriptionsSearch: Subscription[] = await fhirClient.searchResources({
      resourceType: 'Subscription',
      searchParams: [
        {
          name: 'url',
          value: endpoint,
        },
        {
          name: 'status',
          value: 'active',
        },
      ],
    });
    console.log(`${subscriptionsSearch.length} existing subscriptions found`);

    const EXTENSION_URL = 'http://zapehr.com/fhir/extension/SubscriptionTriggerEvent';

    const createSubscriptionRequests: BatchInputPostRequest[] = [];
    const deleteSubscriptionRequests: BatchInputDeleteRequest[] = [];

    // check existing subscriptions against current subscription details to determin if any should be deleted
    // if any events are changing, delete
    // if any existing criteria doesn't exist in the details array defined above, delete
    const subscriptionsNotChanging = subscriptionsSearch.reduce((acc: Subscription[], existingSubscription) => {
      const existingSubscriptionEvent = existingSubscription.extension?.find(
        (ext) => ext.url === EXTENSION_URL,
      )?.valueString;
      const subscriptionMatch = zambda.subscriptionDetils?.find((zambdaSubscritionDetail) => {
        const eventMatch = existingSubscriptionEvent === zambdaSubscritionDetail.event;
        const criteriaMatch = zambdaSubscritionDetail.criteria === existingSubscription.criteria;
        return eventMatch && criteriaMatch;
      });
      if (subscriptionMatch) {
        console.log(
          `subscription with criteria: '${subscriptionMatch.criteria}' and event: '${subscriptionMatch.event}' is not changing`,
        );
        acc.push(existingSubscription);
      } else {
        console.log(
          `subscription with criteria: '${existingSubscription.criteria}' and event: '${existingSubscriptionEvent}' is being deleted since the criteria/event is not contained in the updated subscription details array`,
        );
        const deleteRequest: BatchInputDeleteRequest = {
          method: 'DELETE',
          url: `/Subscription/${existingSubscription.id}`,
        };
        deleteSubscriptionRequests.push(deleteRequest);
      }
      return acc;
    }, []);

    // check current subscription details again existing subscriptions to determin if any should be created
    zambda.subscriptionDetils.forEach((subscriptionDetail) => {
      // if the subscription detail is found in subscriptions not chaning, do nothing
      const foundSubscription = subscriptionsNotChanging.find(
        (subscription) => subscription.criteria === subscriptionDetail.criteria,
      );
      // else create it
      if (!foundSubscription) {
        console.log(
          `Creating subscription with criteria: '${subscriptionDetail.criteria}' and event: '${subscriptionDetail.event}'`,
        );
        const extension = [];
        if (subscriptionDetail?.event) {
          extension.push({
            url: EXTENSION_URL,
            valueString: subscriptionDetail.event,
          });
        }
        const subscriptionResource: Subscription = {
          resourceType: 'Subscription',
          status: 'active',
          reason: subscriptionDetail.reason,
          criteria: subscriptionDetail.criteria,
          channel: {
            type: 'rest-hook',
            endpoint: endpoint,
          },
          extension: extension,
        };
        const subscriptionRequest: BatchInputPostRequest = {
          method: 'POST',
          url: '/Subscription',
          resource: subscriptionResource,
        };
        createSubscriptionRequests.push(subscriptionRequest);
      }
    });
    if (createSubscriptionRequests.length > 0 || deleteSubscriptionRequests.length > 0) {
      console.log('making subscription transaction request');
      await fhirClient.transactionRequest({
        requests: [...createSubscriptionRequests, ...deleteSubscriptionRequests],
      });
    }
    console.log(`Created ${createSubscriptionRequests.length} subscriptions`);
    console.log(`Deleted ${deleteSubscriptionRequests.length} subscriptions`);
    console.log(`${subscriptionsNotChanging.length} subscriptions are not changing`);
  }
}

if (process.argv.length < 3) {
  console.log(
    'You must provide an environment and an api as command-line arguments, e.g.: npm run deploy-zambdas testing',
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
