import Oystehr from '@oystehr/sdk';
import { Appointment, QuestionnaireResponseItem } from 'fhir/r4b';
import {
  APIErrorCode,
  BillingProviderDataObject,
  BillingProviderResource,
  flattenItems,
  getBillingProviderData,
  GetBillingProviderInput,
  GetEligibilityInsuranceData,
  GetEligibilityPolicyHolder,
  getSecret,
  InsurancePlanDTO,
  INVALID_INPUT_ERROR,
  isValidUUID,
  MISSING_REQUEST_BODY,
  MISSING_REQUIRED_PARAMETERS,
  PatientAccountAndCoverageResources,
  Secrets,
  SecretsKeys,
} from 'utils';
import { getAccountAndCoverageResourcesForPatient } from '../../ehr/shared/harvest';
import { ZambdaInput } from '../../shared';

interface GetEligibilityStandardInput {
  type: 'standard';
  patientId: string;
  coverageToCheck: 'primary' | 'secondary';
  appointmentId?: string;
  billingProvider?: string;
  secrets: Secrets | null;
}

interface GetEligibilityPrevalidationInput {
  type: 'prevalidation';
  patientId: string;
  responseItems: QuestionnaireResponseItem[];
  secrets: Secrets | null;
  appointmentId?: string;
}
type GetEligibilityInput = GetEligibilityStandardInput | GetEligibilityPrevalidationInput;

export function validateRequestParameters(input: ZambdaInput): GetEligibilityInput {
  if (!input.body) {
    throw MISSING_REQUEST_BODY;
  }

  const { appointmentId, patientId, coveragePrevalidationInput, billingProvider, coverageToCheck } = JSON.parse(
    input.body
  );

  if (appointmentId && !isValidUUID(appointmentId)) {
    throw INVALID_INPUT_ERROR('Parameter "appointmentId" must be a valid UUID.');
  }
  if (!patientId || !isValidUUID(patientId)) {
    console.error('Invalid patientId', patientId);
    throw INVALID_INPUT_ERROR('Parameter "patientId" must be included in input body and be a valid UUID.');
  }
  if (billingProvider && typeof billingProvider !== 'string') {
    throw INVALID_INPUT_ERROR('Parameter "billingProvider" must be a string.');
  }

  const [billingProviderType, billingProviderId] = billingProvider?.split('/') ?? [];
  if (billingProvider && (!billingProviderType || !billingProviderId)) {
    throw INVALID_INPUT_ERROR('Parameter "billingProvider" must be a valid FHIR reference.');
  }
  if (billingProvider && !isValidUUID(billingProviderId)) {
    throw INVALID_INPUT_ERROR('Parameter "billingProvider" must be a valid FHIR reference.');
  }
  if (billingProvider && ['Practitioner', 'Location', 'Organization'].includes(billingProviderType) === false) {
    throw INVALID_INPUT_ERROR(
      'Parameter "billingProvider" must be a valid FHIR reference of type Practitioner, Location, or Organization.'
    );
  }

  if (coveragePrevalidationInput !== undefined) {
    const { responseItems } = coveragePrevalidationInput;
    if (responseItems === undefined) {
      throw MISSING_REQUIRED_PARAMETERS(['prevalidationInput.responseItems']);
    }
    if (responseItems !== undefined && (!Array.isArray(responseItems) || typeof responseItems[0] !== 'object')) {
      throw INVALID_INPUT_ERROR(
        'Parameter "prevalidationInput.responseItems" must be an array of objects when included'
      );
    }
    if (responseItems) {
      return {
        type: 'prevalidation',
        appointmentId,
        patientId,
        secrets: input.secrets,
        responseItems: responseItems as QuestionnaireResponseItem[],
      };
    }
  }

  if (coverageToCheck === undefined || (coverageToCheck !== 'primary' && coverageToCheck !== 'secondary')) {
    throw INVALID_INPUT_ERROR('Parameter "coverageToCheck" is required and must be either "primary" or "secondary".');
  }
  return {
    type: 'standard',
    appointmentId,
    coverageToCheck: coverageToCheck as 'primary' | 'secondary',
    patientId,
    billingProvider,
    secrets: input.secrets,
  };
}

export interface EligibilityCheckPrevalidationStructuredInput {
  type: 'prevalidation';
  patientId: string;
  primaryInsuranceData: GetEligibilityInsuranceData;
  primaryPolicyHolder: GetEligibilityPolicyHolder;
  appointmentId?: string;
  appointment?: Appointment;
  secondaryInsuranceData?: GetEligibilityInsuranceData;
  secondaryPolicyHolder?: GetEligibilityPolicyHolder;
}

export interface EligibilityCheckStandardStructuredInput {
  type: 'standard';
  patientId: string;
  coverageResources: PatientAccountAndCoverageResources;
  billingProvider: string;
  coverageToCheck: 'primary' | 'secondary';
  appointmentId?: string;
  appointment?: Appointment;
}

