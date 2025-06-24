import {
  Address,
  Coverage,
  CoverageEligibilityResponse,
  InsurancePlan,
  Location,
  Organization,
  Practitioner,
} from 'fhir/r4b';
import { ELIGIBILITY_BENEFIT_CODES, INSURANCE_PLAN_ID_CODING } from '../main';
import {
  APIErrorCode,
  BillingProviderData,
  BillingProviderResource,
  CoverageCheckCoverageDetails,
  CoverageCodeToDescriptionMap,
  InsuranceCheckStatusWithDate,
  InsuranceEligibilityCheckStatus,
  PatientPaymentBenefit,
} from '../types';
import { getNPI, getTaxID } from './helpers';

export interface InsurancePlanResources {
  insurancePlan: InsurancePlan;
  organization: Organization;
}
export interface GetBillingProviderInput {
  appointmentId: string;
  plans: { primary: InsurancePlanResources; secondary?: InsurancePlanResources };
}

export interface BillingProviderDataObject {
  primary: BillingProviderData;
  secondary?: BillingProviderData;
}

export const getBillingProviderData = async (
  input: GetBillingProviderInput,
  defaultBillingResource: BillingProviderResource
): Promise<BillingProviderDataObject | undefined> => {
  /*
      In practice, the best FHIR modeling strategy for storing and querying up billing provider data is going to vary widely from one Ottehr user to the
      next.  In general, the provider data is likely to be derivable from the appointment id + the patient's insurance, so those details are taken as
      inputs here. 
      
      A single Organization resource is created in the setup script and used by default. 
      A reference string ("Organization/{uuid}") to that resource is exposed via the DEFAULT_BILLING_RESOURCE variable.
      
      You'll likely want to override this function with your implementation that either grabs the data you're after from some FHIR resource or another,
      or perhaps queries Candid's get-all-contracts endpoint https://docs.joincandidhealth.com/api-reference/contracts/v-2/get-multi.
    */
  const billingData = getBillingProviderDataFromResource(defaultBillingResource);
  if (billingData === undefined) {
    throw APIErrorCode.BILLING_PROVIDER_NOT_FOUND; // todo: better error here
  }
  const dataToReturn: BillingProviderDataObject = { primary: billingData };

  /*
    Because billing provider can vary by insurer/contract, primary and secondary data are sent separately here.
    For simplicity, we assume the default billing resource is appropriate for both primary and secondary provider here,
    but this is another default your use case may require overriding.
  */
  if (input.plans.secondary) {
    dataToReturn.secondary = { ...dataToReturn.primary };
  }
  return dataToReturn;
};

const getBillingProviderDataFromResource = (
  resource: Location | Practitioner | Organization
): BillingProviderData | undefined => {
  const { address: singleAddressOrList, id } = resource;
  if (!singleAddressOrList || !id) {
    return undefined;
  }
  const address = [singleAddressOrList]
    .flatMap((a) => a)
    .find((addr: Address) => {
      return addr.use === 'billing';
    });
  const npi = getNPI(resource);
  const taxId = getTaxID(resource);

  if (!address || !npi || !taxId) {
    return undefined;
  }
  return {
    resourceType: resource.resourceType,
    id,
    npi,
    taxId,
    address,
  };
};

