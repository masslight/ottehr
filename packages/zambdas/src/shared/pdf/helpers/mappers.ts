import { ActivityDefinition, Observation, ServiceRequest } from 'fhir/r4b';
import { convertActivityDefinitionToTestItem } from 'utils';
import { parseLabInfo } from '../../../ehr/lab/external/get-lab-orders/helpers';
import { findActivityDefinitionForServiceRequest } from '../../../ehr/lab/in-house/get-in-house-orders/helpers';
import { LabOrder } from '../types';

export const mapResourcesToInHouseLabOrders = (
  serviceRequests: ServiceRequest[],
  activityDefinitions: ActivityDefinition[],
  observations: Observation[]
): LabOrder[] => {
  return serviceRequests
    .filter((sr) => sr.id)
    .map((serviceRequest) => {
      const activityDefinition = findActivityDefinitionForServiceRequest(serviceRequest, activityDefinitions);
      if (!activityDefinition) {
        console.warn(`ActivityDefinition not found for ServiceRequest ${serviceRequest.id}`);
        return null;
      }

      const testItem = convertActivityDefinitionToTestItem(activityDefinition, observations, serviceRequest);

      return {
        serviceRequestId: serviceRequest.id!,
        testItemName: testItem.name,
      };
    })
    .filter(Boolean) as { serviceRequestId: string; testItemName: string }[];
};

export const mapResourcesToExternalLabOrders = (serviceRequests: ServiceRequest[]): LabOrder[] => {
  return serviceRequests.map((serviceRequest) => {
    const { testItem } = parseLabInfo(serviceRequest);
    return {
      serviceRequestId: serviceRequest.id ?? '',
      testItemName: testItem,
    };
  });
};
