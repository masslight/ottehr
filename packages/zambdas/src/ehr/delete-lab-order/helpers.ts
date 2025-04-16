import Oystehr, { BatchInputDeleteRequest } from '@oystehr/sdk';
import { Condition, ServiceRequest } from 'fhir/r4b';
import { DeleteLabOrderParams } from './validateRequestParameters';

/**
 * Creates a delete request for a FHIR resource
 */
export const makeDeleteResourceRequest = (resourceType: string, id: string): BatchInputDeleteRequest => ({
  method: 'DELETE',
  url: `${resourceType}/${id}`,
});

/**
 * Check if the lab order can be deleted (only pending/draft lab orders can be deleted)
 */
export const canDeleteLabOrder = (labOrder: ServiceRequest): boolean => {
  const deletableStatuses = ['draft'];
  return deletableStatuses.includes(labOrder.status);
};

/**
 * Get the lab order resource and related diagnoses
 */
export const getLabOrderAndRelatedResources = async (
  oystehr: Oystehr,
  params: DeleteLabOrderParams
): Promise<{
  serviceRequest: ServiceRequest | null;
  relatedDiagnoses: Condition[];
}> => {
  try {
    const serviceRequestResponse = await oystehr.fhir.search<ServiceRequest>({
      resourceType: 'ServiceRequest',
      params: [
        {
          name: '_id',
          value: params.labOrderId,
        },
      ],
    });

    const serviceRequestData = serviceRequestResponse?.entry?.[0]?.resource;

    if (!serviceRequestData || !serviceRequestData.id) {
      console.error('Lab order not found or invalid response', serviceRequestResponse);
      return { serviceRequest: null, relatedDiagnoses: [] };
    }

    if (!canDeleteLabOrder(serviceRequestData)) {
      const errorMessage = `Cannot delete lab order with status: ${serviceRequestData.status}. Only pending orders can be deleted.`;
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    // Get diagnoses that were added as supporting info for this order
    const relatedDiagnoses: Condition[] = [];

    // If there are supporting info references that point to Condition resources, fetch them
    if (serviceRequestData.supportingInfo && serviceRequestData.supportingInfo.length > 0) {
      const conditionReferences = serviceRequestData.supportingInfo
        .filter((ref) => ref.reference?.startsWith('Condition/'))
        .map((ref) => ref.reference!.split('/')[1]);

      if (conditionReferences.length > 0) {
        const conditionIdsQuery = conditionReferences.join(',');

        const diagnosesResponse = await oystehr.fhir.search<Condition>({
          resourceType: 'Condition',
          params: [
            {
              name: '_id',
              value: conditionIdsQuery,
            },
            {
              name: 'encounter',
              value: `Encounter/${params.encounterId}`,
            },
          ],
        });

        if (diagnosesResponse && diagnosesResponse.entry) {
          diagnosesResponse.entry.forEach((entry) => {
            if (entry.resource && entry.resource.resourceType === 'Condition') {
              relatedDiagnoses.push(entry.resource as Condition);
            }
          });
        }
      }
    }

    return {
      serviceRequest: serviceRequestData,
      relatedDiagnoses,
    };
  } catch (error) {
    console.error('Error fetching lab order and related resources:', error);
    throw error;
  }
};
