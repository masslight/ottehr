import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import {
  Bundle,
  Coverage,
  CoverageEligibilityRequest,
  CoverageEligibilityResponse,
  DomainResource,
  InsurancePlan,
  Organization,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ELIGIBILITY_BENEFIT_CODES,
  InsuranceCheckStatusWithDate,
  InsuranceEligibilityCheckStatus,
  InsurancePlanResources,
  parseCoverageEligibilityResponse,
  removeTimeFromDate,
} from 'utils';

interface InsuranceIds {
  primary: string;
  secondary?: string;
}

export const getInsurancePlansAndOrgs = async (
  planIds: InsuranceIds,
  oystehrClient: Oystehr
): Promise<InsurancePlanResources[]> => {
  const requests: BatchInputGetRequest[] = [];

  console.log('planIds', planIds);
  requests.push({
    method: 'GET',
    url: `InsurancePlan?_id=${planIds.primary}&_include=InsurancePlan:owned-by`,
  });

  if (planIds.secondary) {
    requests.push({
      method: 'GET',
      url: `InsurancePlan?_id=${planIds.secondary}&_include=InsurancePlan:owned-by`,
    });
  }

  const batchResults = (await oystehrClient.fhir.batch({ requests })) as Bundle<Bundle<InsurancePlan | Organization>>;

  const unbundled = (batchResults.entry?.flatMap((e) => e?.resource ?? []) ?? []).flatMap(
    (i) => i.entry?.flatMap((e) => e.resource ?? []) ?? []
  );

  console.log('unbundled insurance plan search results', JSON.stringify(unbundled, null, 2));

  const reduced = unbundled.reduce((accum, curr) => {
    if (curr.resourceType === 'InsurancePlan') {
      const insurancePlan = curr as InsurancePlan;
      const match = accum.findIndex((entry) => {
        return entry?.organization && entry?.organization?.id === insurancePlan.ownedBy?.reference?.split('/')?.[1];
      });
      if (match >= 0) {
        accum[match] = { ...accum[match], insurancePlan };
      } else {
        accum.push({ insurancePlan });
      }
    } else {
      const organization = curr as Organization;
      const match = accum.findIndex((entry) => {
        return entry?.insurancePlan && entry?.insurancePlan?.ownedBy?.reference === `Organization/${organization.id}`;
      });
      if (match >= 0) {
        accum[match] = { ...accum[match], organization };
      } else {
        accum.push({ organization });
      }
    }
    return accum;
  }, [] as Partial<InsurancePlanResources>[]);
  const filtered = (
    reduced.filter((entry) => {
      return entry?.insurancePlan && entry?.organization;
    }) as InsurancePlanResources[]
  ).sort((r1, r2) => {
    if (r1.insurancePlan.id === planIds.primary) {
      return -1;
    } else if (r2.insurancePlan.id === planIds.secondary) {
      return 1;
    }
    return 0;
  });
  console.log('reduced, filtered', JSON.stringify(reduced, null, 2), JSON.stringify(filtered, null, 2));
  return filtered;
};

export interface MakeCoverageEligibilityRequestInput {
  coverageReference: string;
  payorReference: string;
  providerReference: string;
  patientReference: string;
  contained?: DomainResource['contained'];
}

export const makeCoverageEligibilityRequest = (
  input: MakeCoverageEligibilityRequestInput
): CoverageEligibilityRequest => {
  const { coverageReference, patientReference, payorReference, providerReference, contained } = input;
  const today = removeTimeFromDate(DateTime.now().toISO());
  const coverageEligibilityRequest: CoverageEligibilityRequest = {
    resourceType: 'CoverageEligibilityRequest',
    status: 'active',
    purpose: ['benefits'],
    created: today,
    servicedDate: today,
    contained,
    patient: {
      reference: patientReference,
    },
    insurer: {
      reference: payorReference,
    },
    provider: {
      reference: providerReference,
    },
    item: [
      {
        category: {
          coding: [
            {
              system: 'http://terminology.oystehr.com/CodeSystem/benefit-category',
              code: ELIGIBILITY_BENEFIT_CODES,
            },
          ],
        },
      },
    ],
    insurance: [
      {
        coverage: {
          reference: coverageReference,
        },
      },
    ],
  };
  return coverageEligibilityRequest;
};

export const parseEligibilityCheckResponsePromiseResult = async (
  eligibilityCheckResponse: PromiseFulfilledResult<Response> | PromiseRejectedResult
): Promise<InsuranceCheckStatusWithDate> => {
  const now = DateTime.now().toISO();
  if (eligibilityCheckResponse.status === 'rejected') {
    console.log('eligibility check service failure reason: ', JSON.stringify(eligibilityCheckResponse.reason, null, 2));
    return { status: InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO: now };
  } else if (!eligibilityCheckResponse.value.ok) {
    const message = await eligibilityCheckResponse.value.json();
    console.log('eligibility check service failure reason: ', JSON.stringify(message, null, 2));
    return { status: InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO: now };
  }
  try {
    const coverageResponse = (await eligibilityCheckResponse.value.json()) as CoverageEligibilityResponse;
    console.log('coverageResponse: ', JSON.stringify(coverageResponse, null, 2));
    return parseCoverageEligibilityResponse(coverageResponse);
  } catch (error: any) {
    console.error('API response included an error', error);
    return { status: InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO: now };
  }
};

export const getPayorRef = (coverage: Coverage, orgs: Organization[]): string | undefined => {
  const payor = orgs.find((org) => {
    return coverage.payor.some((res) => {
      return res.reference === `Organization/${org.id}`;
    });
  });
  return payor ? `Organization/${payor.id}` : undefined;
};
