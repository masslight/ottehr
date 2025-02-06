import {
  ChartDataWithResources,
  createCodingCode,
  DispositionFollowUpType,
  DispositionMetaFieldsNames,
  GetChartDataResponse,
} from 'utils';
import Oystehr from '@oystehr/sdk';
import { Bundle, CodeableConcept, Coding, Encounter, FhirResource, Resource, ServiceRequest } from 'fhir/r4b';
import { parseCreatedResourcesBundle } from '../shared';
import {
  chartDataResourceHasMetaTagByCode,
  handleCustomDTOExtractions,
  mapResourceToChartDataResponse,
} from '../shared/chart-data/chart-data-helpers';

export const validateBundleAndExtractSavedChartData = (
  bundle: Bundle,
  patientId: string,
  encounterId: string,
  additionResourcesForResponse: FhirResource[]
): ChartDataWithResources => {
  let chartDataResponse: GetChartDataResponse = {
    patientId,
    procedures: [],
    medications: [],
    conditions: [],
    allergies: [],
    examObservations: [],
    cptCodes: [],
    instructions: [],
    diagnosis: [],
    episodeOfCare: [],
    schoolWorkNotes: [],
    observations: [],
    prescribedMedications: [],
    notes: [],
    vitalsObservations: [],
    birthHistory: [],
  };

  let resources = parseCreatedResourcesBundle(bundle);
  resources = resources.concat(additionResourcesForResponse);

  const chartDataResources: Resource[] = [];
  resources.forEach((resource) => {
    const updatedChartData = mapResourceToChartDataResponse(chartDataResponse, resource, encounterId);
    chartDataResponse = updatedChartData.chartDataResponse;
    if (updatedChartData.resourceMapped) chartDataResources.push(resource);
  });

  chartDataResponse = handleCustomDTOExtractions(chartDataResponse, resources) as GetChartDataResponse;

  return {
    chartData: chartDataResponse,
    chartResources: chartDataResources,
  };
};

export const followUpToPerformerMap: { [field in DispositionFollowUpType]: CodeableConcept | undefined } = {
  dentistry: createCodingCode('106289002', 'Dentist', 'http://snomed.info/sct'),
  ent: createCodingCode('309372007', 'Ear, nose and throat surgeon', 'http://snomed.info/sct'),
  ophthalmology: createCodingCode('422234006', 'Ophthalmologist (occupation)', 'http://snomed.info/sct'),
  orthopedics: createCodingCode('59169001', 'Orthopedic technician', 'http://snomed.info/sct'),
  'lurie-ct': createCodingCode('lurie-ct', undefined, 'lurie-ct'),
  other: createCodingCode('other', 'other'),
};

export async function getEncounterAndRelatedResources(oystehr: Oystehr, encounterId?: string): Promise<Resource[]> {
  if (!encounterId) {
    throw new Error('Encounter ID is required');
  }
  return (
    await oystehr.fhir.search<Encounter>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_id',
          value: encounterId,
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
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_revinclude:iterate',
          value: 'List:patient',
        },
      ],
    })
  ).unbundle();
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
