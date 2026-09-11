import { BatchInputGetRequest } from '@oystehr/sdk';
import { Bundle, BundleEntry, FhirResource, Patient } from 'fhir/r4b';
import { addSearchParams, SearchParams } from 'utils/lib/fhir/uri';
import { ChartDataRequestedFields } from 'utils/lib/types/api/chart-data/get-chart-data.types';

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
  | 'DocumentReference'
  | 'QuestionnaireResponse';

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
  | 'QuestionnaireResponse'
>;

type ResourceTypeWithEncounterAsContext = Extract<SupportedResourceType, 'MedicationStatement'>;

/**
 * Every chart search is built from the encounter id alone — patient-scoped ones included, via
 * createFindResourceRequestByEncounterSubject — so a whole request set can go out in a single wave.
 */
export function createFindResourceRequest(
  encounterId: string,
  resourceType: SupportedResourceType,
  searchParams?: SearchParams,
  defaultSearchBy?: 'encounter' | 'patient'
): BatchInputGetRequest {
  const searchBy = searchParams?._search_by ?? defaultSearchBy;

  if (searchBy === 'encounter' && resourceType !== 'EpisodeOfCare') {
    if (resourceType === 'MedicationStatement') {
      return createFindResourceRequestByEncounterField(encounterId, resourceType, 'context', searchParams);
    }
    return createFindResourceRequestByEncounterField(encounterId, resourceType, 'encounter', searchParams);
  }
  if (resourceType === 'AllergyIntolerance' || resourceType === 'EpisodeOfCare') {
    return createFindResourceRequestByEncounterSubject(encounterId, resourceType, 'patient', searchParams);
  }
  return createFindResourceRequestByEncounterSubject(encounterId, resourceType, 'subject', searchParams);
}

/** Search URL that scopes a patient-scoped resource to the subject of an encounter. */
export const encounterSubjectScopedSearchUrl = (
  resourceType: SupportedResourceType | 'Patient',
  field: 'patient' | 'subject' | null,
  encounterId: string
): string =>
  field === null
    ? `/${resourceType}?_has:Encounter:subject:_id=${encounterId}`
    : `/${resourceType}?${field}:Patient._has:Encounter:subject:_id=${encounterId}`;

/**
 * CAUTION: do not add `_revinclude` / `_include:iterate` to a search scoped this way without
 * checking where the included resource can point. An iterate leg that walks out through a resource
 * shared with other patients would pull their data into a patient-scoped result.
 */
export function createFindResourceRequestByEncounterSubject(
  encounterId: string,
  resourceType: SupportedResourceType,
  field: 'patient' | 'subject',
  searchParams?: RequestOptions
): BatchInputGetRequest {
  let url = encounterSubjectScopedSearchUrl(resourceType, field, encounterId);
  url = addSearchParams(url, searchParams);

  return {
    method: 'GET',
    url: url,
  };
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

/**
 * Fixed, server-owned search parameters for the chart sections. Values are written verbatim, so callers
 * pass tag lists as comma-joined strings and repeat a parameter by passing an array. No search sets
 * `_count`: Oystehr's default page size is also its maximum (1000), so an explicit count could not return more.
 */
export type ChartSearchParams = Record<string, string | number | string[]>;

const appendParams = (url: string, params: ChartSearchParams): string => {
  const parts = Object.entries(params).flatMap(([key, value]) =>
    (Array.isArray(value) ? value : [value]).map((v) => `${key}=${v}`)
  );
  return parts.length > 0 ? `${url}&${parts.join('&')}` : url;
};

/** `/<type>?encounter=Encounter/<id>&...`; MedicationStatement references its encounter as `context`. */
export function encounterScopedSearch(
  resourceType: ResourceTypeWithEncounterAsEncounter | ResourceTypeWithEncounterAsContext,
  encounterId: string,
  params: ChartSearchParams = {}
): BatchInputGetRequest {
  const field = resourceType === 'MedicationStatement' ? 'context' : 'encounter';
  return { method: 'GET', url: appendParams(`/${resourceType}?${field}=Encounter/${encounterId}`, params) };
}

/** `/<type>?<subject|patient>:Patient._has:Encounter:subject:_id=<encounterId>&...`: all of the patient's. */
export function patientScopedSearch(
  resourceType: SupportedResourceType,
  encounterId: string,
  params: ChartSearchParams = {}
): BatchInputGetRequest {
  const field = resourceType === 'AllergyIntolerance' || resourceType === 'EpisodeOfCare' ? 'patient' : 'subject';
  return {
    method: 'GET',
    url: appendParams(encounterSubjectScopedSearchUrl(resourceType, field, encounterId), params),
  };
}

/** The resources inside one batch-response entry, or none when the entry is not an ok searchset. */
export function parseSearchsetEntry(entry: BundleEntry<FhirResource> | undefined): FhirResource[] {
  if (
    entry?.response?.outcome?.id !== 'ok' ||
    !entry.resource ||
    entry.resource.resourceType !== 'Bundle' ||
    entry.resource.type !== 'searchset'
  ) {
    if (entry) console.error('Chart search entry was not an ok searchset: ', JSON.stringify(entry.response));
    return [];
  }
  const innerBundle = entry.resource as Bundle<FhirResource>;
  return (innerBundle.entry ?? []).flatMap((item) => (item.resource ? [item.resource] : []));
}

/** Flattens a batch response's nested searchset bundles into a flat resource list. */
export function parseChartDataBundle(bundle: Bundle<FhirResource>): FhirResource[] {
  if (bundle.resourceType !== 'Bundle' || bundle.entry === undefined) {
    console.error('Search response appears malformed: ', JSON.stringify(bundle));
    throw new Error('Could not parse search response for chart data');
  }
  return bundle.entry.flatMap((entry) => parseSearchsetEntry(entry));
}
