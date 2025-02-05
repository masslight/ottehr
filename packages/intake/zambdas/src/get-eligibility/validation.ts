import Oystehr from '@oystehr/sdk';
import { QuestionnaireResponseItem } from 'fhir/r4b';
import {
  APIErrorCode,
  BillingProviderData,
  BillingProvideResource,
  getBillingProviderDataFromResource,
  GetEligibilityInput,
  GetEligibilityInsuranceData,
  GetEligibilityParameters,
  GetEligibilityPolicyHolder,
  InsuranceEligibilityPrevalidationInput,
  InsurancePlanDTO,
  isValidUUID,
  ZambdaInput,
} from 'utils';

export function validateRequestParameters(input: ZambdaInput): GetEligibilityInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const { coveragePrevalidationInput, patientId, appointmentId } = JSON.parse(input.body) as GetEligibilityParameters;

  if (!appointmentId || !isValidUUID(appointmentId)) {
    throw new Error('Parameter "appointmentId" must be included in input body and be a valid UUID.');
  }
  if (!patientId || !isValidUUID(patientId)) {
    throw new Error('Parameter "patientId" must be included in input body and be a valid UUID.');
  }

  if (coveragePrevalidationInput !== undefined) {
    const { responseItems, billingProviderResource } = coveragePrevalidationInput;
    if (responseItems === undefined) {
      throw new Error('Parameter "responseItems" must be included in prevalidation input');
    }
    if (responseItems !== undefined && (!Array.isArray(responseItems) || typeof responseItems[0] !== 'object')) {
      throw new Error('Parameter "prevalidationInput.responseItems" must be an array of objects when included');
    }
    if (billingProviderResource === undefined) {
      throw new Error('Parameter "billingProviderResource" must be included in prevalidation input');
    }
    const bpType = billingProviderResource.type;
    if (!bpType || !['Location', 'Organization', 'Practitioner'].includes(bpType)) {
      throw new Error(
        'Parameter "billingProviderResource" must include a "type" property of "Location", "Practitioner", or "Organziation"'
      );
    }
    const { reference } = billingProviderResource;
    if (reference === undefined || typeof reference !== 'string') {
      throw new Error('Parameter "billingProviderResource" must "reference" property of type string');
    }
    const [refType, refId] = reference.split('/');
    if (!refType || !refId || !isValidUUID(refId)) {
      throw new Error('Parameter "billingProviderResource.reference" was malformed. Must be {ResourceType}/{uuid}');
    }
    if (refType !== bpType) {
      throw new Error(
        `Parameter "billingProviderResource" contained inconsistent type and reference properties: ${refType} !== ${bpType}`
      );
    }
    if (responseItems) {
      const primaryPolicyHolder = mapResponseItemsToInsurancePolicyHolder(responseItems);
      const primaryInsuranceData = mapResponseItemsToInsuranceData(responseItems);
      const secondaryInsuranceItem = responseItems.find((item) => item.linkId === 'secondary-insurance');
      let secondaryPolicyHolder: GetEligibilityPolicyHolder | undefined;
      let secondaryInsuranceData: GetEligibilityInsuranceData | undefined;
      if (secondaryInsuranceItem !== undefined) {
        secondaryPolicyHolder = mapResponseItemsToInsurancePolicyHolder(secondaryInsuranceItem?.item ?? [], '-2');
        secondaryInsuranceData = mapResponseItemsToInsuranceData(secondaryInsuranceItem.item ?? [], '-2');
      }
      console.log('primaryPolicyHolder', JSON.stringify(primaryPolicyHolder));
      console.log('primaryInsuranceData', JSON.stringify(primaryInsuranceData));
      return {
        appointmentId,
        patientId,
        primaryPolicyHolder,
        primaryInsuranceData,
        secondaryPolicyHolder,
        secondaryInsuranceData,
        secrets: input.secrets,
        coveragePrevalidationInput: coveragePrevalidationInput,
      };
    }
  }

  const { primaryInsuranceData, primaryPolicyHolder, secondaryInsuranceData, secondaryPolicyHolder } = JSON.parse(
    input.body
  ) as GetEligibilityParameters;

  if (!primaryInsuranceData) {
    throw new Error('Parameter "insurance" must be included in input body.');
  }
  if (!primaryInsuranceData.insuranceId || !isValidUUID(primaryInsuranceData.insuranceId)) {
    throw new Error('Parameter "insurance.insuranceId" must be included in input body and be a valid UUID.');
  }
  if (!primaryInsuranceData.memberId) {
    throw new Error('Parameter "insurance.memberId" must be included in input body and be a non-empty string.');
  }
  if (!primaryPolicyHolder) {
    throw new Error('Parameter "policyHolder" must be included in input body.');
  }
  if (typeof primaryPolicyHolder.isPatient !== 'boolean') {
    throw new Error('Parameter "policyHolder.isPatient" must be included in input body and be a boolean.');
  }

  return {
    appointmentId,
    primaryInsuranceData,
    patientId,
    primaryPolicyHolder,
    secondaryInsuranceData,
    secondaryPolicyHolder,
    secrets: input.secrets,
  };
}

