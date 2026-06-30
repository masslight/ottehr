import { Address, Coding, Coverage, CoverageEligibilityResponse, Location, Organization, Practitioner } from 'fhir/r4b';
import {
  CODE_SYSTEM_CPT_MODIFIER,
  ELIGIBILITY_BENEFIT_CODES,
  EXTENSION_CLAIM_INSURANCE_TYPE,
  EXTENSION_URL_CPT_MODIFIER,
  INSURANCE_PLAN_ID_CODING,
} from '../main';
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
import { CANDID_PLAN_TYPE_SYSTEM } from './insurance';

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
          // Payers do not reliably attach insurance_type_code / insurance_type_description to the
          // Active Coverage / Health Benefit Plan Coverage (coverageCode '1' / code '30') benefit line.
          // Scan the full raw benefit list for the first entry that carries insurance-type info and use
          // it as a fallback so the insurance type surfaces even when it lives on another benefit line.
          const benefitWithInsType = (Array.isArray(benefitList) ? benefitList : []).find(
            (benefit: any) => benefit?.['insurance_type_code'] || benefit?.['insurance_type_description']
          );
          details['insurance'] = {
            planNumber: benefitsResponse['elig']?.['plan_number'],
            policyNumber: insuranceDetails?.policyNumber,
            insuranceCode: insuranceDetails?.insuranceCode || benefitWithInsType?.['insurance_type_code'],
            insuranceDescription:
              insuranceDetails?.insuranceDescription || benefitWithInsType?.['insurance_type_description'],
          };

          // Payer/entity details (name, ID, address, phone, etc.) are not always attached to the same
          // benefit line we read insurance type from. For Medicaid responses they typically live on the
          // managed care organization (MCO) line rather than the fee-for-service line, so source the payer
          // section from the first benefit that actually carries entity info, falling back to the code-30 line.
          const payerSourceBenefit =
            benefitsTemp.find((benefit) => benefit.payerName || benefit.payerID || benefit.payerAddress) ??
            insuranceDetails;
          details['payer'] = {
            name: payerSourceBenefit?.payerName,
            payerID: payerSourceBenefit?.payerID,
            address: payerSourceBenefit?.payerAddress,
            website: payerSourceBenefit?.payerWebsite,
            phone: payerSourceBenefit?.payerPhone,
            fax: payerSourceBenefit?.payerFax,
          };

          // Collect every active-coverage (code '30') line so the UI can list each plan the member is
          // enrolled in (e.g. Medicaid FFS + the MCO), including the MCO entity reported on that line.
          const plans = benefitsTemp
            .filter((benefit) => benefit.coverageCode === '1' && benefit.code === '30')
            .map((benefit) => ({
              planName: benefit.insurancePlan,
              entityName: benefit.payerName,
              entityType: benefit.entityType,
              phone: benefit.payerPhone,
              payerID: benefit.payerID,
              insuranceCode: benefit.insuranceCode,
              insuranceDescription: benefit.insuranceDescription,
            }))
            .filter((plan) => plan.planName || plan.entityName);
          if (plans.length > 0) {
            details['plans'] = plans;
          }

          const additionalPayers = (Array.isArray(benefitList) ? benefitList : [])
            .filter((benefit: any) => benefit?.['benefit_coverage_code'] === 'R')
            .map((benefit: any) => {
              const firstEntity = Array.isArray(benefit?.['entity']) ? benefit['entity'][0] : undefined;
              return {
                benefitRange: benefit?.['benefit'],
                planSponsor: benefit?.['mco_name'],
                planNetworkId: benefit?.['mco_number'],
                payerName: firstEntity?.['entity_name'] || benefit?.['entity_name']?.[0],
                payerID: firstEntity?.['entity_id'] || benefit?.['entity_id']?.[0],
                payerRole: firstEntity?.['entity_description'] || benefit?.['entity_description']?.[0],
                insuranceCode: benefit?.['insurance_type_code'],
                insuranceDescription: benefit?.['insurance_type_description'],
                notes: benefit?.['benefit_notes'],
              };
            })
            .filter(
              (payer) =>
                payer.planSponsor ||
                payer.planNetworkId ||
                payer.payerName ||
                payer.payerID ||
                payer.benefitRange ||
                payer.insuranceCode ||
                payer.insuranceDescription ||
                payer.notes
            );

          if (additionalPayers.length > 0) {
            details['additionalPayers'] = additionalPayers;
          }

          copay = benefitsTemp.filter((benefit) => benefit.coverageCode === 'A' || benefit.coverageCode === 'B');
          deductible = benefitsTemp.filter((benefit) => benefit.coverageCode === 'C');

          // Exclude only explicit out-of-network ('N') lines so in-network panel values aren't mixed across networks.
          const isInNetwork = (benefit: PatientPaymentBenefit): boolean => benefit.inPlanNetworkCode !== 'N';

          const individualDeductible = deductible.filter(
            (benefit) => benefit.levelCode === 'IND' && isInNetwork(benefit)
          );
          const familyDeductible = deductible.filter((benefit) => benefit.levelCode === 'FAM' && isInNetwork(benefit));
          const outOfPocketMax = benefitsTemp.filter(
            (benefit) => benefit.coverageCode === 'G' && benefit.levelCode === 'IND' && isInNetwork(benefit)
          );

          // Some payers (e.g. Medicaid FFS) report deductibles per service with no coverage-level
          // (IND/FAM) or time-period (23/24/29) qualifiers. When no qualified individual-deductible
          // line is present but every reported deductible line is $0, surface $0 ("no deductible
          // applies") instead of leaving the amounts undefined (which renders as "Unknown").
          const allDeductiblesAreZero =
            deductible.length > 0 && deductible.every((benefit) => benefit.amountInUSD === 0);
          const individualDeductibleFallback =
            individualDeductible.length === 0 && allDeductiblesAreZero ? 0 : undefined;

          financialDetails.push({
            name: 'Individual Deductible',
            paid:
              individualDeductible.find((benefit) => benefit.periodCode === '24')?.amountInUSD ??
              individualDeductibleFallback,
            total:
              individualDeductible.find((benefit) => benefit.periodCode === '23')?.amountInUSD ??
              individualDeductibleFallback,
            remaining:
              individualDeductible.find((benefit) => benefit.periodCode === '29')?.amountInUSD ??
              individualDeductibleFallback,
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
      const benefitCoverageCode = item['benefit_coverage_code'] as '1' | 'A' | 'B' | 'C' | 'G';
      const payerAddressParts = [
        item['entity_addr_1']?.[0],
        item['entity_city'],
        item['entity_state'],
        item['entity_zip'],
      ].filter(Boolean);
      const payerAddress = payerAddressParts.length
        ? `${item['entity_addr_1']?.[0] ?? ''} ${item['entity_city'] ?? ''}, ${item['entity_state'] ?? ''} ${
            item['entity_zip'] ?? ''
          }`.trim()
        : undefined;
      const parsedAmount = Number(item['benefit_amount']);
      const CP: PatientPaymentBenefit = {
        amountInUSD: Number.isFinite(parsedAmount) ? parsedAmount : 0,
        percentage: item['benefit_percent'] ?? 0,
        code: item['benefit_code'] ?? '',
        description: item['benefit_description'] ?? CoverageCodeToDescriptionMap[benefitCoverageCode] ?? '',
        // cSpell:disable-next in plan network
        inNetwork: item['inplan_network'] === 'Y',
        // cSpell:disable-next in plan network
        inPlanNetworkCode: item['inplan_network'],
        coverageDescription: item['benefit_coverage_description'] ?? '',
        coverageCode: benefitCoverageCode,
        periodDescription: item['benefit_period_description'] ?? '',
        periodCode: item['benefit_period_code'] ?? '',
        levelDescription: item['benefit_level_description'] ?? '',
        levelCode: item['benefit_level_code'] ?? '',
        policyNumber: item['policy_number'] ?? '',
        insuranceCode: item['insurance_type_code'] ?? '',
        insuranceDescription: item['insurance_type_description'] ?? '',
        benefitNotes: item['benefit_notes'] ?? '',
        insurancePlan: item['insurance_plan'],
        payerName: item['entity_name']?.[0],
        payerID: item['entity_id']?.[0],
        payerAddress,
        payerWebsite: item['entity_website']?.[0],
        payerPhone: item['entity_phone']?.[0],
        payerFax: item['entity_fax']?.[0],
        entityType: item['entity_description']?.[0],
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

export const extractCptCodeModifiersFromCoding = (coding: Coding): { code: string; display: string }[] => {
  if (!coding.extension) return [];
  const modifierExtension = coding.extension.find((ext) => ext.url === EXTENSION_URL_CPT_MODIFIER);
  if (!modifierExtension || !modifierExtension.valueCodeableConcept?.coding) return [];
  const modifiers = modifierExtension.valueCodeableConcept.coding
    .filter((extCoding) => extCoding.system === CODE_SYSTEM_CPT_MODIFIER)
    .map((extCoding) => ({ code: extCoding.code ?? '', display: extCoding.display ?? '' }));
  console.log(`Modifiers for the coding ${JSON.stringify(coding)}: `, JSON.stringify(modifiers));
  return modifiers;
};

// Maps the claim.md insurance type code returned by the eligibility check (key)
// to the candid/availity insurance plan type code used by the insurance form dropdown (value).
export const INSURANCE_TYPE_CODE_TO_CANDID_CODE: Record<string, string> = {
  '12': '16',
  '13': '16',
  '14': 'LM',
  '15': 'WC',
  '16': 'OF',
  '41': '16',
  '42': 'VA',
  '43': '16',
  '47': 'LM',
  AP: 'AM',
  C1: 'CI',
  CO: '11',
  CP: 'MA',
  D: 'DS',
  DB: 'DS',
  EP: '12',
  FF: '11',
  GP: '12',
  HM: 'HM',
  HN: '16',
  HS: '11',
  IN: '15',
  IP: 'CI',
  LC: '11',
  LD: '11',
  LI: '11',
  LT: 'LM',
  MA: 'MA',
  MB: 'MB',
  MC: 'MC',
  MH: '11',
  MI: '11',
  MP: 'MA',
  OT: 'ZZ',
};

/**
 * Maps a claim.md insurance type code (from an eligibility check) to the candid/availity
 * insurance plan type code used by the insurance form dropdown. Returns undefined when the
 * code is missing or has no mapping.
 */
export const mapInsuranceTypeCodeToCandidCode = (insuranceTypeCode: string | undefined): string | undefined => {
  if (!insuranceTypeCode) return undefined;
  return INSURANCE_TYPE_CODE_TO_CANDID_CODE[insuranceTypeCode];
};

export const getCoverageInsuranceType = (coverage?: Coverage): string | undefined =>
  coverage?.extension?.find((ext) => ext.url === EXTENSION_CLAIM_INSURANCE_TYPE)?.valueString ??
  coverage?.type?.coding?.find((coding) => coding.system === CANDID_PLAN_TYPE_SYSTEM)?.code;

export const setCoverageInsuranceType = (coverage: Coverage, candidCode: string): Coverage => {
  const otherExtensions = (coverage.extension ?? []).filter((ext) => ext.url !== EXTENSION_CLAIM_INSURANCE_TYPE);
  const otherTypeCodings = (coverage.type?.coding ?? []).filter((coding) => coding.system !== CANDID_PLAN_TYPE_SYSTEM);
  return {
    ...coverage,
    type: {
      ...coverage.type,
      coding: [
        ...otherTypeCodings,
        {
          system: CANDID_PLAN_TYPE_SYSTEM,
          code: candidCode,
        },
      ],
    },
    extension: [
      ...otherExtensions,
      {
        url: EXTENSION_CLAIM_INSURANCE_TYPE,
        valueString: candidCode,
      },
    ],
  };
};
