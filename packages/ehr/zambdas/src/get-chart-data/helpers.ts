import { BatchInputGetRequest } from '@oystehr/sdk';
import { Encounter, FhirResource, Patient, Resource } from 'fhir/r4b';
import {
  addSearchParams,
  ChartDataFields,
  ChartDataRequestedFields,
  ChartDataWithResources,
  GetChartDataResponse,
  SearchParams,
} from 'utils';
import { handleCustomDTOExtractions, mapResourceToChartDataResponse } from '../shared/chart-data/chart-data-helpers';

type RequestOptions = ChartDataRequestedFields[keyof ChartDataRequestedFields];

// for patient prop
type ResourceTypeWithPatientAsPatient = 'AllergyIntolerance' | 'EpisodeOfCare';

type ResourceTypeWithPatientAsSubject =
  | 'Observation'
  | 'Procedure'
  | 'MedicationStatement'
  | 'MedicationRequest'
  | 'Condition'
  | 'ClinicalImpression'
  | 'Communication'
  | 'ServiceRequest'
  | 'DocumentReference';

export type SupportedResourceType = ResourceTypeWithPatientAsPatient | ResourceTypeWithPatientAsSubject;

// for encounter prop
type ResourceTypeWithEncounterAsEncounter = Extract<
  SupportedResourceType,
  | 'Observation'
  | 'Procedure'
  | 'MedicationRequest'
  | 'Condition'
  | 'ClinicalImpression'
  | 'Communication'
  | 'ServiceRequest'
  | 'AllergyIntolerance'
  | 'DocumentReference'
>;

type ResourceTypeWithEncounterAsContext = Extract<SupportedResourceType, 'MedicationStatement'>;

export function createFindResourceRequest(
  patient: Patient | undefined,
  encounter: Encounter | undefined,
  resourceType: SupportedResourceType,
  searchParams?: SearchParams,
  defaultSearchBy?: 'encounter' | 'patient'
): BatchInputGetRequest {
  const searchBy = searchParams?._search_by ?? defaultSearchBy;

  if (searchBy === 'encounter' && resourceType !== 'EpisodeOfCare') {
    if (!encounter) {
      throw new Error('Encounter is required for encounter-based search');
    }
    if (resourceType === 'MedicationStatement') {
      return createFindResourceRequestByEncounterField(encounter.id!, resourceType, 'context', searchParams);
    } else {
      return createFindResourceRequestByEncounterField(encounter.id!, resourceType, 'encounter', searchParams);
    }
  } else {
    if (!patient) {
      throw new Error('Patient is required for patient-based search');
    }
    if (resourceType === 'AllergyIntolerance' || resourceType === 'EpisodeOfCare') {
      return createFindResourceRequestByPatientField(patient.id, resourceType, 'patient', searchParams);
    } else {
      return createFindResourceRequestByPatientField(patient.id, resourceType, 'subject', searchParams);
    }
  }
}

export function createFindResourceRequestByPatientField(
  patientId: Patient['id'],
  resourceType: ResourceTypeWithPatientAsPatient,
  field: 'patient',
  searchParams?: RequestOptions
): BatchInputGetRequest;
export function createFindResourceRequestByPatientField(
  patientId: Patient['id'],
  resourceType: ResourceTypeWithPatientAsSubject,
  field: 'subject',
  searchParams?: RequestOptions
): BatchInputGetRequest;
export function createFindResourceRequestByPatientField(
  patientId: Patient['id'],
  resourceType: SupportedResourceType,
  field: 'patient' | 'subject',
  searchParams?: RequestOptions
): BatchInputGetRequest {
  let url = `/${resourceType}?${field}=Patient/${patientId}`;
  url = addSearchParams(url, searchParams);

  return {
    method: 'GET',
    url: url,
  };
}

export function createFindResourceRequestByEncounterField(
  encounterId: Patient['id'],
  resourceType: ResourceTypeWithEncounterAsContext,
  field: 'context',
  searchParams?: RequestOptions
): BatchInputGetRequest;
export function createFindResourceRequestByEncounterField(
  encounterId: Patient['id'],
  resourceType: ResourceTypeWithEncounterAsEncounter,
  field: 'encounter',
  searchParams?: RequestOptions
): BatchInputGetRequest;
export function createFindResourceRequestByEncounterField(
  encounterId: Patient['id'],
  resourceType: SupportedResourceType,
  field: 'context' | 'encounter',
  searchParams?: RequestOptions
): BatchInputGetRequest {
  let url = `/${resourceType}?${field}=Encounter/${encounterId}`;

  url = addSearchParams(url, searchParams);

  return {
    method: 'GET',
    url: url,
  };
}

export function createFindResourceRequestById(
  resourceId: string,
  resourceType: string,
  searchParams?: RequestOptions
): BatchInputGetRequest {
  let url = `/${resourceType}?_id=${resourceId}`;
  url = addSearchParams(url, searchParams);

  return {
    method: 'GET',
    url: url,
  };
}

export function convertChartResourcesToResponse(
  resources: FhirResource[],
  patientId: string,
  encounterId: string,
  fields?: (keyof ChartDataFields)[]
): ChartDataWithResources {
  let getChartDataResponse: GetChartDataResponse = {
    patientId,
    ...(fields
      ? {
          ...Object.fromEntries(fields.map((field) => [field, []])),
          practitioners: [],
        }
      : {
          conditions: [],
          medications: [],
          allergies: [],
          procedures: [],
          examObservations: [],
          cptCodes: [],
          instructions: [],
          diagnosis: [],
          schoolWorkNotes: [],
          observations: [],
          prescribedMedications: [],
          practitioners: [],
        }),
  };

  let chartDataResources: Resource[] = [];
  resources.forEach((resource) => {
    // handle additional get-chart-data related fields
    if (resource.resourceType === 'Practitioner') {
      getChartDataResponse.practitioners?.push(resource);
    }

    // handle common get/save endpoint resources
    const updatedChartData = mapResourceToChartDataResponse(getChartDataResponse, resource, encounterId);
    getChartDataResponse = updatedChartData.chartDataResponse;
    if (updatedChartData.resourceMapped) chartDataResources.push(resource);
  });

  const customExtractions = handleCustomDTOExtractions(getChartDataResponse, resources);
  getChartDataResponse = customExtractions.chartData as GetChartDataResponse;
  if (customExtractions.chartResources)
    chartDataResources = chartDataResources.concat(customExtractions.chartResources);

  return {
    chartData: { ...getChartDataResponse },
    chartResources: chartDataResources,
  };
}
