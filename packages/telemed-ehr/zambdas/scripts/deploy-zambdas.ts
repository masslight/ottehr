import { BatchInputDeleteRequest, BatchInputPostRequest, FhirClient, ZambdaClient } from '@zapehr/sdk';
import { Subscription } from 'fhir/r4';
import fs from 'fs';
import { COMMUNICATION_ISSUE_REPORT_CODE } from 'ehr-utils';
import { getAuth0Token } from '../src/shared';

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
  'DEACTIVATE-USER': {
    type: 'http_auth',
  },
  'GET-APPOINTMENTS': {
    type: 'http_auth',
  },
  'GET-TELEMED-APPOINTMENTS': {
    type: 'http_auth',
  },
  'CHANGE-TELEMED-APPOINTMENT-STATUS': {
    type: 'http_auth',
  },
  'GET-CHART-DATA': {
    type: 'http_auth',
  },
  'SAVE-CHART-DATA': {
    type: 'http_auth',
  },
  'DELETE-CHART-DATA': {
    type: 'http_auth',
  },
  'UPDATE-USER': {
    type: 'http_auth',
  },
  'INIT-TELEMED-SESSION': {
    type: 'http_auth',
  },
  'GET-USER': {
    type: 'http_auth',
  },
  'SAVE-PATIENT-INSTRUCTION': {
    type: 'http_auth',
  },
  'GET-PATIENT-INSTRUCTIONS': {
    type: 'http_auth',
  },
  'DELETE-PATIENT-INSTRUCTION': {
    type: 'http_auth',
  },
  'GET-CONVERSATION': {
    type: 'http_auth',
  },
  'GET-EMPLOYEES': {
    type: 'http_auth',
  },
  'NOTIFICATIONS-UPDATER': {
    type: 'cron',
    schedule: {
      expression: 'cron(*/5 * * * ? *)', // every 3 minutes
    },
    environments: ['dev', 'testing', 'staging', 'training'],
  },
  'SYNC-USER': {
    type: 'http_auth',
  },
  'ICD-SEARCH': {
    type: 'http_auth',
  },
  'COMMUNICATION-SUBSCRIPTION': {
    type: 'subscription',
    subscriptionDetails: [
      {
        criteria: `Communication?category=${COMMUNICATION_ISSUE_REPORT_CODE.system}|${COMMUNICATION_ISSUE_REPORT_CODE.code}&status=in-progress`,
        reason: 'PM - ML internal communication',
        event: 'create',
      },
    ],
  },
};

const updateZambdas = async (config: any): Promise<void> => {
  const token = await getAuth0Token(config);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }
  const fhirClient = new FhirClient({
    apiUrl: 'https://fhir-api.zapehr.com/r4',
    accessToken: token,
  });
  const zambdaClient = new ZambdaClient({
    apiUrl: 'https://project-api.zapehr.com/v1',
    accessToken: token,
  });
  console.log({
    apiUrl: 'https://fhir-api.zapehr.com/r4',
    accessToken: token,
  });

  try {
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
        (tempZambda) => tempZambda.name === `admin-${zambda.toLowerCase()}`,
      );

      if (currentDeployedZambda) {
        console.log(`\nZambda ${zambda} is found with ID ${currentDeployedZambda.id}`);
      } else {
        console.log(`\nZambda ${zambda} is not found, creating it`);
        currentDeployedZambda = await zambdaClient.createZambda({
          name: `admin-${zambda.toLowerCase()}`,
        });
        console.log(`Zambda ${zambda} with ID ${currentDeployedZambda.id}`);
      }

      try {
        await updateProjectZambda(
          currentDeployedZambda.id,
          zambda,
          currentZambda,
          config,
          'https://project-api.zapehr.com/v1',
          token,
          fhirClient,
        );
      } catch (err) {
        console.log(`Error trying to update project zambda ${zambda}`, err);
      }
    }
  } catch (e) {
    console.log('error deploying zambdas', JSON.stringify(e));
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
  const updateZambda = await fetch(`https://project-api.zapehr.com/v1/zambda/${zambdaId}`, {
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

    const EXTENSION_URL = 'http://zapehr.com/fhir/r4/extension/SubscriptionTriggerEvent';

    const createSubscriptionRequests: BatchInputPostRequest[] = [];
    const deleteSubscriptionRequests: BatchInputDeleteRequest[] = [];

    // check existing subscriptions against current subscription details to determin if any should be deleted
    // if any events are changing, delete
    // if any existing criteria doesn't exist in the details array defined above, delete
    const subscriptionsNotChanging = subscriptionsSearch.reduce((acc: Subscription[], existingSubscription) => {
      const existingSubscriptionEvent = existingSubscription.extension?.find(
        (ext) => ext.url === EXTENSION_URL,
      )?.valueString;
      const subscriptionMatch = zambda.subscriptionDetails?.find((zambdaSubscritionDetail) => {
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
  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  await updateZambdas(secrets);
};

main().catch((error) => {
  console.log('error', error, error.issue);
  throw error;
});
