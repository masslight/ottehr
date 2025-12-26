import { Address, Coverage, CoverageEligibilityResponse, Location, Organization, Practitioner } from 'fhir/r4b';
import { ELIGIBILITY_BENEFIT_CODES, INSURANCE_PLAN_ID_CODING } from '../main';
import {
  APIErrorCode,
  BillingProviderData,
  BillingProviderResource,
  CoverageCheckCoverageDetails,
  CoverageCodeToDescriptionMap,
  FinancialDetails,
  InsuranceCheckStatusWithDate,
  InsuranceDetails,
  InsuranceEligibilityCheckStatus,
  PatientPaymentBenefit,
} from '../types';
import { getNPI, getTaxID } from './helpers';

export interface GetBillingProviderInput {
  appointmentId: string;
  plans: { primary: Organization; secondary?: Organization };
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
        return {
          status: InsuranceEligibilityCheckStatus.eligibilityCheckNotSupported,
          dateISO,
          errors: coverageResponse.error,
        };
      }
      console.log(`eligibility check service failure reason(s): `, errorMessages.join(', '));
      return {
        status: InsuranceEligibilityCheckStatus.eligibilityNotConfirmed,
        dateISO,
        errors: coverageResponse.error,
      };
    }
    const eligible = coverageResponse.insurance?.[0].item?.some((item) => {
      const code = item.category?.coding?.[0].code;
      const isActive = item.benefit?.filter((benefit) => benefit.type.text === 'Active Coverage').length !== 0;
      return isActive && code && ELIGIBILITY_BENEFIT_CODES.includes(code);
    });

    if (eligible) {
      const fullBenefitsRequestJSON = coverageResponse.extension?.find(
        (e) => e.url === 'https://extensions.fhir.oystehr.com/raw-request'
      )?.valueString;
      const fullBenefitJSON = coverageResponse.extension?.find(
        (e) => e.url === 'https://extensions.fhir.oystehr.com/raw-response'
      )?.valueString;
      let copay: PatientPaymentBenefit[] | undefined;
      let deductible: PatientPaymentBenefit[] | undefined;
      const details: InsuranceDetails = {};
      const financialDetails: FinancialDetails[] = [];
      if (fullBenefitsRequestJSON) {
        const benefitsRequest = JSON.parse(fullBenefitsRequestJSON);
        details['patient'] = {
          firstName: benefitsRequest['pat_name_f'],
          middleName: benefitsRequest['pat_name_m'],
          lastName: benefitsRequest['pat_name_l'],
          dateOfBirth: `${benefitsRequest['pat_dob'].slice(4, 6)}/${benefitsRequest['pat_dob'].slice(
            6,
            8
          )}/${benefitsRequest['pat_dob'].slice(0, 4)}`,
        };
      }
      if (fullBenefitJSON) {
        try {
          const benefitsResponse = JSON.parse(fullBenefitJSON);
          const benefitList = benefitsResponse?.elig?.benefit;
          const benefitsTemp = parseObjectsToCopayBenefits(benefitList);
          details['subscriber'] = {
            firstName: benefitsResponse['elig']?.['ins_name_f'],
            middleName: benefitsResponse['elig']?.['ins_name_m'],
            lastName: benefitsResponse['elig']?.['ins_name_l'],
            dateOfBirth: `${benefitsResponse['elig']?.['ins_dob']?.slice(4, 6)}/${benefitsResponse['elig']?.[
              'ins_dob'
            ]?.slice(6, 8)}/${benefitsResponse['elig']?.['ins_dob']?.slice(0, 4)}`,
            memberID: benefitsResponse['elig']?.['ins_number'],
            address: `${benefitsResponse['elig']?.['ins_addr_1']} ${benefitsResponse['elig']?.['ins_city']}, ${benefitsResponse['elig']?.['ins_state']} ${benefitsResponse['elig']?.['ins_zip']}`,
          };
          const insuranceDetails = benefitsTemp.find(
            (benefit) => benefit.coverageCode === '1' && benefit.code === '30'
          );
          details['insurance'] = {
            planNumber: benefitsResponse['elig']?.['plan_number'],
            policyNumber: insuranceDetails?.policyNumber,
            insuranceCode: insuranceDetails?.insuranceCode,
            insuranceDescription: insuranceDetails?.insuranceDescription,
          };

          details['payer'] = {
            name: insuranceDetails?.payerName,
            payerID: insuranceDetails?.payerID,
            address: insuranceDetails?.payerAddress,
            website: insuranceDetails?.payerWebsite,
            phone: insuranceDetails?.payerPhone,
            fax: insuranceDetails?.payerFax,
          };

          copay = benefitsTemp.filter((benefit) => benefit.coverageCode === 'A' || benefit.coverageCode === 'B');
          deductible = benefitsTemp.filter((benefit) => benefit.coverageCode === 'C');

          const individualDeductible = deductible.filter((benefit) => benefit.levelCode === 'IND');
          const familyDeductible = deductible.filter((benefit) => benefit.levelCode === 'FAM');
          const outOfPocketMax = benefitsTemp.filter(
            (benefit) => benefit.coverageCode === 'G' && benefit.levelCode === 'IND'
          );
          financialDetails.push({
            name: 'Individual Deductible',
            paid: individualDeductible.find((benefit) => benefit.periodCode === '24')?.amountInUSD,
            total: individualDeductible.find((benefit) => benefit.periodCode === '23')?.amountInUSD,
            remaining: individualDeductible.find((benefit) => benefit.periodCode === '29')?.amountInUSD,
          });
          financialDetails.push({
            name: 'Family Deductible',
            paid: familyDeductible.find((benefit) => benefit.periodCode === '24')?.amountInUSD,
            total: familyDeductible.find((benefit) => benefit.periodCode === '23')?.amountInUSD,
            remaining: familyDeductible.find((benefit) => benefit.periodCode === '29')?.amountInUSD,
          });
          financialDetails.push({
            name: 'Out-of-Pocket Max',
            paid: outOfPocketMax.find((benefit) => benefit.periodCode === '24')?.amountInUSD,
            total: outOfPocketMax.find((benefit) => benefit.periodCode === '23')?.amountInUSD,
            remaining: outOfPocketMax.find((benefit) => benefit.periodCode === '29')?.amountInUSD,
          });
        } catch (error) {
          console.error('Error parsing fullBenefitJSON', error);
        }
      }
      return {
        status: InsuranceEligibilityCheckStatus.eligibilityConfirmed,
        dateISO,
        coverageDetails: details,
        financialDetails,
        copay,
        deductible,
        errors: coverageResponse.error,
      };
    } else {
      return {
        status: InsuranceEligibilityCheckStatus.eligibilityNotConfirmed,
        dateISO,
        errors: coverageResponse.error,
      };
    }
  } catch (error: any) {
    console.error('Error parsing eligibility check response', error);
    return {
      status: InsuranceEligibilityCheckStatus.eligibilityNotChecked,
      dateISO,
      errors: coverageResponse.error,
    };
  }
};

