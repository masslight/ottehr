export interface GetEligibilityInsuranceData {
  insuranceId: string;
  memberId: string;
  additionalInfo?: string;
}

export interface GetEligibilityPolicyHolder {
  isPatient: boolean;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  dob?: string;
  sex?: string;
  addressSameAsPatient: boolean;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  relationship?: string;
}

export interface GetEligibilityParameters {
  appointmentId: string;
  primaryInsuranceData: GetEligibilityInsuranceData;
  patientId: string;
  primaryPolicyHolder: GetEligibilityPolicyHolder;
  secondaryInsuranceData?: GetEligibilityInsuranceData;
  secondaryPolicyHolder?: GetEligibilityPolicyHolder;
}

export type GetEligibilityResponse = {
  eligible: boolean;
};
