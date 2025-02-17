import { Address, Location, Organization, Practitioner, QuestionnaireResponseItem, Reference } from 'fhir/r4b';
import { InsuranceEligibilityCheckStatus } from '../paperwork';

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
  // addressSameAsPatient: boolean;
  address?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  relationship?: string;
}

export type BillingProviderResource = Location | Practitioner | Organization;

export interface BillingProviderData {
  resourceType: BillingProviderResource['resourceType'];
  id: string;
  npi: string;
  taxId: string;
  address: Address;
}
export interface BillingProviderResourceReference extends Omit<Reference, 'type'> {
  type: BillingProviderResource['resourceType'];
}
export interface InsuranceEligibilityPrevalidationInput {
  responseItems: QuestionnaireResponseItem[];
}
export interface GetEligibilityParameters {
  patientId: string;
  appointmentId: string;
  primaryInsuranceData?: GetEligibilityInsuranceData;
  primaryPolicyHolder?: GetEligibilityPolicyHolder;
  secondaryInsuranceData?: GetEligibilityInsuranceData;
  secondaryPolicyHolder?: GetEligibilityPolicyHolder;
  coveragePrevalidationInput?: InsuranceEligibilityPrevalidationInput;
}

export interface GetEligibilityInput
  extends Omit<GetEligibilityParameters, 'primaryInsuranceData' | 'primaryPolicyHolder' | 'responseItems'> {
  primaryInsuranceData: GetEligibilityInsuranceData;
  primaryPolicyHolder: GetEligibilityPolicyHolder;
}

export type GetEligibilityResponse = {
  primary: InsuranceEligibilityCheckStatus;
  secondary?: InsuranceEligibilityCheckStatus;
};
