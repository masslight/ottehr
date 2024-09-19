import { BatchInputDeleteRequest, BatchInputPostRequest, FhirClient, ZambdaClient } from '@zapehr/sdk';
import { Subscription } from 'fhir/r4';
import fs from 'fs';
import devConfig from '../.env/development.json';
// import productionConfig from '../.env/production.json';
// import stagingConfig from '../.env/staging.json';
// import testingConfig from '../.env/testing.json';
// import trainingConfig from '../.env/training.json';
import { getAccessToken } from '../src/shared/auth';

interface SubscriptionDetails {
  criteria: string;
  reason: string;
  event?: 'create' | 'update';
}

interface DeployZambda {
  type: 'http_open' | 'http_auth' | 'subscription' | 'cron';
  subscriptionDetails?: SubscriptionDetails[];
  schedule?: {
    start?: string;
    end?: string;
    expression: string;
  };
  environments?: string[];
}

const ZAMBDAS: { [name: string]: DeployZambda } = {
  'TASK-SUBSCRIPTION': {
    type: 'subscription',
    subscriptionDetails: [
      {
        criteria: 'Task?code=urgent-care-email|&status=requested',
        reason: 'urgent care communication',
        event: 'create',
      },
      {
        criteria: 'Task?code=urgent-care-text|&status=requested',
        reason: 'urgent care communication',
        event: 'create',
      },
      {
        criteria: 'Task?code=urgent-care-update-appointment|&status=requested',
        reason: 'urgent care appointment update',
        event: 'create',
      },
    ],
  },
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
  'SEND-MESSAGE-CRON': {
    type: 'cron',
    schedule: {
      expression: 'cron(0,15,30,45 * * * ? *)', // every 0, 15, 30 and 45 minute mark
      // expression: 'cron(* * * * ? *)', // for testing, sends every minute
    },
    environments: ['dev', 'testing', 'staging', 'training', 'production'],
  },
  'GET-APPOINTMENT-DETAILS': {
    type: 'http_open',
  },
};

const fhirApiUrlFromAuth0Audience = (auth0Audience: string): string => {
  switch (auth0Audience) {
    case 'https://dev.api.zapehr.com':
      return 'https://dev.fhir-api.zapehr.com';
    case 'https://dev2.api.zapehr.com':
      return 'https://dev2.fhir-api.zapehr.com';
    case 'https://testing.api.zapehr.com':
      return 'https://testing.fhir-api.zapehr.com';
    case 'https://staging.api.zapehr.com':
      return 'https://staging.fhir-api.zapehr.com';
    case 'https://api.zapehr.com':
      return 'https://fhir-api.zapehr.com';
    default:
      throw `Unexpected auth0 audience value, could not map to a projectApiUrl. auth0Audience was: ${auth0Audience}`;
  }
};

// todo remove code duplication with configure-zapehr-secrets
const projectApiUrlFromAuth0Audience = (auth0Audience: string): string => {
  switch (auth0Audience) {
    case 'https://dev.api.zapehr.com':
      return 'https://dev.project-api.zapehr.com/v1';
    case 'https://dev2.api.zapehr.com':
      return 'https://dev2.project-api.zapehr.com/v1';
    case 'https://testing.api.zapehr.com':
      return 'https://testing.project-api.zapehr.com/v1';
    case 'https://staging.api.zapehr.com':
      return 'https://staging.project-api.zapehr.com/v1';
    case 'https://api.zapehr.com':
      return 'https://project-api.zapehr.com/v1';
    default:
      throw `Unexpected auth0 audience value, could not map to a projectApiUrl. auth0Audience was: ${auth0Audience}`;
  }
};

const updateZambdas = async (config: any): Promise<void> => {
  const token = await getAccessToken(config);

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
    if (currentZambda.environments && !currentZambda.environments.includes(config.ENVIRONMENT)) {
      console.log(`\nZambda ${zambda} is not run in ${config.ENVIRONMENT}`);
      continue;
    }

    let currentDeployedZambda = currentZambdas.find(
      (tempZambda) => tempZambda.name === `urgent-care-${zambda.toLowerCase()}`,
    );

    if (currentDeployedZambda) {
      console.log(`\nZambda ${zambda} is found with ID ${currentDeployedZambda.id}`);
    } else {
      console.log(`\nZambda ${zambda} is not found, creating it`);
      currentDeployedZambda = await zambdaClient.createZambda({
        name: `urgent-care-${zambda.toLowerCase()}`,
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
  const updateZambda = await fetch(`${projectApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE)}/zambda/${zambdaId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${auth0Token}`,
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
    if (zambda.subscriptionDetails === undefined) {
      console.log('Zambda is subscription type but does not have details on the subscription');
      return;
    }
    const endpoint = `zapehr-lambda:${zambdaId}`;
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
      const subscriptionMatch = zambda.subscriptionDetails?.find((zambdaSubscriptionDetail) => {
        const eventMatch = existingSubscriptionEvent === zambdaSubscriptionDetail.event;
        const criteriaMatch = zambdaSubscriptionDetail.criteria === existingSubscription.criteria;
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
    zambda.subscriptionDetails.forEach((subscriptionDetail) => {
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
  const env = process.argv[2];

  switch (env) {
    case 'dev':
      await updateZambdas(devConfig);
      break;
    // case 'testing':
    //   await updateZambdas(testingConfig);
    //   break;
    // case 'staging':
    //   await updateZambdas(stagingConfig);
    //   break;
    // case 'training':
    //   await updateZambdas(trainingConfig);
    //   break;
    // case 'production':
    //   await updateZambdas(productionConfig);
    //   break;
    default:
      throw new Error('¯\\_(ツ)_/¯ environment must match a valid zapEHR environment.');
  }
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
