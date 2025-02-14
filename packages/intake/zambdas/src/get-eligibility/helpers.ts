import Oystehr, { BatchInputGetRequest } from '@oystehr/sdk';
import {
  Bundle,
  CoverageEligibilityRequest,
  CoverageEligibilityResponse,
  DomainResource,
  InsurancePlan,
  Organization,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ELIGIBILITY_BENEFIT_CODES,
  InsuranceEligibilityCheckStatus,
  InsurancePlanResources,
  removeTimeFromDate,
} from 'utils';

// todo: move this into a higher level util
export const performEligibilityCheck = (
  coverageEligibilityRequestId: string | undefined,
  projectApiURL: string,
  oystehrToken: string
): Promise<Response> => {
  return fetch(`${projectApiURL}/rcm/eligibility-check`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${oystehrToken}`,
    },
    body: JSON.stringify({
      eligibilityRequestId: coverageEligibilityRequestId,
    }),
  });
};

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

export const parseEligibilityCheckResponse = async (
  eligibilityCheckResponse: PromiseFulfilledResult<Response> | PromiseRejectedResult
): Promise<InsuranceEligibilityCheckStatus> => {
  if (eligibilityCheckResponse.status === 'rejected') {
    console.log('eligibility check service failure reason: ', JSON.stringify(eligibilityCheckResponse.reason, null, 2));
    return InsuranceEligibilityCheckStatus.eligibilityNotChecked;
  } else if (!eligibilityCheckResponse.value.ok) {
    const message = await eligibilityCheckResponse.value.json();
    console.log('eligibility check service failure reason: ', JSON.stringify(message, null, 2));
    return InsuranceEligibilityCheckStatus.eligibilityNotChecked;
  }
  try {
    const coverageResponse = (await eligibilityCheckResponse.value.json()) as CoverageEligibilityResponse;
    console.log('coverageResponse: ', JSON.stringify(coverageResponse, null, 2));

    if (coverageResponse.error) {
      const errors = coverageResponse.error.map((error) => ({
        code: error.code.coding?.[0].code,
        text: error.code.text,
      }));
      console.log('errors', JSON.stringify(errors));
      const errorCodes = errors.map((error) => error.code);
      const errorMessages = errors.map((error) => error.text);
      if (errorCodes.includes('410')) {
        // "Payer ID [<ID>] does not support real-time eligibility."
        console.log('Payer does not support real-time eligibility. Bypassing.');
        return InsuranceEligibilityCheckStatus.eligibilityCheckNotSupported;
      }
      console.log(`eligibility check service failure reason(s): `, errorMessages.join(', '));
      return InsuranceEligibilityCheckStatus.eligibilityNotConfirmed;
    }

    const eligible = coverageResponse.insurance?.[0].item?.some((item) => {
      const code = item.category?.coding?.[0].code;
      const isActive = item.benefit?.filter((benefit) => benefit.type.text === 'Active Coverage').length !== 0;
      return isActive && code && ELIGIBILITY_BENEFIT_CODES.includes(code);
    });
    // console.log('eligible', eligible);
    if (eligible) {
      return InsuranceEligibilityCheckStatus.eligibilityConfirmed;
    } else {
      // console.log('error result: ', JSON.stringify(coverageResponse.insurance?.[0].item, null, 2));
      return InsuranceEligibilityCheckStatus.eligibilityNotConfirmed;
    }
  } catch (error: any) {
    console.error('API response included an error', error);
    return InsuranceEligibilityCheckStatus.eligibilityNotChecked;
  }
};
