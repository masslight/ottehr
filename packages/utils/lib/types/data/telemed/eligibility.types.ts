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

/*
1 Active Coverage
2 Active - Full Risk Capitation
3 Active - Services Capitated
4 Active - Services Capitated to Primary Care Physician
5 Active - Pending Investigation
6 Inactive
7 Inactive - Pending Eligibility Update
8 Inactive - Pending Investigation

A Co-Insurance
B Co-Payment
C Deductible
CB Coverage Basis
D Benefit Description
E Exclusions
F Limitations
G Out of Pocket (Stop Loss)
H Unlimited
I Non-Covered
J Cost Containment
K Reserve
L Primary Care Provider
M Pre-Existing Condition
MC Managed Care Coordinator
N Services Restricted to Following Provider
O Not Deemed a Medical Necessity
P Benefit Disclaimer
Q Second Surgical Opinion Required
R Other or Additional Payor
S Prior Year(s) History
T Card(s) Reported Lost/Stolen
U Contact Following Entity for Eligibility or Benefit Information
V Cannot Process
W Other Source of Data
X Health Care Facility
Y Spend Down
*/

// it would be nice if the Oystehr service exposed this type via the SDK
type BenefitCoverageCodes =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | 'A'
  | 'B'
  | 'C'
  | 'CB'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'K'
  | 'L'
  | 'M'
  | 'MC'
  | 'N'
  | 'O'
  | 'P'
  | 'Q'
  | 'R'
  | 'S'
  | 'T'
  | 'U'
  | 'V'
  | 'W'
  | 'X'
  | 'Y';

export const CoverageCodeToDescriptionMap: Record<BenefitCoverageCodes, string> = {
  '1': 'Active Coverage',
  '2': 'Active - Full Risk Capitation',
  '3': 'Active - Services Capitated',
  '4': 'Active - Services Capitated to Primary Care Physician',
  '5': 'Active - Pending Investigation',
  '6': 'Inactive',
  '7': 'Inactive - Pending Eligibility Update',
  '8': 'Inactive - Pending Investigation',
  A: 'Co-Insurance',
  B: 'Co-Payment',
  C: 'Deductible',
  CB: 'Coverage Basis',
  D: 'Benefit Description',
  E: 'Exclusions',
  F: 'Limitations',
  G: 'Out of Pocket (Stop Loss)',
  H: 'Unlimited',
  I: 'Non-Covered',
  J: 'Cost Containment',
  K: 'Reserve',
  L: 'Primary Care Provider',
  M: 'Pre-Existing Condition',
  MC: 'Managed Care Coordinator',
  N: 'Services Restricted to Following Provider',
  O: 'Not Deemed a Medical Necessity',
  P: 'Benefit Disclaimer',
  Q: 'Second Surgical Opinion Required',
  R: 'Other or Additional Payor',
  S: 'Prior Year(s) History',
  T: 'Card(s) Reported Lost/Stolen',
  U: 'Contact Following Entity for Eligibility or Benefit Information',
  V: 'Cannot Process',
  W: 'Other Source of Data',
  X: 'Health Care Facility',
  Y: 'Spend Down',
};
export interface CoverageBenefitInfo {
  amountInUSD: number;
  description: string;
  code: string;
  percentage: number;

  coverageDescription: string;
  coverageCode: string;

  periodDescription: string;
  periodCode: string;

  levelDescription: string;
  levelCode: string;

  inNetwork: boolean;
}
export interface CopayBenefit extends CoverageBenefitInfo {
  coverageCode: 'B';
}
export interface CoinsuranceBenefit extends CoverageBenefitInfo {
  coverageCode: 'A';
}
export type PatientPaymentBenefit = CopayBenefit | CoinsuranceBenefit;
export interface InsuranceCheckStatusWithDate {
  status: InsuranceEligibilityCheckStatus;
  dateISO: string;
  copay?: PatientPaymentBenefit[];
}

export type GetEligibilityResponse = {
  primary?: InsuranceCheckStatusWithDate;
  secondary?: InsuranceCheckStatusWithDate;
};

export type EligibilityCheckSimpleStatus = 'ELIGIBLE' | 'NOT ELIGIBLE' | 'UNKNOWN';

export const mapEligibilityCheckResultToSimpleStatus = (
  result: InsuranceCheckStatusWithDate
): { status: EligibilityCheckSimpleStatus; dateISO: string; copay?: PatientPaymentBenefit[] } => {
  switch (result.status) {
    case InsuranceEligibilityCheckStatus.eligibilityConfirmed:
      return { status: 'ELIGIBLE', dateISO: result.dateISO, copay: result.copay };
    case InsuranceEligibilityCheckStatus.eligibilityNotConfirmed:
      return { status: 'NOT ELIGIBLE', dateISO: result.dateISO };
    default:
      return { status: 'UNKNOWN', dateISO: result.dateISO };
  }
};
