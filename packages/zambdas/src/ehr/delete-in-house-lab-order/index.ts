import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Bundle, FhirResource, Provenance, ServiceRequest, Task } from 'fhir/r4b';
import { DeleteInHouseLabOrderParameters, DeleteInHouseLabOrderZambdaOutput, Secrets } from 'utils';
import { ZambdaInput, checkOrCreateM2MClientToken, createOystehrClient, topLevelCatch } from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';
let m2mtoken: string;

const makeDeleteResourceRequest = (resourceType: string, id: string): BatchInputDeleteRequest => ({
  method: 'DELETE',
  url: `${resourceType}/${id}`,
});

const canDeleteInHouseLabOrder = (serviceRequest: ServiceRequest): boolean => {
  return serviceRequest.status === 'draft';
};

const getInHouseLabOrderRelatedResources = async (
  oystehr: Oystehr,
  serviceRequestId: string
): Promise<{
  serviceRequest: ServiceRequest | null;
  task: Task | null;
  provenance: Provenance | null;
}> => {
  try {
    const searchResponse = (
      await oystehr.fhir.search<ServiceRequest | Task | Provenance>({
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
          {
            name: '_revinclude',
            value: 'Provenance:target',
          },
        ],
      })
    ).unbundle();

    const { serviceRequests, tasks, provenances } = searchResponse.reduce(
      (acc, resource) => {
        if (resource.resourceType === 'ServiceRequest' && resource.id === serviceRequestId) {
          acc.serviceRequests.push(resource);
        } else if (
          resource.resourceType === 'Task' &&
          resource.basedOn?.some((ref) => ref.reference === `ServiceRequest/${serviceRequestId}`)
        ) {
          acc.tasks.push(resource);
        } else if (
          resource.resourceType === 'Provenance' &&
          resource.target?.some((ref) => ref.reference === `ServiceRequest/${serviceRequestId}`)
        ) {
          acc.provenances.push(resource);
        }

        return acc;
      },
      {
        serviceRequests: [] as ServiceRequest[],
        tasks: [] as Task[],
        provenances: [] as Provenance[],
      }
    );

    const serviceRequest = serviceRequests[0] || null;
    const task = tasks[0] || null;
    const provenance = provenances[0] || null;

    if (serviceRequest && !canDeleteInHouseLabOrder(serviceRequest)) {
      const errorMessage = `Cannot delete in-house lab order; ServiceRequest has status: ${serviceRequest.status}. Only draft orders can be deleted.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    return {
      serviceRequest,
      task,
      provenance,
    };
  } catch (error) {
    console.error('Error fetching in-house lab order and related resources:', error);
    throw error;
  }
};

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`delete-in-house-lab-order started, input: ${JSON.stringify(input)}`);

  let secrets = input.secrets;
  let validatedParameters: DeleteInHouseLabOrderParameters & { secrets: Secrets | null; userToken: string };

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
    secrets = validatedParameters.secrets;
    const { serviceRequestId } = validatedParameters;

    console.log('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);

    const { serviceRequest, task, provenance } = await getInHouseLabOrderRelatedResources(oystehr, serviceRequestId);

    if (!serviceRequest) {
      return {
        statusCode: 404,
        body: JSON.stringify({
          message: `In-house lab order with ServiceRequest ID ${serviceRequestId} not found`,
        }),
      };
    }

    const deleteRequests: BatchInputDeleteRequest[] = [];

    deleteRequests.push(makeDeleteResourceRequest('ServiceRequest', serviceRequestId));

    if (task?.id) {
      deleteRequests.push(makeDeleteResourceRequest('Task', task.id));
    }

    if (provenance?.id) {
      deleteRequests.push(makeDeleteResourceRequest('Provenance', provenance.id));
    }

    let transactionResponse: Bundle<FhirResource> = {
      resourceType: 'Bundle',
      entry: [],
      type: 'transaction',
    };

    if (deleteRequests.length > 0) {
      console.log(
        `Deleting in-house lab order for ServiceRequest ID: ${serviceRequestId}; requests: ${JSON.stringify(
          deleteRequests,
          null,
          2
        )}`
      );

      transactionResponse = (await oystehr.fhir.transaction({
        requests: deleteRequests,
      })) as Bundle<FhirResource>;

      if (!transactionResponse.entry?.every((entry) => entry.response?.status[0] === '2')) {
        throw new Error('Error deleting in-house lab order resources in transaction');
      }
    }

    const response: DeleteInHouseLabOrderZambdaOutput = {};

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Error deleting in-house lab order:', error);
    await topLevelCatch('delete-in-house-lab-order', error, secrets);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({
        message: `Error processing request: ${error.message || error}`,
      }),
    };
  }
});
