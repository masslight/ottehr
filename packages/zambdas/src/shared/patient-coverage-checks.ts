import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import { BundleEntry, Coverage, CoverageEligibilityResponse } from 'fhir/r4b';
import { parseCoverageEligibilityResponse, pullCoverageIdentifyingDetails } from 'utils/lib/fhir/billing';
import { CoverageCheckWithDetails, PATIENT_ACCOUNT_ELIGIBILITY_CHECK_COUNT } from 'utils/lib/types/api/patient-account';

export interface PayerAndMemberId {
  payerId: string;
  memberId: string;
}

interface ResolvedCoverageCheck {
  check: CoverageCheckWithDetails | null;
  coverageUnreadable: boolean;
}

const searchCoverageEligibilityResponseIds = async (
  patientId: string,
  oystehr: Oystehr,
  offset?: number
): Promise<string[]> =>
  (
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
        ...(offset === undefined ? [] : [{ name: '_offset', value: String(offset) }]),
      ],
    })
  )
    .unbundle()
    .map((cer) => cer.id)
    .filter((id): id is string => !!id);

const getCoverageEligibilityResponse = (id: string, oystehr: Oystehr): Promise<CoverageEligibilityResponse> =>
  oystehr.fhir.get<CoverageEligibilityResponse>({ resourceType: 'CoverageEligibilityResponse', id });

const referencedCoverageId = (ecr: CoverageEligibilityResponse): string | undefined => {
  if (ecr.insurance?.[0]?.coverage?.reference) {
    const [resourceType, id] = ecr.insurance[0].coverage.reference.split('/');
    if (resourceType === 'Coverage') {
      return id;
    }
  }
  return undefined;
};

const isCoverageUnreadable = (entry: BundleEntry<Coverage> | undefined): boolean =>
  entry?.resource?.resourceType !== 'Coverage' && !/^(404|410)\b/.test(entry?.response?.status ?? '');

const resolveCoverageChecks = async (
  eligibilityCheckResults: CoverageEligibilityResponse[],
  oystehr: Oystehr
): Promise<ResolvedCoverageCheck[]> => {
  const coverageIdsToFetch = eligibilityCheckResults.flatMap((ecr) => referencedCoverageId(ecr) ?? []);
  const coverageRequests: BatchInputGetRequest[] = coverageIdsToFetch.map((id) => ({
    method: 'GET',
    url: `Coverage/${id}`,
  }));
  const coverageEntries = coverageRequests.length
    ? (await oystehr.fhir.batch<Coverage>({ requests: coverageRequests })).entry ?? []
    : [];
  const coverages: Coverage[] = coverageEntries.flatMap((e) => e.resource ?? []);
  const unreadableCoverageIds = new Set(
    coverageIdsToFetch.filter((_, index) => isCoverageUnreadable(coverageEntries[index]))
  );

  return eligibilityCheckResults.map((result) => {
    const coverageId = referencedCoverageId(result);
    const coverageUnreadable = coverageId !== undefined && unreadableCoverageIds.has(coverageId);
    const coverage = [...coverages, ...(result.contained ?? [])].find(
      (resource) =>
        resource.resourceType === 'Coverage' && result.insurance?.[0]?.coverage?.reference?.includes(resource.id ?? '')
    ) as Coverage;
    // console.log('coverageDetails', JSON.stringify(coverage, null, 2));
    if (!coverage) {
      return { check: null, coverageUnreadable };
    }
    const coverageDetails = pullCoverageIdentifyingDetails(coverage);
    if (!coverageDetails) {
      return { check: null, coverageUnreadable };
    }
    return {
      check: {
        ...parseCoverageEligibilityResponse(result),
        ...coverageDetails,
        payerId: coverage.class?.[0]?.value,
        relationship: coverage.relationship?.coding?.[0]?.display,
      } as CoverageCheckWithDetails,
      coverageUnreadable,
    };
  });
};

export const getPatientCoverageChecks = async (
  patientId: string,
  oystehr: Oystehr
): Promise<CoverageCheckWithDetails[]> => {
  // due to really huge CEResponses causing response-too-large errors, we need to chop our querying for the CEResponses into
  // manageable chunks. We'll do this by first querying for just the IDs of the CEResponses, then querying for the full resources in parallel.
  // Even just two resources returned in a query can still result in response-too-large errors based on prod data we've encountered.
  console.time('fetching CER IDs');
  const eligibilityCheckIds = await searchCoverageEligibilityResponseIds(patientId, oystehr);
  console.log('fetching the following CERs:', JSON.stringify(eligibilityCheckIds));

  const eligibilityCheckResults: CoverageEligibilityResponse[] = await Promise.all(
    eligibilityCheckIds.map((id) => getCoverageEligibilityResponse(id, oystehr))
  );

  const mapped = (await resolveCoverageChecks(eligibilityCheckResults, oystehr)).flatMap(({ check }) => check ?? []);
  console.timeEnd('fetching CER IDs');
  return mapped;
};

export const coverageCheckMatches = (
  check: CoverageCheckWithDetails,
  { payerId, memberId }: PayerAndMemberId
): boolean => check.payerId === payerId && check.subscriberId === memberId;

export const findLatestCoverageCheck = async (
  patientId: string,
  payerAndMemberId: PayerAndMemberId,
  oystehr: Oystehr,
  deadline: number
): Promise<CoverageCheckWithDetails | undefined> => {
  const unreadResponseIds: string[] = [];
  const incomplete = (reason: string): Error =>
    new Error(
      `Could not establish the latest eligibility check: ${reason}` +
        (unreadResponseIds.length ? `; unread CoverageEligibilityResponses: ${unreadResponseIds.join(', ')}` : '')
    );

  for (let offset = 0; ; offset += PATIENT_ACCOUNT_ELIGIBILITY_CHECK_COUNT) {
    if (Date.now() >= deadline) {
      throw incomplete(`search stopped at its time budget after ${offset} responses`);
    }
    const ids = await searchCoverageEligibilityResponseIds(patientId, oystehr, offset);
    const settled = await Promise.allSettled(ids.map((id) => getCoverageEligibilityResponse(id, oystehr)));
    const loaded = settled.flatMap((result) => (result.status === 'fulfilled' ? [result.value] : []));
    const resolved = await resolveCoverageChecks(loaded, oystehr);

    let loadedIndex = 0;
    for (const [index, result] of settled.entries()) {
      if (result.status === 'rejected') {
        console.error(`Failed to read CoverageEligibilityResponse/${ids[index]}:`, result.reason);
        unreadResponseIds.push(ids[index]);
        continue;
      }
      const { check, coverageUnreadable } = resolved[loadedIndex++];
      if (coverageUnreadable) {
        unreadResponseIds.push(ids[index]);
        continue;
      }
      if (check && coverageCheckMatches(check, payerAndMemberId)) {
        if (unreadResponseIds.length) {
          throw incomplete('newer responses could not be read');
        }
        return check;
      }
    }

    if (ids.length < PATIENT_ACCOUNT_ELIGIBILITY_CHECK_COUNT) {
      break;
    }
  }

  if (unreadResponseIds.length) {
    throw incomplete('no readable response matched');
  }
  return undefined;
};
