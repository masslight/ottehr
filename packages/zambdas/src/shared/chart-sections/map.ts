import { Encounter, FhirResource, Practitioner } from 'fhir/r4b';
import { GetChartDataResponse } from 'utils/lib/types/api/chart-data/get-chart-data.types';
import { handleCustomDTOExtractions, mapResourceToChartDataResponse } from '../chart-data';

/**
 * Runs resources through the same resource-to-DTO mapping get-chart-data uses, seeded with the fields
 * the caller wants collected. Array fields are only filled when the seed contains them; scalar fields are
 * assigned whenever a matching resource is found; the Encounter-derived fields (disposition, diagnosis,
 * procedures, accident and the extension flags) are computed from the Encounter and the resources.
 */
export function mapChartResources(
  encounter: Encounter,
  resources: FhirResource[],
  encounterId: string,
  seed: Partial<GetChartDataResponse>
): GetChartDataResponse {
  let data: GetChartDataResponse = { patientId: '', ...seed };
  const all = [encounter, ...resources];
  all.forEach((resource) => {
    if (resource.resourceType === 'Practitioner') {
      data.practitioners?.push(resource as Practitioner);
    }
    data = mapResourceToChartDataResponse(data, resource, encounterId).chartDataResponse;
  });
  return handleCustomDTOExtractions(data, all) as GetChartDataResponse;
}
