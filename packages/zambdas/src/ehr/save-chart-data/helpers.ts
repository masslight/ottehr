import Oystehr from '@oystehr/sdk';
import { Bundle, CodeableConcept, Coding, Encounter, FhirResource, Resource, ServiceRequest } from 'fhir/r4b';
import { ChartDataWithResources, DispositionMetaFieldsNames, GetChartDataResponse } from 'utils';
import { parseCreatedResourcesBundle } from '../../shared';
import {
  chartDataResourceHasMetaTagByCode,
  handleCustomDTOExtractions,
  mapResourceToChartDataResponse,
} from '../../shared/chart-data';

export const validateBundleAndExtractSavedChartData = (
  bundle: Bundle,
  patientId: string,
  encounterId: string,
  additionResourcesForResponse: FhirResource[]
): ChartDataWithResources => {
  let chartDataResponse: GetChartDataResponse = {
    patientId,
    surgicalHistory: [],
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
        {
          name: '_revinclude:iterate',
          value: 'Condition:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'Observation:encounter',
        },
        {
          name: '_revinclude:iterate',
          value: 'ClinicalImpression:encounter',
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
