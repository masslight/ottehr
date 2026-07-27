import { SubscriberRelationship } from '../../../fhir/constants';
import { CODE_SYSTEM_CLAIM_TYPE_CODES } from '../../../helpers';
import type { EraClaimStatusCode, X12AdjustmentGroupCode } from './billing.constants';
import type { BillingInsuranceType } from './billing.schemas';
import { ClaimStatusValues } from './claim-status';
import type { RulesEngineType } from './rules-engine.constants';

// Insurance types in display order, with the labels shown across the billing app.
export const BILLING_INSURANCE_TYPE_OPTIONS: { value: BillingInsuranceType; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'workersComp', label: 'Workers Comp' },
];

// Section/card headings.
export const BILLING_INSURANCE_TYPE_TITLES: Record<BillingInsuranceType, string> = {
  primary: 'Primary Insurance',
  secondary: 'Secondary Insurance',
  workersComp: 'Workers Comp',
};

// Lowercase labels for inline messages (e.g. "patient already has a primary coverage").
export const BILLING_INSURANCE_TYPE_LABELS: Record<BillingInsuranceType, string> = {
  primary: 'primary',
  secondary: 'secondary',
  workersComp: 'workers comp',
};

export interface BillingTag {
  id: string;
  name: string;
  description: string;
  usage: number;
  updatedAt: string;
}

// Search/autocomplete option shapes — shared by the search-billing-* zambdas and the billing UI.
export interface BillingPatientOption {
  id: string | undefined;
  name: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  address: string;
  clinicalId: string;
  clinicalFriendlyId: string;
}

export interface BillingPolicyHolderSummary {
  firstName: string;
  middleName: string;
  lastName: string;
  dob: string;
  gender: string;
  addressParts: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
}

export interface BillingCoverageOption {
  id: string | undefined;
  status: string;
  subscriberId: string;
  payorName: string;
  payorId: string;
  payorFhirId: string;
  insuranceType?: BillingInsuranceType;
  planType?: string;
  relationship?: SubscriberRelationship;
  memberId?: string;
  policyHolder?: BillingPolicyHolderSummary | null;
}

export interface BillingLocationOption {
  id: string | undefined;
  name: string;
  npi: string;
  address: string;
  posCode: string;
}

// Service facility (FHIR Location) managed by the billing app's Service Facilities screens.
export interface ServiceFacilityItem {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  npi: string;
  clia: string;
  posCode: string;
  status: 'active' | 'inactive';
  workingCopyReferenceResourceId?: string;
}

export interface SearchServiceFacilitiesResponse {
  facilities: ServiceFacilityItem[];
  total: number;
  offset: number;
  pageSize: number;
}

// Unified provider option (Practitioner or Organization)
export interface BillingProviderOption {
  id: string;
  kind: 'individual' | 'organization';
  name: string;
  firstName?: string;
  lastName?: string;
  npi: string;
  taxonomyCode?: string;
  licenseType?: string;
  taxId?: string;
  stripeAccountId?: string;
  address?: string;
  addressParts?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
  };
  renders: boolean;
  bills: boolean;
  isWorkingCopy: boolean;
  workingCopyReferenceResourceId?: string;
}

// Payer option from the Oystehr RCM service. id is the RCM payer id (used in payer URLs);
// payerId is the clearinghouse payer id shown to users.
export interface BillingPayerOption {
  id: string;
  name: string;
  payerId: string;
}

// A diagnosis (ICD-10) or procedure (CPT/HCPCS) code option from terminology search.
export interface BillingCodeOption {
  code: string;
  display: string;
}

export interface EraListItem {
  id: string;
  checkNumber: string;
  payerName: string;
  paymentDate: string;
  paymentAmount: number;
  status: string;
  claimCount: number;
  matchedCount: number;
  unmatchedCount: number;
}

export interface EraDetailResponse {
  id: string;
  checkNumber: string;
  checkDate: string;
  checkAmount: number;
  payerName: string;
  payerFhirId: string;
  status: string;
  paymentMethod: string;
  totalClaims: number;
  matchedClaims: number;
  unmatchedClaims: number;
  claims: {
    claimId: string;
    patientName: string;
    dos: string;
    billed: number;
    allowed: number;
    paid: number;
    posted: number;
    status: string;
    matched: boolean;
    claimResponseIds: string[];
  }[];
}