type EligibilityCheckStructuredInput =
  | EligibilityCheckPrevalidationStructuredInput
  | EligibilityCheckStandardStructuredInput;

export const complexInsuranceValidation = async (
  input: GetEligibilityInput,
  oystehr: Oystehr
): Promise<EligibilityCheckStructuredInput> => {
  const { appointmentId, patientId } = input;
  let appointment: Appointment | undefined;

  if (appointmentId) {
    const appointmentResource = await oystehr.fhir.get<Appointment>({
      resourceType: 'Appointment',
      id: appointmentId,
    });
    if (appointmentResource) {
      appointment = appointmentResource;
    } else {
      throw APIErrorCode.APPOINTMENT_NOT_FOUND;
    }
  }
  if (input.type === 'prevalidation') {
    const { responseItems } = input;
    const primaryPolicyHolder = mapResponseItemsToInsurancePolicyHolder(responseItems);
    const primaryInsuranceData = mapResponseItemsToInsuranceData(responseItems);
    const secondaryInsuranceItem = responseItems.find((item) => item.linkId === 'secondary-insurance');
    let secondaryPolicyHolder: GetEligibilityPolicyHolder | undefined;
    let secondaryInsuranceData: GetEligibilityInsuranceData | undefined;
    if (secondaryInsuranceItem !== undefined) {
      try {
        secondaryPolicyHolder = mapResponseItemsToInsurancePolicyHolder(secondaryInsuranceItem?.item ?? [], '-2');
        secondaryInsuranceData = mapResponseItemsToInsuranceData(secondaryInsuranceItem.item ?? [], '-2');
      } catch (e) {
        console.error('Error parsing secondary insurance data', e);
        secondaryPolicyHolder = undefined;
        secondaryInsuranceData = undefined;
      }
    }
    console.log('primaryPolicyHolder', JSON.stringify(primaryPolicyHolder));
    console.log('primaryInsuranceData', JSON.stringify(primaryInsuranceData));
    return {
      type: 'prevalidation',
      appointmentId,
      patientId,
      primaryInsuranceData,
      primaryPolicyHolder,
      secondaryInsuranceData,
      secondaryPolicyHolder,
      appointment,
    };
  } else {
    const { billingProvider: maybeBillingProvider, coverageToCheck } = input;

    const billingProvider = await resolveBillingProviderReference(maybeBillingProvider, oystehr, input.secrets);
    const coverageResources = await getAccountAndCoverageResourcesForPatient(patientId, oystehr);
    return {
      type: 'standard',
      appointmentId,
      patientId,
      billingProvider,
      coverageResources,
      appointment,
      coverageToCheck,
    };
  }
};

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
  flattenItems(items).forEach((i: any) => {
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

type GetBillingProviderInputWithSecrets = GetBillingProviderInput & { secrets: Secrets | null };

export const complexBillingProviderValidation = async (
  plans: GetBillingProviderInput['plans'],
  appointmentId: string,
  secrets: Secrets | null,
  oystehrClient: Oystehr
): Promise<BillingProviderDataObject> => {
  //const { type, reference } = prevalidationInput.billingProviderResource;

  const input: GetBillingProviderInputWithSecrets = {
    plans,
    secrets,
    appointmentId,
  };
  const providerData = await getBillingProviderData(
    input,
    await getDefaultBillingProviderResource(secrets, oystehrClient)
  );

  if (providerData === undefined) {
    throw APIErrorCode.MISSING_BILLING_PROVIDER_DETAILS;
  }
  return providerData;
};

export const getDefaultBillingProviderResource = async (
  secrets: Secrets | null,
  oystehrClient: Oystehr
): Promise<BillingProviderResource> => {
  const defaultBillingResource = getSecret(SecretsKeys.DEFAULT_BILLING_RESOURCE, secrets);
  if (!defaultBillingResource) {
    throw APIErrorCode.BILLING_PROVIDER_NOT_FOUND;
  }

  const defaultBillingResourceType = defaultBillingResource.split('/')[0];
  const defaultBillingResourceId = defaultBillingResource.split('/')[1];

  if (defaultBillingResourceType === undefined || defaultBillingResourceId === undefined) {
    throw APIErrorCode.BILLING_PROVIDER_NOT_FOUND;
  }

  const fetchedResources = await oystehrClient.fhir.search<BillingProviderResource>({
    resourceType: defaultBillingResourceType as BillingProviderResource['resourceType'],
    params: [
      {
        name: '_id',
        value: defaultBillingResourceId,
      },
    ],
  });

  const billingResource = fetchedResources?.unbundle()[0];
  if (!billingResource) {
    throw APIErrorCode.BILLING_PROVIDER_NOT_FOUND;
  }
  return billingResource;
};

const resolveBillingProviderReference = async (
  providedProviderRef: string | undefined,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<string> => {
  if (providedProviderRef === undefined) {
    const defaultProvider = await getDefaultBillingProviderResource(secrets, oystehr);
    return `${defaultProvider.resourceType}/${defaultProvider?.id}`;
  }
  return providedProviderRef;
};
