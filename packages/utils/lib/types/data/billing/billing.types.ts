import { CODE_SYSTEM_APPOINTMENT_TYPE_CODES, CODE_SYSTEM_CLAIM_TYPE_CODES } from '../../../helpers';
import { ClaimStatusValues } from './claim-status';

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
  friendlyId: string;
}

export interface BillingCoverageOption {
  id: string | undefined;
  status: string;
  subscriberId: string;
  payorName: string;
  payorId: string;
  payorFhirId: string;
}

export interface BillingLocationOption {
  id: string | undefined;
  name: string;
  npi: string;
  address: string;
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
  address?: string;
  addressParts?: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
  renders: boolean;
  bills: boolean;
  isWorkingCopy: boolean;
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
  eraId: string;
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
  eraId: string;
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
  }[];
}

export interface BillingClaimItem {
  id: string;
  type: keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES;
  // Legacy `current-status` value, retained for the patient-detail screen. The billing claims
  // list/detail now surface the `statuses` indicators below instead.
  status: string;
  statuses: ClaimStatusValues;
  patientName: string;
  patientDob: string;
  payerName: string;
  payerId: string;
  memberId: string;
  appointmentType: keyof typeof CODE_SYSTEM_APPOINTMENT_TYPE_CODES | undefined;
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
  friendlyId: string;
  active: boolean;
  // TODO: wire real balance from ClaimResponse/PaymentReconciliation
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

export interface ClaimDetailResponse {
  id: string;
  type: keyof typeof CODE_SYSTEM_CLAIM_TYPE_CODES;
  // Legacy `current-status` value (kept for compatibility); `statuses` carries the indicators shown in the UI.
  status: string;
  statuses: ClaimStatusValues;
  created: string;
  billingType: string;
  billableStatus: string;
  appointmentType?: string;
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
  groupNumber: string;
  planName: string;
  planType: string;
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
  serviceFacilityAddress: string;
  serviceFacilityAddressParts: {
    line1: string;
    line2: string;
    city: string;
    state: string;
    postalCode: string;
  };
  serviceFacilityNpi: string;
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

export interface SearchBillingProvidersResponse extends Paginated {
  providers: BillingProviderOption[];
}

export interface SearchBillingErasResponse extends Paginated {
  eras: EraListItem[];
}

export interface SearchBillingLocationsResponse {
  locations: BillingLocationOption[];
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

export interface CreatedClaimResponse {
  claimId: string;
}
