import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Provenance, ServiceRequest, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getPatchBinary,
  getSecret,
  NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY,
  SecretsKeys,
  UpdateNursingOrderInputValidated,
} from 'utils';
import { getMyPractitionerId, topLevelCatch, ZambdaInput } from '../../shared';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`update-nursing-order started, input: ${JSON.stringify(input)}`);

  let validatedParameters: UpdateNursingOrderInputValidated;

  try {
    validatedParameters = validateRequestParameters(input);
  } catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid request parameters. ${error.message || error}`,
      }),
    };
  }

  try {
    const { userToken, serviceRequestId, action, secrets } = validatedParameters;

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    const _practitionerIdFromCurrentUser = await getMyPractitionerId(oystehrCurrentUser);

    const nursingOrderResourcesRequest = async (): Promise<(ServiceRequest | Task)[]> =>
      (
        await oystehr.fhir.search({
          resourceType: 'ServiceRequest',
          params: [
            {
              name: '_id',
              value: serviceRequestId,
            },
            {
              name: '_revinclude',
              value: 'Task:based-on',
            },
          ],
        })
      ).unbundle() as (ServiceRequest | Task)[];

    const userPractitionerIdRequest = async (): Promise<string> => {
      try {
        const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);
        return await getMyPractitionerId(oystehrCurrentUser);
      } catch (e) {
        throw Error('Resource configuration error - user creating this order must have a Practitioner resource linked');
      }
    };

    const [orderResources, userPractitionerId] = await Promise.all([
      nursingOrderResourcesRequest(),
      userPractitionerIdRequest(),
    ]);

    const { serviceRequestSearchResults, taskSearchResults } = orderResources.reduce(
      (acc, resource) => {
        if (resource.resourceType === 'ServiceRequest')
          acc.serviceRequestSearchResults.push(resource as ServiceRequest);

        if (resource.resourceType === 'Task') acc.taskSearchResults.push(resource as Task);

        return acc;
      },
      {
        serviceRequestSearchResults: [] as ServiceRequest[],
        taskSearchResults: [] as Task[],
      }
    );

    const serviceRequest = (() => {
      const targetEncounter = serviceRequestSearchResults.find(
        (serviceRequest) => serviceRequest.id === serviceRequestId
      );
      if (!targetEncounter) throw Error('Encounter not found');
      return targetEncounter;
    })();

    const locationRef: string | undefined = serviceRequest.locationReference?.[0].reference;

    const relatedTask = taskSearchResults[0];
    if (!relatedTask.id) throw Error('related Task not found');

    const taskStatus = getTaskStatusForAction(action);
    const taskPatchRequest = getPatchBinary({
      resourceType: 'Task',
      resourceId: relatedTask.id,
      patchOperations: [
        {
          op: 'replace',
          path: '/status',
          value: taskStatus,
        },
      ],
    });

    const provenanceActivity = getProvenanceActivity(action);

    const provenanceConfig: Provenance = {
      resourceType: 'Provenance',
      activity: {
        coding: [provenanceActivity],
      },
      target: [{ reference: `ServiceRequest/${serviceRequest.id}` }],
      ...(locationRef && { location: { reference: locationRef } }),
      recorded: DateTime.now().toISO(),
      agent: [
        {
          who: { reference: `Practitioner/${userPractitionerId}` },
          onBehalfOf: { reference: serviceRequest.requester?.reference },
        },
      ],
    };

    const requestStatus = getRequestStatusForAction(action);
    const serviceRequestPatchRequest = getPatchBinary({
      resourceType: 'ServiceRequest',
      resourceId: serviceRequestId,
      patchOperations: [
        {
          op: 'replace',
          path: '/status',
          value: requestStatus,
        },
      ],
    });

    const transactionResponse = await oystehr.fhir.transaction({
      requests: [
        taskPatchRequest,
        serviceRequestPatchRequest,
        {
          method: 'POST',
          url: '/Provenance',
          resource: provenanceConfig,
        },
      ],
    });

    if (!transactionResponse.entry?.every((entry) => entry.response?.status[0] === '2')) {
      throw Error('Error creating nursing order in transaction');
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        transactionResponse,
      }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    await topLevelCatch('update-nursing-order', error, ENVIRONMENT);

    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ message: `Error updating nursing order: ${error.message || error}` }),
    };
  }
});

const getTaskStatusForAction = (action: string): string => {
  switch (action) {
    case 'COMPLETE ORDER':
      return 'completed';
    case 'CANCEL ORDER':
      return 'cancelled';
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
};

const getRequestStatusForAction = (action: string): string => {
  switch (action) {
    case 'COMPLETE ORDER':
      return 'completed';
    case 'CANCEL ORDER':
      return 'revoked';
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
};

const getProvenanceActivity = (action: string): { code: string; display: string; system: string } => {
  switch (action) {
    case 'COMPLETE ORDER':
      return NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY.completeOrder;
    case 'CANCEL ORDER':
      return NURSING_ORDER_PROVENANCE_ACTIVITY_CODING_ENTITY.cancelOrder;
    default:
      throw new Error(`Unsupported action: ${action}`);
  }
};
