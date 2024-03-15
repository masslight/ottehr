import { BatchInputGetRequest } from '@zapehr/sdk';
import {
  AllergyIntolerance,
  Bundle,
  Condition,
  DomainResource,
  MedicationAdministration,
  Observation,
  Patient,
  Procedure,
} from 'fhir/r4';
import { ChartDataFields, GetChartDataResponse, GetPropName, mapResourceToChartDataFields } from 'ehr-utils';

export function createFindResourceRequest<
  TResource extends AllergyIntolerance,
  RType extends TResource['resourceType'],
  TProp extends GetPropName<TResource, 'patient'>,
>(patientId: Patient['id'], resourceType: RType, field: TProp): BatchInputGetRequest;
export function createFindResourceRequest<
  TResource extends Observation | Procedure | MedicationAdministration | Condition,
  RType extends TResource['resourceType'],
  TProp extends GetPropName<TResource, 'subject'>,
>(patientId: Patient['id'], resourceType: RType, field: TProp): BatchInputGetRequest;
export function createFindResourceRequest<
  TResource extends DomainResource,
  RType extends TResource['resourceType'],
  TProp extends string,
>(patientId: Patient['id'], resourceType: RType, field: TProp): BatchInputGetRequest {
  return {
    method: 'GET',
    url: `/${resourceType}?${field}=Patient/${patientId}`,
  };
}

export function convertSearchResultsToResponse(bundle: Bundle, patientId: string): GetChartDataResponse {
  let chartDataFields: ChartDataFields = {
    conditions: [],
    medications: [],
    allergies: [],
    procedures: [],
    examObservations: [],
  };

  if (bundle.resourceType !== 'Bundle' || bundle.entry === undefined) {
    console.error('Search response appears malformed: ', JSON.stringify(bundle));
    throw new Error('Could not parse search response for chart data');
  }

  bundle.entry.forEach((entry) => {
    if (
      entry.response?.outcome?.id === 'ok' &&
      entry.resource &&
      entry.resource.resourceType === 'Bundle' &&
      entry.resource.type === 'searchset'
    ) {
      const innerBundle = entry.resource as Bundle;
      const innerEntries = innerBundle.entry;
      innerEntries?.forEach((item) => {
        const resource = item.resource;
        if (resource) {
          chartDataFields = mapResourceToChartDataFields(chartDataFields, resource);
        }
      });
    }
  });
  return { ...chartDataFields, patientId };
}
