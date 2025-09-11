import Oystehr, { BatchInputDeleteRequest, BatchInputPostRequest, ZambdaCreateParams } from '@oystehr/sdk';
import { Subscription } from 'fhir/r4b';
import fs from 'fs';
import { SubscriptionZambdaDetails } from 'utils';
import ottehrSpec from '../../../../config/oystehr/ottehr-spec.json';
import { getAuth0Token } from '../shared';

interface DeployZambda {
  type: 'http_open' | 'http_auth' | 'subscription' | 'cron';
  runtime: ZambdaCreateParams['runtime'];
  subscriptionDetails?: SubscriptionZambdaDetails[];
  schedule?: {
    start?: string;
    end?: string;
    expression: string;
  };
  environments?: string[];
}

const ZAMBDAS: { [name: string]: DeployZambda } = {};

Object.entries(ottehrSpec.zambdas).forEach(([_key, spec]) => {
  const anySpec = spec as any;
  if (spec.type !== 'http_open' && spec.type !== 'http_auth' && spec.type !== 'subscription' && spec.type !== 'cron') {
    throw new Error('Invalid zambda type found in spec file. Must be one of: http_open, http_auth, subscription, cron');
  }

  const zambdaDefinition: DeployZambda = {
    type: spec.type,
    runtime: spec.runtime as ZambdaCreateParams['runtime'],
  };

  if (spec.type === 'subscription') {
    if (anySpec.subscription === undefined) {
      throw new Error('Subscription zambda must have subscription details');
    }
    if (anySpec.subscription.criteria === undefined) {
      throw new Error('Subscription zambda must have the subscription.criteria property');
    }
    if (anySpec.subscription.reason === undefined) {
      throw new Error('Subscription zambda must have the subscription.reason property');
    }

    zambdaDefinition.subscriptionDetails = [anySpec.subscription];
  } else if (spec.type === 'cron') {
    if (anySpec.schedule === undefined) {
      throw new Error('Cron zambda must have the schedule property');
    }
    if (anySpec.schedule.expression === undefined) {
      throw new Error('Cron zambda must have the schedule.expression property');
    }

    zambdaDefinition.schedule = {
      expression: anySpec.schedule.expression,
    };
  }

  const allowableEnvironments = ['staging', 'demo'];
  if (!allowableEnvironments.includes(process.env.ENVIRONMENT as string) && spec.name === 'SEND-MESSAGE-CRON') {
    console.log(
      'TODO Skipping zambda because we only want it in these envs:',
      allowableEnvironments.join(', '),
      spec.name
    );
    return;
  }

  ZAMBDAS[spec.name] = zambdaDefinition;
});

const RENAMED_ZAMBDAS: { [newName: string]: string } = {};

const DELETED_ZAMBDAS: string[] = [];

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

// todo remove code duplication with configure-secrets
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

