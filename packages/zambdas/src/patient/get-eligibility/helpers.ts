import Oystehr from '@oystehr/sdk';
import {
  Coverage,
  CoverageEligibilityRequest,
  CoverageEligibilityResponse,
  DomainResource,
  Organization,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ELIGIBILITY_BENEFIT_CODES,
  InsuranceCheckStatusWithDate,
  InsuranceEligibilityCheckStatus,
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
): Promise<Organization[]> => {
  const orgs = (
    await oystehrClient.fhir.search<Organization>({
      resourceType: 'Organization',
      params: [
        {
          name: '_id',
          value: `${planIds.primary}${planIds.secondary ? `,${planIds.secondary}` : ''}`,
        },
      ],
    })
  ).unbundle();

  const sorted = orgs.sort((r1, r2) => {
    if (r1.id === planIds.primary) {
      return -1;
    } else if (r2.id === planIds.secondary) {
      return 1;
    }
    return 0;
  });
  console.log('sorted', JSON.stringify(sorted, null, 2));
  return sorted;
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
