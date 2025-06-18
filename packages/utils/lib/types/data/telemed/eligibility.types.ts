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
  primaryInsuranceData?: GetEligibilityInsuranceData;
  primaryPolicyHolder?: GetEligibilityPolicyHolder;
  secondaryInsuranceData?: GetEligibilityInsuranceData;
  secondaryPolicyHolder?: GetEligibilityPolicyHolder;
}
export interface GetEligibilityParameters {
  patientId: string;
  appointmentId?: string;
  coveragePrevalidationInput?: InsuranceEligibilityPrevalidationInput;
  billingProvider?: string;
}

export interface CoverageBenefitInfo {
  amountInUSD: number;
  description: string;
  code: string;

  coverageDescription: string;
  coverageCode: string;

  periodDescription: string;
  periodCode: string;

  levelDescription: string;
  levelCode: string;

  inplanNetwork: boolean;
}
export interface CopayBenefit extends CoverageBenefitInfo {
  coverageCode: 'B';
}
export interface InsuranceCheckStatusWithDate {
  status: InsuranceEligibilityCheckStatus;
  dateISO: string;
  copay?: CopayBenefit[];
}

export type GetEligibilityResponse = {
  primary?: InsuranceCheckStatusWithDate;
  secondary?: InsuranceCheckStatusWithDate;
};

export type EligibilityCheckSimpleStatus = 'ELIGIBLE' | 'NOT ELIGIBLE' | 'UNKNOWN';

export const mapEligibilityCheckResultToSimpleStatus = (
  result: InsuranceCheckStatusWithDate
): { status: EligibilityCheckSimpleStatus; dateISO: string; copay?: CopayBenefit[] } => {
  switch (result.status) {
    case InsuranceEligibilityCheckStatus.eligibilityConfirmed:
      return { status: 'ELIGIBLE', dateISO: result.dateISO, copay: result.copay };
    case InsuranceEligibilityCheckStatus.eligibilityNotConfirmed:
      return { status: 'NOT ELIGIBLE', dateISO: result.dateISO };
    default:
      return { status: 'UNKNOWN', dateISO: result.dateISO };
  }
};