const updateZambdas = async (config: any, selectedTriggerMethod: string | undefined): Promise<void> => {
  const token = await getAuth0Token(config);

  if (!token) {
    throw new Error('Failed to fetch auth token.');
  }
  const oystehr = new Oystehr({
    accessToken: token,
    fhirApiUrl: fhirApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
    projectApiUrl: projectApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
  });

  console.log('Getting list of zambdas');
  const currentZambdas = (await oystehr.zambda.list()).filter((zambda) => {
    if (selectedTriggerMethod) {
      return zambda.triggerMethod === selectedTriggerMethod;
    }
    return true;
  });

  const zambdasToDeployEntries = Object.entries(ZAMBDAS).filter(([__key, zambda]) => {
    if (selectedTriggerMethod) {
      if (zambda.type !== selectedTriggerMethod) {
        return false;
      }
    }
    return true;
  });
  const zambdasToDeploy = Object.fromEntries(zambdasToDeployEntries);

  // First check if any zambdas are not found
  for await (const zambda of Object.keys(zambdasToDeploy)) {
    const currentZambda = zambdasToDeploy[zambda];
    if (currentZambda.environments && !currentZambda.environments.includes(config.ENVIRONMENT)) {
      console.log(`\nZambda ${zambda} is not run in ${config.ENVIRONMENT}`);
      continue;
    }

    const zambdaName = `${zambda.toLowerCase()}`;

    let nameToFind = RENAMED_ZAMBDAS[zambda] ?? zambda;
    if (RENAMED_ZAMBDAS[zambda]) {
      console.log(`\nLooking for existing zambda named ${nameToFind} ;to be replaced with ${zambdaName}`);
    }

    let currentDeployedZambda = currentZambdas.find((tempZambda) => {
      nameToFind = `${nameToFind.toLowerCase()}`;
      return tempZambda.name === nameToFind || tempZambda.name === zambdaName;
    });

    if (currentDeployedZambda) {
      console.log(`\nZambda ${zambda} is found with ID ${currentDeployedZambda.id}`);
    } else {
      console.log(`\nZambda ${zambda} is not found, creating it`);
      currentDeployedZambda = await oystehr.zambda.create({
        name: zambdaName,
        runtime: currentZambda.runtime,
      });
      console.log(`Zambda ${zambda} with ID ${currentDeployedZambda.id}`);
    }

    await updateProjectZambda(
      currentDeployedZambda.id,
      zambdaName,
      currentZambda,
      config,
      projectApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE),
      token,
      oystehr
    );
  }
  for await (const zambda of DELETED_ZAMBDAS) {
    const currentDeployedZambda = currentZambdas.find((tempZambda) => {
      return tempZambda.name === `${zambda.toLowerCase()}`;
    });

    console.log('checking for zambda to delete', zambda, currentDeployedZambda?.id);

    if (currentDeployedZambda) {
      console.log(`\nDELETING Zambda ${zambda} with ID ${currentDeployedZambda.id}`);
      await oystehr.zambda.delete({ id: currentDeployedZambda.id });
      if (currentDeployedZambda.triggerMethod === 'subscription') {
        const subscriptionResponse = (
          await oystehr.fhir.search<Subscription>({
            resourceType: 'Subscription',
            params: [
              {
                name: 'url',
                value: `zapehr-lambda:${currentDeployedZambda.id}`,
              },
            ],
          })
        ).unbundle();
        const subscriptions = subscriptionResponse ?? [];
        const deleteOperations: BatchInputDeleteRequest[] = [];
        for (const subscription of subscriptions) {
          if (subscription && subscription.id) {
            deleteOperations.push({
              method: 'DELETE',
              url: `Subscription/${subscription.id}`,
            });
          }
        }
        console.log('batch deleting subscriptions: ', JSON.stringify(deleteOperations.map((op) => op.url)));
        await oystehr.fhir.transaction({ requests: deleteOperations });
      }
    }
  }
};

