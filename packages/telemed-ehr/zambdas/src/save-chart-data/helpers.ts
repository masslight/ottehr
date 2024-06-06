import { BatchInputPostRequest, BatchInputPutRequest, FhirClient } from '@zapehr/sdk';
import { Bundle, CodeableConcept, Coding, FhirResource, Resource, ServiceRequest } from 'fhir/r4';
import { SaveChartDataResponse, DispositionFollowUpType, DispositionMetaFieldsNames } from 'ehr-utils';
import {
  chartDataResourceHasMetaTagByCode,
  createCodingCode,
  handleCustomDTOExtractions,
  mapResourceToChartDataResponse,
} from '../shared/chart-data/chart-data-helpers';

export function saveOrUpdateResourceRequest(resource: FhirResource): BatchInputPutRequest | BatchInputPostRequest {
  return {
    method: resource.id === undefined ? 'POST' : 'PUT',
    url: resource.id === undefined ? `/${resource.resourceType}` : `/${resource.resourceType}/${resource.id}`,
    resource: resource,
  };
}

export const validateBundleAndExtractSavedChartData = (
  bundle: Bundle,
  patientId: string,
  additionResourcesForResponse: FhirResource[]
): SaveChartDataResponse => {
  const entries = bundle.entry ?? [];

  let saveChartDataResponse: SaveChartDataResponse = {
    patientId,
    procedures: [],
    medications: [],
    conditions: [],
    allergies: [],
    examObservations: [],
    cptCodes: [],
    instructions: [],
    diagnosis: [],
    workSchoolNotes: [],
  };

  let resources: FhirResource[] = entries
    .filter((entry) => entry.resource !== undefined)
    .map((entry) => entry.resource) as FhirResource[];

  resources.forEach((resource) => {
    saveChartDataResponse = mapResourceToChartDataResponse(saveChartDataResponse, resource);
  });

  resources = resources.concat(additionResourcesForResponse);
  saveChartDataResponse = handleCustomDTOExtractions(saveChartDataResponse, resources) as SaveChartDataResponse;

  return saveChartDataResponse;
};

export const followUpToPerformerMap: { [field in DispositionFollowUpType]: CodeableConcept | undefined } = {
  dentistry: createCodingCode('106289002', 'Dentist', 'http://snomed.info/sct'),
  ent: createCodingCode('309372007', 'Ear, nose and throat surgeon', 'http://snomed.info/sct'),
  ophthalmology: createCodingCode('422234006', 'Ophthalmologist (occupation)', 'http://snomed.info/sct'),
  orthopedics: createCodingCode('59169001', 'Orthopedic technician', 'http://snomed.info/sct'),
  'lurie-ct': createCodingCode('lurie-ct', undefined, 'lurie-ct'),
  other: createCodingCode('other', 'other'),
};

export async function getEncounterAndRelatedResources(
  fhirClient: FhirClient,
  encounterId: string
): Promise<Resource[]> {
  return await fhirClient.searchResources({
    resourceType: 'Encounter',
    searchParams: [
      {
        name: '_id',
        value: encounterId!,
      },
      {
        name: '_include',
        value: 'Encounter:subject',
      },
      {
        name: '_revinclude:iterate',
        value: 'ServiceRequest:encounter',
      },
      {
        name: '_revinclude:iterate',
        value: 'DocumentReference:encounter',
      },
    ],
  });
}

export function filterServiceRequestsFromFhir(
  allResources: Resource[],
  metaTag?: DispositionMetaFieldsNames,
  performer?: Coding
): ServiceRequest[] {
  return allResources.filter((resource) => {
    if (!(resource.resourceType === 'ServiceRequest')) return false;
    const serviceRequest = resource as ServiceRequest;

    let resultBoolean = true;
    if (metaTag) resultBoolean = resultBoolean && Boolean(chartDataResourceHasMetaTagByCode(resource, metaTag));
    if (performer) resultBoolean = resultBoolean && findCodingInCode(serviceRequest.performerType, performer);
    return resultBoolean;
  }) as ServiceRequest[];
}

function findCodingInCode(code: CodeableConcept | undefined, coding: Coding): boolean {
  return Boolean(
    code?.coding?.find((element) => {
      return element.code === coding.code && element.system === coding.system;
    })
  );
}
