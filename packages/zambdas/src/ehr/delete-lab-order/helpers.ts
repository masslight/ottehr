import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { QuestionnaireResponse, ServiceRequest, Task } from 'fhir/r4b';
import { DeleteLabOrderParams } from './validateRequestParameters';

export const makeDeleteResourceRequest = (resourceType: string, id: string): BatchInputDeleteRequest => ({
  method: 'DELETE',
  url: `${resourceType}/${id}`,
});

export const canDeleteLabOrder = (labOrder: ServiceRequest): boolean => {
  return labOrder.status === 'draft';
};

export const getLabOrderRelatedResources = async (
  oystehr: Oystehr,
  params: DeleteLabOrderParams
): Promise<{
  serviceRequest: ServiceRequest | null;
  questionnaireResponse: QuestionnaireResponse | null;
  task: Task | null;
}> => {
  try {
    const serviceRequestResponse = (
      await oystehr.fhir.search<ServiceRequest | Task>({
        resourceType: 'ServiceRequest',
        params: [
          {
            name: '_id',
            value: params.serviceRequestId,
          },
          {
            name: '_revinclude',
            value: 'Task:based-on',
          },
        ],
      })
    ).unbundle();

    const { serviceRequests, tasks } = serviceRequestResponse.reduce(
      (acc, resource) => {
        if (resource.resourceType === 'ServiceRequest' && resource.id === params.serviceRequestId) {
          acc.serviceRequests.push(resource);
        } else if (
          resource.resourceType === 'Task' &&
          resource.basedOn?.some((ref) => ref.reference === `ServiceRequest/${params.serviceRequestId}`)
        ) {
          acc.tasks.push(resource);
        }

        return acc;
      },
      { serviceRequests: [] as ServiceRequest[], tasks: [] as Task[] }
    );

    const serviceRequest = serviceRequests[0];
    const task = tasks[0];

    if (!serviceRequest?.id) {
      console.error('Lab order not found or invalid response', serviceRequestResponse);
      return { serviceRequest: null, questionnaireResponse: null, task: null };
    }

    if (!canDeleteLabOrder(serviceRequest)) {
      const errorMessage = `Cannot delete lab order; ServiceRequest has status: ${serviceRequest.status}. Only pending orders can be deleted.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const questionnaireResponse = await (async () => {
      if (serviceRequest.supportingInfo && serviceRequest.supportingInfo.length > 0) {
        const questionnaireResponseId = serviceRequest.supportingInfo
          .filter((ref) => ref.reference?.startsWith('QuestionnaireResponse/'))
          .map((ref) => ref.reference!.split('/')[1])[0];

        if (questionnaireResponseId) {
          const questionnaireResponse = (
            await oystehr.fhir.search<QuestionnaireResponse>({
              resourceType: 'QuestionnaireResponse',
              params: [
                {
                  name: '_id',
                  value: questionnaireResponseId,
                },
              ],
            })
          ).unbundle()[0];

          if (questionnaireResponse.id === questionnaireResponseId) {
            return questionnaireResponse;
          }

          return null;
        }
      }

      return null;
    })();

    return {
      serviceRequest,
      questionnaireResponse,
      task,
    };
  } catch (error) {
    console.error('Error fetching lab order and related resources:', error);
    throw error;
  }
};