async function updateProjectZambda(
  zambdaId: string,
  zambdaName: string,
  zambda: DeployZambda,
  config: any,
  projectApiUrl: string,
  auth0Token: string,
  oystehr: Oystehr
): Promise<void> {
  // todo use zambda client https://github.com/masslight/zapehr/issues/2586
  const endpoint = `${projectApiUrl}/zambda/${zambdaId}/s3-upload`;

  console.log(`Getting S3 upload URL for zambda ${zambdaName}`);
  const oystehrResponse = await fetch(endpoint, {
    method: 'post',
    headers: {
      Authorization: `Bearer ${auth0Token}`,
      'x-zapehr-project-id': config.PROJECT_ID,
    },
  });

  if (!oystehrResponse.ok) {
    const oystehrResponseJson = await oystehrResponse.json();
    console.log(
      `status, ${oystehrResponse.status}, status text, ${
        oystehrResponse.statusText
      }, oystehrResponseJson, ${JSON.stringify(oystehrResponseJson)}`
    );
    throw Error('An error occurred during the Oystehr Zambda S3 URL request');
  }
  const s3Url = (await oystehrResponse.json())['signedUrl'];
  console.log(`Got S3 upload URL for zambda ${zambdaName}`);

  console.log('Uploading zip file to S3');
  // zip file names are lowercase with dashes
  const zipFile = zambdaName.toLowerCase().replace(/_/g, '-');
  const file = fs.readFileSync(`.dist/zips/${zipFile}.zip`);
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

  console.log('Updating zambda ', zambdaName);
  const updateZambda = await fetch(`${projectApiUrlFromAuth0Audience(config.AUTH0_AUDIENCE)}/zambda/${zambdaId}`, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${auth0Token}`,
    },
    body: JSON.stringify({
      triggerMethod: zambda.type,
      schedule: zambda.schedule,
      name: zambdaName,
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
    const subscriptionsSearch = (
      await oystehr.fhir.search<Subscription>({
        resourceType: 'Subscription',
        params: [
          {
            name: 'url',
            value: endpoint,
          },
          {
            name: 'status',
            value: 'active',
          },
        ],
      })
    ).unbundle();
    console.log(`${subscriptionsSearch.length} existing subscriptions found`);

    const EXTENSION_URL = 'http://zapehr.com/fhir/extension/SubscriptionTriggerEvent';

    const createSubscriptionRequests: BatchInputPostRequest<Subscription>[] = [];
    const deleteSubscriptionRequests: BatchInputDeleteRequest[] = [];

    // check existing subscriptions against current subscription details to determine if any should be deleted
    // if any events are changing, delete
    // if any existing criteria doesn't exist in the details array defined above, delete
    const subscriptionsNotChanging = subscriptionsSearch.reduce((acc: Subscription[], existingSubscription) => {
      const existingSubscriptionEvent = existingSubscription.extension?.find((ext) => ext.url === EXTENSION_URL)
        ?.valueString;
      const subscriptionMatch = zambda.subscriptionDetails?.find((zambdaSubscriptionDetail) => {
        const eventMatch = existingSubscriptionEvent === zambdaSubscriptionDetail.event;
        const criteriaMatch = zambdaSubscriptionDetail.criteria === existingSubscription.criteria;
        return eventMatch && criteriaMatch;
      });
      if (subscriptionMatch) {
        console.log(
          `subscription with criteria: '${subscriptionMatch.criteria}' and event: '${subscriptionMatch.event}' is not changing`
        );
        acc.push(existingSubscription);
      } else {
        console.log(
          `subscription with criteria: '${existingSubscription.criteria}' and event: '${existingSubscriptionEvent}' is being deleted since the criteria/event is not contained in the updated subscription details array`
        );
        const deleteRequest: BatchInputDeleteRequest = {
          method: 'DELETE',
          url: `/Subscription/${existingSubscription.id}`,
        };
        deleteSubscriptionRequests.push(deleteRequest);
      }
      return acc;
    }, []);

    // check current subscription details again existing subscriptions to determine if any should be created
    zambda.subscriptionDetails.forEach((subscriptionDetail) => {
      // if the subscription detail is found in subscriptions not changing, do nothing
      const foundSubscription = subscriptionsNotChanging.find(
        (subscription) => subscription.criteria === subscriptionDetail.criteria
      );
      // else create it
      if (!foundSubscription) {
        console.log(
          `Creating subscription with criteria: '${subscriptionDetail.criteria}' and event: '${subscriptionDetail.event}'`
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
        const subscriptionRequest: BatchInputPostRequest<Subscription> = {
          method: 'POST',
          url: '/Subscription',
          resource: subscriptionResource,
        };
        createSubscriptionRequests.push(subscriptionRequest);
      }
    });
    if (createSubscriptionRequests.length > 0 || deleteSubscriptionRequests.length > 0) {
      console.log('making subscription transaction request');
      await oystehr.fhir.transaction({
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
    'You must provide an environment and an api as command-line arguments, e.g.: npm run deploy-zambdas testing'
  );
  process.exit();
}

// So we can use await
const main = async (): Promise<void> => {
  const env = process.argv[2];
  let selectedTriggerMethod: string | undefined = process.argv[3];
  const secrets = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  if (selectedTriggerMethod && !['http_open', 'http_auth', 'subscription', 'cron'].includes(selectedTriggerMethod)) {
    selectedTriggerMethod = undefined;
  }

  await updateZambdas(secrets, selectedTriggerMethod);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
