import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { Coverage, CoverageEligibilityResponse } from 'fhir/r4b';
import { parseCoverageEligibilityResponse, pullCoverageIdentifyingDetails } from 'utils/lib/fhir/billing';
import { CoverageCheckWithDetails, PATIENT_ACCOUNT_ELIGIBILITY_CHECK_COUNT } from 'utils/lib/types/api/patient-account';

export const getPatientCoverageChecks = async (
  patientId: string,
  oystehr: Oystehr
): Promise<CoverageCheckWithDetails[]> => {
  // due to really huge CEResponses causing response-too-large errors, we need to chop our querying for the CEResponses into
  // manageable chunks. We'll do this by first querying for just the IDs of the CEResponses, then querying for the full resources in parallel.
  // Even just two resources returned in a query can still result in response-too-large errors based on prod data we've encountered.
  console.time('fetching CER IDs');
  const eligibilityCheckIds = (
    await oystehr.fhir.search<CoverageEligibilityResponse>({
      resourceType: 'CoverageEligibilityResponse',
      params: [
        {
          name: `patient._id`,
          value: patientId,
        },
        {
          name: '_sort',
          value: '-created',
        },
        {
          name: '_elements',
          value: 'id',
        },
        {
          name: '_count', // we shouldn't need more than the most recent 10 eligibility checks
          value: String(PATIENT_ACCOUNT_ELIGIBILITY_CHECK_COUNT),
        },
      ],
    })
  )
    .unbundle()
    .map((cer) => cer.id)
    .filter((id): id is string => !!id);
  console.log('fetching the following CERs:', JSON.stringify(eligibilityCheckIds));

  const eligibilityCheckResults: CoverageEligibilityResponse[] = await Promise.all(
    eligibilityCheckIds.map((id) =>
      oystehr.fhir.get<CoverageEligibilityResponse>({ resourceType: 'CoverageEligibilityResponse', id })
    )
  );

  const coverageIdsToFetch = eligibilityCheckResults.flatMap((ecr) => {
    if (ecr.insurance?.[0]?.coverage?.reference) {
      const [resourceType, id] = ecr.insurance[0].coverage.reference.split('/');
      if (resourceType === 'Coverage') {
        return id;
      }
    }
    return [];
  });
  const coverageRequests: BatchInputGetRequest[] = coverageIdsToFetch.map((id) => ({
    method: 'GET',
    url: `Coverage/${id}`,
  }));
  const coverages: Coverage[] = coverageRequests.length
    ? (await oystehr.fhir.batch<Coverage>({ requests: coverageRequests })).entry?.flatMap((e) => e.resource ?? []) ?? []
    : [];

  const mapped = eligibilityCheckResults
    .map((result) => {
      const coverage = [...coverages, ...(result.contained ?? [])].find(
        (resource) =>
          resource.resourceType === 'Coverage' &&
          result.insurance?.[0]?.coverage?.reference?.includes(resource.id ?? '')
      ) as Coverage;
      // console.log('coverageDetails', JSON.stringify(coverage, null, 2));
      if (!coverage) {
        return null;
      }
      const coverageDetails = pullCoverageIdentifyingDetails(coverage);
      if (!coverageDetails) {
        return null;
      }
      return {
        ...parseCoverageEligibilityResponse(result),
        ...coverageDetails,
      } as CoverageCheckWithDetails;
    })
    .filter((result) => result !== null) as CoverageCheckWithDetails[];
  console.timeEnd('fetching CER IDs');
  return mapped;
};
