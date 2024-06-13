import { BatchInputGetRequest } from '@zapehr/sdk';
import {
  AllergyIntolerance,
  Bundle,
  ClinicalImpression,
  Communication,
  Condition,
  DocumentReference,
  DomainResource,
  FhirResource,
  MedicationStatement,
  Observation,
  Patient,
  Procedure,
  ServiceRequest,
} from 'fhir/r4';
import { GetChartDataResponse, GetPropName } from 'ehr-utils';
import { handleCustomDTOExtractions, mapResourceToChartDataResponse } from '../shared/chart-data/chart-data-helpers';

export function createFindResourceRequest<
  TResource extends AllergyIntolerance,
  RType extends TResource['resourceType'],
  TProp extends GetPropName<TResource, 'patient'>,
>(patientId: Patient['id'], resourceType: RType, field: TProp): BatchInputGetRequest;
export function createFindResourceRequest<
  TResource extends
    | Observation
    | Procedure
    | MedicationStatement
    | Condition
    | ClinicalImpression
    | Communication
    | ServiceRequest
    | DocumentReference,
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

export function createFindResourceRequestEncounterField(
  encounterId: string,
  resourceType: string,
  field?: string,
): BatchInputGetRequest {
  return {
    method: 'GET',
    url: `/${resourceType}?${field ? `${field}=Encounter/` : `encounter=`}${encounterId}`,
  };
}

export function createFindResourceRequestById(resourceId: string, resourceType: string): BatchInputGetRequest {
  return {
    method: 'GET',
    url: `/${resourceType}?_id=${resourceId}`,
  };
}

function parseBundleResources(bundle: Bundle<FhirResource>): FhirResource[] {
  if (bundle.resourceType !== 'Bundle' || bundle.entry === undefined) {
    console.error('Search response appears malformed: ', JSON.stringify(bundle));
    throw new Error('Could not parse search response for chart data');
  }

  const resultResources: FhirResource[] = [];
  for (const entry of bundle.entry) {
    if (
      entry.response?.outcome?.id === 'ok' &&
      entry.resource &&
      entry.resource.resourceType === 'Bundle' &&
      entry.resource.type === 'searchset'
    ) {
      const innerBundle = entry.resource as Bundle;
      const innerEntries = innerBundle.entry;
      if (innerEntries) {
        for (const item of innerEntries) {
          const resource = item.resource;
          if (resource) resultResources.push(resource);
        }
      }
    }
  }
  return resultResources;
}

export function convertSearchResultsToResponse(bundle: Bundle, patientId: string): GetChartDataResponse {
  let getChartDataResponse: GetChartDataResponse = {
    patientId,
    conditions: [],
    medications: [],
    allergies: [],
    procedures: [],
    examObservations: [],
    cptCodes: [],
    instructions: [],
    diagnosis: [],
    workSchoolNotes: [],
  };

  const resources = parseBundleResources(bundle);

  resources.forEach((resource) => {
    getChartDataResponse = mapResourceToChartDataResponse(getChartDataResponse, resource);
  });

  getChartDataResponse = handleCustomDTOExtractions(getChartDataResponse, resources) as GetChartDataResponse;

  return { ...getChartDataResponse };
}