export const parseCoverageEligibilityResponse = (
  coverageResponse: CoverageEligibilityResponse
): InsuranceCheckStatusWithDate => {
  const dateISO = coverageResponse.created;
  try {
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
        return { status: InsuranceEligibilityCheckStatus.eligibilityCheckNotSupported, dateISO };
      }
      console.log(`eligibility check service failure reason(s): `, errorMessages.join(', '));
      return { status: InsuranceEligibilityCheckStatus.eligibilityNotConfirmed, dateISO };
    }
    const eligible = coverageResponse.insurance?.[0].item?.some((item) => {
      const code = item.category?.coding?.[0].code;
      const isActive = item.benefit?.filter((benefit) => benefit.type.text === 'Active Coverage').length !== 0;
      return isActive && code && ELIGIBILITY_BENEFIT_CODES.includes(code);
    });

    if (eligible) {
      const fullBenefitJSON = coverageResponse.extension?.find(
        (e) => e.url === 'https://extensions.fhir.oystehr.com/raw-response'
      )?.valueString;
      let copay: PatientPaymentBenefit[] | undefined;
      if (fullBenefitJSON) {
        try {
          const benefitList = JSON.parse(fullBenefitJSON)?.elig?.benefit;
          copay = parseObjectsToCopayBenefits(benefitList);
        } catch (error) {
          console.error('Error parsing fullBenefitJSON', error);
        }
      }
      return { status: InsuranceEligibilityCheckStatus.eligibilityConfirmed, dateISO, copay };
    } else {
      return { status: InsuranceEligibilityCheckStatus.eligibilityNotConfirmed, dateISO };
    }
  } catch (error: any) {
    console.error('Error parsing eligibility check response', error);
    return { status: InsuranceEligibilityCheckStatus.eligibilityNotChecked, dateISO };
  }
};

export const parseObjectsToCopayBenefits = (input: any[]): PatientPaymentBenefit[] => {
  const filteredInputs = input.filter((item) => {
    return (
      item &&
      typeof item === 'object' &&
      (item['benefit_coverage_code'] === 'B' || item['benefit_coverage_code'] === 'A')
    );
  });

  return filteredInputs
    .map((item) => {
      const benefitCoverageCode = item['benefit_coverage_code'] as 'A' | 'B';
      const CP: PatientPaymentBenefit = {
        amountInUSD: item['benefit_amount'] ?? 0,
        percentage: item['benefit_percent'] ?? 0,
        code: item['benefit_code'] ?? '',
        description: item['benefit_description'] ?? CoverageCodeToDescriptionMap[benefitCoverageCode] ?? '',
        inNetwork: item['inplan_network'] === 'Y',
        coverageDescription: item['benefit_coverage_description'] ?? '',
        coverageCode: benefitCoverageCode,
        periodDescription: item['benefit_period_description'] ?? '',
        periodCode: item['benefit_period_code'] ?? '',
        levelDescription: item['benefit_level_description'] ?? '',
        levelCode: item['benefit_level_code'] ?? '',
      };
      return CP;
    })
    .filter((benefit) => !!benefit.description && !!benefit.code);
};

export const pullCoverageIdentifyingDetails = (coverage: Coverage): CoverageCheckCoverageDetails | undefined => {
  const subscriberId = coverage.subscriberId;
  const payorRef = coverage.payor?.[0]?.reference;

  if (!subscriberId || !payorRef) {
    return undefined;
  }

  return {
    subscriberId,
    payorRef,
    planId: getPlanIdFromCoverage(coverage),
  };
};

export const checkCoverageMatchesDetails = (coverage: Coverage, details: CoverageCheckCoverageDetails): boolean => {
  const { subscriberId, payorRef, planId } = details;

  const detailsForCoverage = pullCoverageIdentifyingDetails(coverage);
  if (!detailsForCoverage) {
    return false;
  }
  const { subscriberId: coverageSubscriberId, payorRef: coveragePayorRef, planId: coveragePlanId } = detailsForCoverage;
  const subscriberIdMatches = subscriberId === coverageSubscriberId;
  const payorRefMatches = payorRef === coveragePayorRef;
  const planIdMatches = planId === coveragePlanId;
  return subscriberIdMatches && payorRefMatches && planIdMatches;
};

export const getPlanIdFromCoverage = (coverage: Coverage): string | undefined => {
  const planCoding = coverage.class?.find((entry) => {
    return entry.type?.coding?.some((coding) => {
      return coding.system === INSURANCE_PLAN_ID_CODING.system && coding.code === INSURANCE_PLAN_ID_CODING.code;
    });
  });
  return planCoding?.value;
};