export interface BillingClaimItem {
  id: string;
  type: keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES;
  // Legacy `current-status` value, retained for the patient-detail screen. The billing claims
  // list/detail now surface the `statuses` indicators below instead.
  status: string;
  statuses: ClaimStatusValues;
  // The rules engine the claim's AR stage maps to (undefined when none applies) — the claims list
  // only lets rows with an engine be selected for a bulk run.
  rulesEngine?: RulesEngineType;
  patientName: string;
  patientDob: string;
  payerName: string;
  payerId: string;
  memberId: string;
  service: string | undefined;
  serviceDate: string;
  facility: string;
  renderingProvider: string;
  billed: number;
  allowed: number;
  insurancePaid: number;
  patientResp: number;
  patientPaid: number;
  claimBalance: number;
  responsibleParty: string;
  tags: string[];
}

export interface PatientDetailResponse {
  id: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  phone: string;
  email: string;
  address: string;
  addressParts: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
  clinicalId: string;
  clinicalFriendlyId: string;
  workingCopyReferenceResourceId?: string;
  active: boolean;
  balance: {
    claimsWithPatientBalance: number;
    pendingPayments: number;
    currentBalance: number;
  };
  claims: Pick<
    BillingClaimItem,
    | 'id'
    | 'status'
    | 'serviceDate'
    | 'payerName'
    | 'billed'
    | 'allowed'
    | 'insurancePaid'
    | 'patientResp'
    | 'patientPaid'
  >[];
}

// One X12 CAS adjustment carried on a remit: group code (X12_ADJUSTMENT_GROUP_CODE) + CARC reason
// code (e.g. 1 = deductible, 2 = coinsurance, 3 = copay, 45 = exceeds fee schedule).
export interface ClaimRemitAdjustment {
  groupCode: X12AdjustmentGroupCode;
  reasonCode: string;
  amount: number;
}

// One ERA payment (PaymentReconciliation) behind a claim's remits.
export interface ClaimInsurancePayment {
  paymentReconciliationId: string;
  checkNumber: string;
  paymentDate: string;
  // the whole check's amount, not this claim's share (that's the remit's paid)
  paymentAmount: number;
  payerName: string;
  status: string;
}

// One ERA adjudication (ClaimResponse) posted against a claim.
export interface ClaimRemit {
  claimResponseId: string;
  date: string;
  payerName: string;
  status: string;
  // CLP02 claim status code from the ERA (ERA_CLAIM_STATUS_CODE)
  eraStatusCode: EraClaimStatusCode | '';
  allowed: number | null;
  paid: number;
  patientResp: number | null;
  adjustments: ClaimRemitAdjustment[];
}

export interface ClaimDetailResponse {
  id: string;
  // Clinical Encounter this claim was generated from (from the claim's claim-encounter-id identifier).
  encounterId: string;
  // Clinical Appointment this claim was generated from (the EHR /visit/<id> route key).
  appointmentId: string;
  type: keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES;
  // Legacy `current-status` value (kept for compatibility); `statuses` carries the indicators shown in the UI.
  status: string;
  statuses: ClaimStatusValues;
  created: string;
  billingType: string;
  billableStatus: string;
  service?: string;
  patientName: string;
  patientDob: string;
  patientGender: string;
  patientId: string;
  // Clinical Patient behind the claim's working copy (from its source identifier) — used to list coverages.
  patientOriginalId: string;
  patientAddress: string;
  patientAddressParts: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
  coverageFhirId: string;
  payorFhirId: string;
  payerName: string;
  payerId: string;
  memberId: string;
  subscriberId: string;
  coverageStatus: string;
  planType: string;
  relationship: SubscriberRelationship;
  policyHolder: BillingPolicyHolderSummary | null;
  responsibleParty: string;
  secondaryCoverageFhirId: string;
  secondaryPayerName: string;
  secondaryPayerId: string;
  secondaryMemberId: string;
  nonInsurancePayerFhirId: string;
  nonInsurancePayerName: string;
  renderingProviderId: string;
  renderingProviderType: string;
  renderingProvider: string;
  renderingNpi: string;
  renderingTaxonomy: string;
  billingProviderFhirId: string;
  billingProviderType: string;
  billingProvider: string;
  billingNpi: string;
  billingTin: string;
  billingTaxonomy: string;
  facilityFhirId: string;
  serviceFacility: string;
  serviceFacilityId: string;
  serviceFacilityAddress: string;
  serviceFacilityAddressParts: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
  serviceFacilityNpi: string;
  serviceFacilityClia?: string;
  diagnoses: { sequence: number; code: string; display: string }[];
  serviceLines: {
    sequence: number;
    cptCode: string;
    description: string;
    modifiers: string[];
    units: number;
    charges: number;
    serviceDate: string;
    placeOfService: string;
    diagnosisPointers: number[];
  }[];
  billed: number;
  allowed: number;
  insurancePaid: number;
  patientResp: number;
  patientPaid: number;
  balance: number;
  remits: ClaimRemit[];
  insurancePayments: ClaimInsurancePayment[];
  otherClaims: {
    id: string;
    status: string;
    arStage: string;
    serviceDate: string;
    payerName: string;
    billed: number;
    cptCodes: string[];
  }[];
  tags: string[];
  pcn: string;
}