export const validateInsuranceRequirements = ({
  insurancePlanDto,
  insuranceData,
  policyHolder,
  primary,
}: {
  insurancePlanDto: InsurancePlanDTO;
  insuranceData: GetEligibilityInsuranceData;
  policyHolder: GetEligibilityPolicyHolder;
  primary: boolean;
}): void => {
  const prefix = (letter: string): string => {
    if (!primary) return `Secondary ${letter.toLowerCase()}`;
    return letter;
  };

  console.log('insurance plan policy holder', JSON.stringify(policyHolder));

  if (insurancePlanDto.requiresSubscriberId && !insuranceData.memberId) {
    throw new Error(`${prefix('M')}ember ID was not provided.`);
  }
  if (insurancePlanDto.requiresSubscriberName && (!policyHolder.firstName || !policyHolder.lastName)) {
    throw new Error(`${prefix('P')}olicy holder's first or last name was not provided.`);
  }
  if (insurancePlanDto.requiresSubscriberDOB && !policyHolder.dob) {
    throw new Error(`${prefix('P')}olicy holder's date of birth was not provided.`);
  }
  if (insurancePlanDto.requiresRelationshipToSubscriber && !policyHolder.relationship) {
    throw new Error(`${prefix('P')}olicy holder's relationship to the insured was not provided.`);
  }
};

const mapResponseItemsToInsuranceData = (
  items: QuestionnaireResponseItem[],
  suffix = ''
): GetEligibilityInsuranceData => {
  let insuranceId, memberId: string | undefined;
  const requiredFields = new Set([`insurance-member-id${suffix}`, `insurance-carrier${suffix}`]);
  items.forEach((i) => {
    requiredFields.delete(i.linkId);
    if (i.linkId === `insurance-member-id${suffix}`) {
      memberId = i.answer?.[0]?.valueString;
    }
    if (i.linkId === `insurance-carrier${suffix}`) {
      insuranceId = i.answer?.[0]?.valueReference?.reference?.split('/')?.[1];
    }
  });
  if (insuranceId === undefined || memberId === undefined) {
    const missingVals = Array.from(requiredFields.values()).join(', ');
    throw new Error(
      `Could not perform eligibility check because QuestionnaireResponse page did not include the following items: ${missingVals}`
    );
  }
  return {
    insuranceId,
    memberId,
  };
};

const mapResponseItemsToInsurancePolicyHolder = (
  items: QuestionnaireResponseItem[],
  suffix = ''
): GetEligibilityPolicyHolder => {
  let firstName, lastName, zip, state, address, addressLine2, sex, dob, relationship: string | undefined;
  let isPatient = false;
  items.forEach((i) => {
    if (i.linkId === `patient-relationship-to-insured${suffix}`) {
      isPatient = i.answer?.[0]?.valueString?.toLowerCase() === 'self';
      relationship = i.answer?.[0]?.valueString;
    }
    if (i.linkId === `policy-holder-first-name${suffix}`) {
      firstName = i.answer?.[0]?.valueString;
    }
    if (i.linkId === `policy-holder-last-name${suffix}`) {
      lastName = i.answer?.[0]?.valueString;
    }
    if (i.linkId === `policy-holder-zip${suffix}`) {
      zip = i.answer?.[0]?.valueString;
    }
    if (i.linkId === `policy-holder-state${suffix}`) {
      state = i.answer?.[0]?.valueString;
    }
    if (i.linkId === `policy-holder-address${suffix}`) {
      address = i.answer?.[0]?.valueString;
    }
    if (i.linkId === `policy-holder-address-additional-line${suffix}`) {
      addressLine2 = i.answer?.[0]?.valueString;
    }
    if (i.linkId === `policy-holder-birth-sex${suffix}`) {
      sex = i.answer?.[0]?.valueString;
    }
    if (i.linkId === `policy-holder-dob${suffix}`) {
      dob = i.answer?.[0]?.valueString;
    }
  });

  const policyHolder: GetEligibilityPolicyHolder = {
    firstName,
    lastName,
    zip,
    state,
    address,
    addressLine2,
    sex,
    dob,
    isPatient,
    relationship,
  };
  return policyHolder;
};

export const complexBillingProviderValidation = async (
  prevalidationInput: InsuranceEligibilityPrevalidationInput,
  oystehrClient: Oystehr
): Promise<BillingProviderData> => {
  const { type, reference } = prevalidationInput.billingProviderResource;

  const fetchedResources = await oystehrClient.fhir.search<BillingProvideResource>({
    resourceType: type,
    params: [
      {
        name: '_id',
        value: reference?.split('/')[1] ?? '',
      },
    ],
  });

  const billingResource = fetchedResources?.unbundle()[0];
  if (!billingResource) {
    throw APIErrorCode.BILLING_PROVIDER_NOT_FOUND;
  }
  const providerData = getBillingProviderDataFromResource(billingResource);

  if (providerData === undefined) {
    throw APIErrorCode.MISSING_BILLING_PROVIDER_DETAILS;
  }
  return providerData;
};
