import { APIGatewayProxyResult } from 'aws-lambda';
import { ServiceRequest, Task } from 'fhir/r4b';
import { UpdateNursingOrderInputValidated } from 'utils/lib/types/data/orders/types';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { makeNursingOrderStatusChangeRequests } from '../../shared/nursing-orders';
import { getMyPractitionerId } from '../../shared/practitioners';
import { wrapHandler } from '../../shared/sentry';
import { ZambdaInput } from '../../shared/types/common';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let m2mToken: string;

export const index = wrapHandler('update-nursing-order', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

  const { userToken, serviceRequestId, action, secrets } = validatedParameters;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);

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
      return await getMyPractitionerId(userToken, secrets);
    } catch {
      throw Error('Resource configuration error - user creating this order must have a Practitioner resource linked');
    }
  };

  const [orderResources, userPractitionerId] = await Promise.all([
    nursingOrderResourcesRequest(),
    userPractitionerIdRequest(),
  ]);

  const { serviceRequestSearchResults, taskSearchResults } = orderResources.reduce(
    (acc, resource) => {
      if (resource.resourceType === 'ServiceRequest') acc.serviceRequestSearchResults.push(resource as ServiceRequest);
      if (resource.resourceType === 'ServiceRequest') acc.serviceRequestSearchResults.push(resource as ServiceRequest);

      if (resource.resourceType === 'Task') acc.taskSearchResults.push(resource as Task);
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

  const relatedTask = taskSearchResults[0];
  if (!relatedTask.id) throw Error('related Task not found');

  const transactionResponse = await oystehr.fhir.transaction({
    requests: makeNursingOrderStatusChangeRequests({
      serviceRequest,
      task: relatedTask,
      action,
      practitionerId: userPractitionerId,
    }),
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
});
