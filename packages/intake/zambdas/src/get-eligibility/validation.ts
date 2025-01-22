import {
  GetEligibilityInput,
  GetEligibilityInsuranceData,
  GetEligibilityPolicyHolder,
  InsurancePlanDTO,
  isValidUUID,
  ZambdaInput,
} from 'utils';

export function validateRequestParameters(input: ZambdaInput): GetEligibilityInput {
  if (!input.body) {
    throw new Error('No request body provided');
  }

  const {
    appointmentId,
    primaryInsuranceData,
    patientId,
    primaryPolicyHolder,
    secondaryInsuranceData,
    secondaryPolicyHolder,
  } = JSON.parse(input.body) as GetEligibilityInput;

  if (!appointmentId || !isValidUUID(appointmentId)) {
    throw new Error('Parameter "appointmentId" must be included in input body and be a valid UUID.');
  }
  if (!patientId || !isValidUUID(patientId)) {
    throw new Error('Parameter "patientId" must be included in input body and be a valid UUID.');
  }
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
