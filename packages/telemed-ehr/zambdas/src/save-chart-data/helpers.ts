import { BatchInputPostRequest, BatchInputPutRequest } from '@zapehr/sdk';
import { Bundle, FhirResource } from 'fhir/r4';
import { ChartDataFields, SaveChartDataResponse, mapResourceToChartDataFields } from 'ehr-utils';

export function saveOrUpdateResourceRequest(resource: FhirResource): BatchInputPutRequest | BatchInputPostRequest {
  return {
    method: resource.id === undefined ? 'POST' : 'PUT',
    url: resource.id === undefined ? `/${resource.resourceType}` : `/${resource.resourceType}/${resource.id}`,
    resource: resource,
  };
}

export const validateBundleAndExtractSavedChartData = (bundle: Bundle, patientId: string): SaveChartDataResponse => {
  const entries = bundle.entry ?? [];

  let chartDataFields: ChartDataFields = {
    procedures: [],
    medications: [],
    conditions: [],
    allergies: [],
  };

  entries.forEach((entry) => {
    if (entry.resource) {
      chartDataFields = mapResourceToChartDataFields(chartDataFields, entry.resource);
    }
  });

  return { ...chartDataFields, patientId };
};
