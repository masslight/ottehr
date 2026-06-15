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

export interface BillingOrganizationOption {
  id: string | undefined;
  name: string;
  npi: string;
  tin: string;
  payerId: string;
  isPayer: boolean | undefined;
}

export interface BillingCoverageOption {
  id: string | undefined;
  status: string;
  subscriberId: string;
  payorName: string;
  payorId: string;
  payorFhirId: string;
}

export interface BillingPractitionerOption {
  id: string | undefined;
  name: string;
  firstName: string;
  lastName: string;
  npi: string;
  taxonomy: string;
}

export interface BillingLocationOption {
  id: string | undefined;
  name: string;
  npi: string;
  address: string;
}

export interface ServiceFacilityItem {
  id: string;
  name: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
  zipPlus4: string;
  npi: string;
  clia: string;
  posCode: string;
  status: 'active' | 'inactive';
}

export interface SearchServiceFacilitiesResponse {
  facilities: ServiceFacilityItem[];
  total: number;
  offset: number;
  pageSize: number;
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
  status: string;
  patientName: string;
  patientDob: string;
  payerName: string;
  payerId: string;
  memberId: string;
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
  status: string;
  created: string;
  billingType: string;
  billableStatus: string;
  patientName: string;
  patientDob: string;
  patientGender: string;
  patientId: string;
  patientAddress: string;
  coverageFhirId: string;
  payorFhirId: string;
  payerName: string;
  payerId: string;
  memberId: string;
  subscriberId: string;
  coverageStatus: string;
  responsibleParty: string;
  secondaryCoverageFhirId: string;
  secondaryPayerName: string;
  secondaryPayerId: string;
  secondaryMemberId: string;
  nonInsurancePayerFhirId: string;
  nonInsurancePayerName: string;
  renderingProviderId: string;
  renderingProvider: string;
  renderingNpi: string;
  billingProviderFhirId: string;
  billingProvider: string;
  billingNpi: string;
  billingTin: string;
  facilityFhirId: string;
  serviceFacility: string;
  serviceFacilityAddress: string;
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
    serviceDate: string;
    payerName: string;
    billed: number;
    cptCodes: string[];
  }[];
  tags: string[];
}
