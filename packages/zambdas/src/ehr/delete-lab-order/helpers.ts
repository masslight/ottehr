import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Condition, Encounter, QuestionnaireResponse, ServiceRequest, Task } from 'fhir/r4b';
import { ADDED_VIA_LAB_ORDER_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { DeleteLabOrderZambdaInputValidated } from './validateRequestParameters';

export const makeDeleteResourceRequest = (resourceType: string, id: string): BatchInputDeleteRequest => ({
  method: 'DELETE',
  url: `${resourceType}/${id}`,
});

export const canDeleteLabOrder = (labOrder: ServiceRequest): boolean => {
  return labOrder.status === 'draft';
};

export const getLabOrderRelatedResources = async (
  oystehr: Oystehr,
  params: DeleteLabOrderZambdaInputValidated
): Promise<{
  serviceRequest: ServiceRequest | null;
  questionnaireResponse: QuestionnaireResponse | null;
  task: Task | null;
  labConditions: Condition[];
}> => {
  try {
    const serviceRequestResponse = (
      await oystehr.fhir.search<ServiceRequest | Task | Encounter | Condition>({
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
          {
            name: '_include',
            value: 'ServiceRequest:encounter',
          },
          {
            name: '_revinclude:iterate',
            value: 'Condition:encounter',
          },
        ],
      })
    ).unbundle();

    const { serviceRequests, tasks, conditions, encounters } = serviceRequestResponse.reduce(
      (acc, resource) => {
        if (resource.resourceType === 'ServiceRequest' && resource.id === params.serviceRequestId) {
          acc.serviceRequests.push(resource);
        } else if (
          resource.resourceType === 'Task' &&
          resource.basedOn?.some((ref) => ref.reference === `ServiceRequest/${params.serviceRequestId}`)
        ) {
          acc.tasks.push(resource);
        } else if (resource.resourceType === 'Condition') {
          acc.conditions.push(resource);
        } else if (resource.resourceType === 'Encounter') {
          acc.encounters.push(resource);
        }

        return acc;
      },
      {
        serviceRequests: [] as ServiceRequest[],
        tasks: [] as Task[],
        conditions: [] as Condition[],
        encounters: [] as Encounter[],
      }
    );

    const serviceRequest = serviceRequests[0];
    const task = tasks[0];

    if (!canDeleteLabOrder(serviceRequest)) {
      const errorMessage = `Cannot delete lab order; ServiceRequest has status: ${serviceRequest.status}. Only pending orders can be deleted.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    if (!serviceRequest?.id) {
      console.error('Lab order not found or invalid response', serviceRequestResponse);
      return { serviceRequest: null, questionnaireResponse: null, task: null, labConditions: [] };
    }

    const encounter = encounters.find(
      (encounter) => encounter.id === serviceRequest.encounter?.reference?.split('/')[1]
    );

    // this Conditions were added from external lab order page and should be deleted if the lab order is deleted
    const labConditions = conditions.filter(
      (condition) =>
        condition.encounter?.reference === `Encounter/${encounter?.id}` &&
        condition.extension?.some((ext) => ext.url === ADDED_VIA_LAB_ORDER_SYSTEM && ext.valueBoolean === true)
    );

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
      labConditions,
    };
  } catch (error) {
    console.error('Error fetching external lab order and related resources:', error);
    throw error;
  }
};
