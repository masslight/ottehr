import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { Bundle, FhirResource, Patient, Resource } from 'fhir/r4b';
import { ChartDataWithResources } from 'utils/lib/types/api/chart-data/chart-data.types';
import { ChartDataRequestedFields, GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { SCHOOL_WORK_NOTE } from 'utils/lib/types/data/paperwork/paperwork.constants';
import { handleCustomDTOExtractions, mapResourceToChartDataResponse } from '../../shared/chart-data';
import { enrichCptCodesWithMedicationAdministration } from '../../shared/chart-data/cpt-billing';
import { makePreferredPharmacies } from '../../shared/chart-data/preferred-pharmacies';
import { parseChartDataBundle } from '../../shared/chart-data/search-requests';
import { makeEncounterLabResults } from '../lab/shared/labs';

// The search-request builders live with the rest of the chart-data code now (they are shared with the
// chart sections); re-exported here so existing imports keep working until this endpoint is removed.
export {
  createFindResourceRequest,
  createFindResourceRequestByEncounterField,
  createFindResourceRequestByEncounterSubject,
  createFindResourceRequestById,
  createFindResourceRequestByPatientField,
  encounterSubjectScopedSearchUrl,
  parseChartDataBundle,
  SupportedResourceType,
} from '../../shared/chart-data/search-requests';

export async function convertSearchResultsToResponse(
  bundle: Bundle<FhirResource>,
  m2mToken: string,
  patientId: string,
  encounterId: string,
  fields?: (keyof ChartDataRequestedFields)[],
  patientResource?: Patient,
  oystehr?: Oystehr
): Promise<ChartDataWithResources> {
  let getChartDataResponse: GetChartDataResponse = {
    patientId,
    ...(fields
      ? {
          ...Object.fromEntries(
            fields.map((field) => [field, field === 'aiChat' ? { documents: [], providers: [] } : []])
          ),
          practitioners: [],
        }
      : {
          conditions: [],
          medications: [],
          allergies: [],
          surgicalHistory: [],
          examObservations: [],
          rosObservations: [],
          cptCodes: [],
          instructions: [],
          diagnosis: [],
          schoolWorkNotes: [],
          observations: [],
          practitioners: [],
          aiChat: {
            documents: [],
            providers: [],
          },
        }),
  };
  const resources = parseChartDataBundle(bundle);

  const chartDataResources: Resource[] = [];

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

  if (getChartDataResponse.cptCodes?.length && oystehr) {
    getChartDataResponse.cptCodes = await enrichCptCodesWithMedicationAdministration(
      getChartDataResponse.cptCodes,
      resources,
      oystehr
    );
  }

  getChartDataResponse = handleCustomDTOExtractions(getChartDataResponse, resources) as GetChartDataResponse;
  if (getChartDataResponse.externalLabResults || getChartDataResponse.inHouseLabResults) {
    console.log('constructing lab result configs');
    const { externalLabResultConfig, inHouseLabResultConfig } = await makeEncounterLabResults(
      resources,
      m2mToken,
      oystehr
    );
    if (getChartDataResponse.externalLabResults) getChartDataResponse.externalLabResults = externalLabResultConfig;
    if (getChartDataResponse.inHouseLabResults) getChartDataResponse.inHouseLabResults = inHouseLabResultConfig;
  }

  if (fields?.includes('preferredPharmacies')) {
    const qr = resources.find((r) => r.resourceType === 'QuestionnaireResponse');
    getChartDataResponse.preferredPharmacies = makePreferredPharmacies(patientResource, qr);
  }

  const encounter = resources.find((r) => r.resourceType === 'Encounter');

  if (encounter && fields?.includes('reasonForVisit')) {
    const ext = encounter.extension?.find((e) => e.url === `reason-for-visit`);

    getChartDataResponse.reasonForVisit = {
      text: ext?.valueString ?? '',
    };
  }

  return {
    chartData: getChartDataResponse,
    chartResources: chartDataResources,
  };
}

export const configProceduresRequestsForGetChartData = (encounterIds: string | string[]): BatchInputGetRequest => {
  const encounterRefs = Array.isArray(encounterIds)
    ? encounterIds.map((id) => `Encounter/${id}`).join(',')
    : `Encounter/${encounterIds}`;
  return {
    method: 'GET',
    url: `/ServiceRequest?encounter=${encounterRefs}&status=completed`,
  };
};

export const defaultChartDataFieldsSearchParams: Partial<
  Record<keyof GetChartDataResponse, { _tag?: string; _sort?: string }>
> = {
  medications: { _tag: 'current-medication' },
  inhouseMedications: { _tag: 'in-house-medication' },
  schoolWorkNotes: { _tag: SCHOOL_WORK_NOTE },
  instructions: { _sort: '-sent' },
};