export const parseObjectsToCopayBenefits = (input: any[]): PatientPaymentBenefit[] => {
  return input
    .map((item) => {
      const benefitCoverageCode = item['benefit_coverage_code'] as '1' | 'A' | 'B' | 'C';
      const CP: PatientPaymentBenefit = {
        amountInUSD: Number(item['benefit_amount']) ?? 0,
        percentage: item['benefit_percent'] ?? 0,
        code: item['benefit_code'] ?? '',
        description: item['benefit_description'] ?? CoverageCodeToDescriptionMap[benefitCoverageCode] ?? '',
        // cSpell:disable-next in plan network
        inNetwork: item['inplan_network'] === 'Y',
        coverageDescription: item['benefit_coverage_description'] ?? '',
        coverageCode: benefitCoverageCode,
        periodDescription: item['benefit_period_description'] ?? '',
        periodCode: item['benefit_period_code'] ?? '',
        levelDescription: item['benefit_level_description'] ?? '',
        levelCode: item['benefit_level_code'] ?? '',
        policyNumber: item['policy_number'] ?? '',
        insuranceCode: item['insurance_type_code'] ?? '',
        insuranceDescription: item['insurance_type_description'] ?? '',
        payerName: item['entity_name']?.[0],
        payerID: item['entity_id']?.[0],
        payerAddress: `${item['entity_addr_1']?.[0]} ${item['entity_city']}, ${item['entity_state']} ${item['entity_zip']}`,
        payerWebsite: item['entity_website']?.[0],
        payerPhone: item['entity_phone']?.[0],
        payerFax: item['entity_fax']?.[0],
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