interface Paginated {
  total: number;
  offset: number;
  pageSize: number;
}

export interface SearchBillingPatientsResponse extends Paginated {
  patients: BillingPatientOption[];
}

export interface SearchBillingClaimsResponse extends Paginated {
  claims: BillingClaimItem[];
}

// amounts in dollars
export interface PatientArClaimItem {
  claimId: string;
  patientId: string;
  patientName: string;
  patientDob: string;
  encounterId: string | null;
  appointmentId: string | null;
  serviceDate: string;
  finalizationDate: string;
  billed: number;
  allowed: number;
  insurancePaid: number;
  patientResp: number;
  patientPaid: number;
  balance: number;
  adjudicated: boolean;
}

export interface SearchBillingPatientARClaimsResponse extends Paginated {
  claims: PatientArClaimItem[];
}

export interface SearchBillingProvidersResponse extends Paginated {
  providers: BillingProviderOption[];
}

export interface SearchBillingErasResponse extends Paginated {
  eras: EraListItem[];
}

export interface SearchBillingLocationsResponse {
  locations: BillingLocationOption[];
}

export interface SearchBillingServicesResponse {
  services: BillingService[];
}

export interface SearchBillingPayersResponse {
  payers: BillingPayerOption[];
}

export interface SearchBillingProcedureCodesResponse {
  codes: BillingCodeOption[];
}

export interface SearchBillingTagsResponse {
  tags: BillingTag[];
}

export interface GetPatientCoveragesResponse {
  coverages: BillingCoverageOption[];
}

export interface CreatedResourceResponse {
  id: string;
}

export interface SavedResourceResponse {
  id: string | undefined;
}

export interface DeletedResponse {
  deleted: true;
}

export interface TaggedClaimResponse {
  ok: true;
}

export interface ExportClaimX12Response {
  x12: string;
}

export interface CreatedClaimResponse {
  claimId: string;
}

export type ChargeItemDefinitionType = 'charge-master' | 'fee-schedule';

export type ChargeItemDefinitionDefault = 'insurance' | 'self-pay';

export interface SearchChargeItemDefinitionItem {
  id: string;
  type: ChargeItemDefinitionType;
  name: string;
  status: 'active' | 'retired';
  description?: string;
  default?: ChargeItemDefinitionDefault;
  effectiveDate?: string;
}

export interface SearchChargeItemDefinitionsResponse {
  items: SearchChargeItemDefinitionItem[];
  total: number;
  offset: number;
  pageSize: number;
}

export interface BillingChargeItemDefinitionProcedureCode {
  code: string;
  description?: string;
  modifier?: string;
  amount: number;
}

export interface BillingChargeItemDefinition {
  id: string;
  type: ChargeItemDefinitionType;
  name: string;
  status: 'active' | 'retired';
  description?: string;
  default?: ChargeItemDefinitionDefault;
  effectiveDate?: string;
  procedureCodes: BillingChargeItemDefinitionProcedureCode[];
}

export interface BillingService {
  name: string;
}

export interface RecordBillingManualPaymentResponse {
  paymentNoticeId: string;
  // present when the notice is linked to an existing billing Claim
  claimId?: string;
}
