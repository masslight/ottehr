import { SubscriberRelationship } from '../../../fhir/constants';
import { CODE_SYSTEM_CLAIM_TYPE_CODES } from '../../../helpers/rcm/constants';
import type { EraClaimStatusCode, X12AdjustmentGroupCode } from './billing.constants';
import type { BillingInsuranceType } from './billing.schemas';
import { ClaimStatusValues } from './claim-status';
import type { RulesEngineType } from './rules-engine.constants';

export type ClaimCoverageType = 'primary' | 'secondary' | 'tertiary' | 'quaternary';

// Insurance types in display order, with the labels shown across the billing app.
export const BILLING_INSURANCE_TYPE_OPTIONS: { value: BillingInsuranceType; label: string }[] = [
  { value: 'primary', label: 'Primary' },
  { value: 'secondary', label: 'Secondary' },
  { value: 'tertiary', label: 'Tertiary' },
  { value: 'quaternary', label: 'Quaternary' },
  { value: 'workersComp', label: 'Workers Comp' },
];

// Section/card headings.
export const BILLING_INSURANCE_TYPE_TITLES: Record<BillingInsuranceType, string> = {
  primary: 'Primary Insurance',
  secondary: 'Secondary Insurance',
  tertiary: 'Tertiary Insurance',
  quaternary: 'Quaternary Insurance',
  workersComp: 'Workers Comp',
};

// Lowercase labels for inline messages (e.g. "patient already has a primary coverage").
export const BILLING_INSURANCE_TYPE_LABELS: Record<BillingInsuranceType, string> = {
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
  quaternary: 'quaternary',
  workersComp: 'workers comp',
};

export interface BillingTag {
  // Empty for a system-managed tag whose Basic definition hasn't been created yet.
  id: string;
  name: string;
  description: string;
  usage: number;
  updatedAt: string;
  // System-managed tags (see ./system-tags.ts) are always returned by search-billing-tags and
  // cannot be edited or deleted.
  isSystemTag: boolean;
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

// One adjudicated ERA service line (835 SVC loop), joined back to the submitted claim's line via
// ClaimResponse.item.itemSequence -> Claim.item.sequence when possible.
export interface EraRemitServiceLine {
  // null for addItem rows, which carry no itemSequence
  itemSequence: number | null;
  // Claim.item.sequence of the submitted line this row was assigned to, null when we couldn't
  // identify one. Payers that don't echo our line control numbers number their own lines
  // positionally, so this and itemSequence disagree on those remits.
  claimItemSequence: number | null;
  // the addItem bucket the process-era converter uses for claim-level CAS adjustments
  isClaimLevel: boolean;
  // '' when the line couldn't be joined to a claim line (e.g. unmatched claim without contained
  // items, or a manually matched claim whose line sequences don't correspond)
  cptCode: string;
  modifiers: string[];
  units: number | null;
  serviceDate: string;
  // the payer-reported 'charge' adjudication, else the submitted line's net amount
  billed: number | null;
  // 'allowed' (Claim.MD converter) or X12 AMT B6 (process-era converter); null when not reported
  allowed: number | null;
  paid: number;
  // PR-group CAS buckets: CARC 1 / 2 / 3
  deductible: number;
  coinsurance: number;
  copay: number;
  // every CAS adjustment on the line, the PR buckets above included
  adjustments: ClaimRemitAdjustment[];
}

// One ClaimResponse (835 CLP loop) of an ERA in full detail. An ERA can carry several per claim
// (e.g. reversal + correction).
export interface EraClaimRemit {
  claimResponseId: string;
  created: string;
  outcome: string;
  disposition: string;
  // CLP02 claim status code
  eraStatusCode: EraClaimStatusCode | '';
  // CLP07/ICN when the converter stamps ClaimResponse.identifier; '' otherwise
  payerClaimControlNumber: string;
  allowed: number | null;
  paid: number;
  patientResp: number | null;
  // PR-group adjustments aggregated across the whole remit, amounts summed per CARC reason code
  patientRespAdjustments: ClaimRemitAdjustment[];
  serviceLines: EraRemitServiceLine[];
  // ClaimResponse.processNote texts (RARC remarks) when present
  notes: string[];
}

// N1*PE payee (the billing provider paid by the check) when the converter preserves it.
export interface EraPayee {
  name: string;
  npi: string;
  taxId: string;
}

export interface EraClaimListItem {
  claimId: string;
  patientName: string;
  patientDob: string;
  dos: string;
  billed: number;
  allowed: number;
  paid: number;
  posted: number;
  patientResp: number;
  // CLP01 patient control number: the patient account number echoed back from the submitted claim
  patientAccountNumber: string;
  // the focal coverage's subscriber id (the same field the claim detail screen shows); '' when the
  // claim is unmatched or self-pay
  memberId: string;
  status: string;
  matched: boolean;
  claimResponseIds: string[];
  // ordered oldest -> newest
  remits: EraClaimRemit[];
}

export interface EraDetailResponse {
  id: string;
  checkNumber: string;
  checkDate: string;
  // when the ERA itself was produced/imported (PaymentReconciliation.created)
  createdDate: string;
  checkAmount: number;
  payerName: string;
  payerFhirId: string;
  payee: EraPayee | null;
  status: string;
  paymentMethod: string;
  totalClaims: number;
  matchedClaims: number;
  unmatchedClaims: number;
  // the raw 835 as received, from the PaymentReconciliation's rcm-raw-x12 extension
  x12: string;
  claims: EraClaimListItem[];
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
  adjudicated: boolean;
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

export interface ClaimPatientPayment {
  paymentNoticeId: string;
  paymentDate: string;
  amount: number;
  method: string;
  description: string;
  checkNumber?: string;
  status: string;
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

export interface ClaimAttachment {
  sequence: number;
  id: string;
  fileName: string;
  reportTypeCode?: string;
  dateAdded: string;
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
  planType: string;
  relationship: SubscriberRelationship;
  policyHolder: BillingPolicyHolderSummary | null;
  responsibleParty: string;
  secondaryCoverageFhirId: string;
  secondaryPayerName: string;
  secondaryPayerId: string;
  secondaryMemberId: string;
  tertiaryCoverageFhirId: string;
  tertiaryPayerName: string;
  tertiaryPayerId: string;
  tertiaryMemberId: string;
  quaternaryCoverageFhirId: string;
  quaternaryPayerName: string;
  quaternaryPayerId: string;
  quaternaryMemberId: string;
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
    revenueCode: string;
  }[];
  billed: number;
  allowed: number;
  insurancePaid: number;
  patientResp: number;
  patientPaid: number;
  balance: number;
  adjudicated: boolean;
  remits: ClaimRemit[];
  insurancePayments: ClaimInsurancePayment[];
  patientPayments: ClaimPatientPayment[];
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
  pcn?: string;
  billType: string;
  patientDischargeStatusCode: string;
  admissionType: string;
  admissionSource: string;
  admissionDate: string;
  dischargeDate: string;
  attachments: ClaimAttachment[];
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
  incomplete?: boolean;
}

export interface BillingClaimsExportKickOffResponse {
  taskId: string;
}

export interface BillingClaimsExportStatusResponse {
  status: 'requested' | 'in-progress' | 'completed' | 'failed';
  downloadUrl?: string;
  error?: string;
  incomplete?: boolean;
}

export type BillingClaimsExportResponse = BillingClaimsExportKickOffResponse | BillingClaimsExportStatusResponse;

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

export interface PatientBalanceSummary {
  currentBalance: number;
  claimsWithPatientBalance: number;
}

export interface GetBillingPatientBalanceResponse {
  claims: PatientArClaimItem[];
  balance: PatientBalanceSummary;
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

export interface SearchCodeResponse {
  codes: BillingCodeOption[];
}

export interface SearchBillingTagsResponse {
  tags: BillingTag[];
}

export interface PaymentsReportPayerRow {
  payerId: string;
  payerName: string;
  eraCount: number;
  claimCount: number;
  billed: number;
  allowed: number;
  insurancePaid: number;
  patientResp: number;
  checkTotal: number;
}

export interface PaymentsReportWaterfallCell {
  // 'YYYY-MM'; 'unknown' when the claim or its service date can't be resolved
  serviceMonth: string;
  // 'YYYY-MM' of the ERA check date
  checkMonth: string;
  paid: number;
}

// Refresh state of a cached billing report.
export interface ReportRefreshStatus {
  state: 'idle' | 'running' | 'error';
  // when the served cache was generated
  lastCompletedAt?: string;
  // worker phase text while running
  progress?: string;
  // most recent failure's reason
  error?: string;
  // stored (gzip) size of the served cache object
  cacheSizeBytes?: number;
}

export interface GetBillingPaymentsReportResponse {
  rows: PaymentsReportPayerRow[];
  totals: Omit<PaymentsReportPayerRow, 'payerId' | 'payerName'>;
  // DOS-month × check-month matrix over all ERAs, independent of the report's date window
  waterfall: PaymentsReportWaterfallCell[];
  generatedAt: string;
  fromCache: boolean;
  status?: ReportRefreshStatus;
}

export interface PaymentsReportDrilldownClaim {
  patientName: string;
  pcn: string;
  dos: string;
  billed: number;
  allowed: number;
  paid: number;
  patientResp: number;
}

export interface PaymentsReportDrilldownEra {
  id: string;
  checkNumber: string;
  checkDate: string;
  payerName: string;
  checkAmount: number;
  claims: PaymentsReportDrilldownClaim[];
}

export interface GetBillingPaymentsReportDrilldownResponse {
  eras: PaymentsReportDrilldownEra[];
  // when the drilldown detail snapshot was computed
  generatedAt?: string;
  status?: ReportRefreshStatus;
}

// payments drilldown dataset: every ERA with its claims and filter dimensions
export interface PaymentsReportDetailClaim extends PaymentsReportDrilldownClaim {
  // 'YYYY-MM' or 'unknown'
  serviceMonth: string;
}

export interface PaymentsReportDetailEra extends Omit<PaymentsReportDrilldownEra, 'claims'> {
  // payer reference id ('' when the ERA has no payer reference)
  payerId: string;
  // 'YYYY-MM' or 'unknown'
  checkMonth: string;
  claims: PaymentsReportDetailClaim[];
}

export interface PaymentsReportDetail {
  eras: PaymentsReportDetailEra[];
}

export interface PatientPaymentsReportRow {
  // FHIR Location id resolved via encounter → appointment → participant ('' when unresolved)
  locationId: string;
  locationName: string;
  paymentMethod: string;
  paymentCount: number;
  collected: number;
  refunded: number;
  net: number;
}

export interface PatientPaymentItem {
  date: string;
  patientName: string;
  locationName: string;
  paymentMethod: string;
  amount: number;
  // live Stripe-derived status ('Paid', 'Invoice paid', 'Invoice past due', 'Refunded', ...); '' for manual payments
  stripeStatus: string;
  description: string;
  // FHIR Appointment id of the visit the payment belongs to ('' when unresolved)
  appointmentId: string;
  encounterDate: string;
}

export interface GetBillingPatientPaymentsReportResponse {
  rows: PatientPaymentsReportRow[];
  totals: Omit<PatientPaymentsReportRow, 'locationId' | 'locationName' | 'paymentMethod'>;
  generatedAt: string;
  fromCache?: boolean;
  status?: ReportRefreshStatus;
}

// patient-payments drilldown dataset: every payment in the window
export interface PatientPaymentsDetailItem extends PatientPaymentItem {
  // '' when unresolved; the drilldown 'none' filter selects these
  locationId: string;
}

export interface PatientPaymentsReportDetail {
  payments: PatientPaymentsDetailItem[];
}

export interface GetBillingPatientPaymentsDrilldownResponse {
  payments: PatientPaymentItem[];
  // when the drilldown detail snapshot was computed
  generatedAt?: string;
  status?: ReportRefreshStatus;
}

export interface CardOnFileReportRow {
  stripeCustomerId: string;
  customerName: string;
  // connected account the customer lives on ('' = platform account)
  stripeAccountId: string;
  livemode: boolean;
  patientId: string;
  patientName: string;
  // Stripe payment method id ('' = no card on file)
  cardId: string;
  cardBrand: string;
  cardLast4: string;
  lastVisitDate: string;
  lastVisitAppointmentId: string;
  // open (unpaid) Stripe invoices for this customer
  openInvoiceCount: number;
  openInvoiceAmount: number;
  hasPastDueInvoice: boolean;
}

export interface GetBillingCardsOnFileReportResponse {
  rows: CardOnFileReportRow[];
  totals: { customers: number; withCard: number; withoutCard: number; withOpenInvoices: number };
  // customers whose fallback card lookup hasn't run yet; the refresh worker drains these
  pendingCardLookups: number;
  generatedAt: string;
  fromCache: boolean;
  status?: ReportRefreshStatus;
}

export type InvoiceReportCategory = 'upcoming' | 'past-due-no-card' | 'past-due-not-attempted' | 'past-due-failed';

export interface InvoiceReportRow {
  stripeInvoiceId: string;
  invoiceNumber: string;
  // connected account the invoice lives on ('' = platform account)
  stripeAccountId: string;
  livemode: boolean;
  stripeCustomerId: string;
  customerName: string;
  patientId: string;
  patientName: string;
  // outstanding balance (Stripe amount_remaining)
  amountDue: number;
  createdDate: string;
  // '' when the invoice has no due date
  dueDate: string;
  // start of aging ('' = not yet aging): due date, else finalization once a charge was attempted
  agingAnchorDate: string;
  // visit the invoice was issued for, resolved from invoice metadata
  visitDate: string;
  appointmentId: string;
  category: InvoiceReportCategory;
  attemptCount: number;
  lastPaymentError: string;
  hostedInvoiceUrl: string;
  cardBrand: string;
  cardLast4: string;
}

export interface InvoiceAgingTrendPoint {
  snapshotDate: string;
  label: string;
  // keyed by aging bucket: 'not-yet-due', '0-30', '30-60', '60-90', '90-120', '120-150', '150+'
  buckets: Record<string, { count: number; amountDue: number }>;
}

export interface GetBillingInvoiceReportResponse {
  rows: InvoiceReportRow[];
  totals: Record<InvoiceReportCategory, { count: number; amountDue: number }>;
  // month-end snapshots reconstructed from all Stripe invoices via status_transitions
  agingTrend: InvoiceAgingTrendPoint[];
  generatedAt: string;
  fromCache: boolean;
  status?: ReportRefreshStatus;
}

// One cell of the pipeline overview: claims sharing an AR stage and active-group status.
export interface PipelineReportRow {
  // AR stage tag code ('' = no stage set)
  arStage: string;
  // active status-group primary field value for that stage ('' = no status set)
  status: string;
  claimCount: number;
  totalBilled: number;
}

// Insurance Payer AR attention buckets: adjudication problems and claims with no recent activity.
export interface PipelineInsuranceBreakout {
  denied: { claimCount: number; totalBilled: number };
  rejected: { claimCount: number; totalBilled: number };
  stale: { claimCount: number; totalBilled: number };
  // claims with no update in this many days count as stale
  staleDays: number;
  // _lastUpdated cutoff used for the stale bucket, for drilldown filtering
  staleBefore: string;
}

export interface GetBillingPipelineReportResponse {
  rows: PipelineReportRow[];
  totals: { claims: number; totalBilled: number };
  insuranceBreakout: PipelineInsuranceBreakout;
  // closest daily snapshot from ~a week ago, for week-over-week deltas (absent until history accrues)
  previous?: { snapshotDate: string; rows: PipelineReportRow[] };
  generatedAt: string;
  fromCache: boolean;
  status?: ReportRefreshStatus;
}

// One actor's claim-action tallies over the report window, from claim-history Provenances.
export interface ProductivityReportRow {
  // Practitioner/... (human) or Device/... (system) reference
  actorRef: string;
  actorName: string;
  actorType: 'human' | 'system';
  // counts keyed by CLAIM_PROVENANCE_ACTIVITY_CODES values (CREATE, UPDATE, ...)
  actionsByActivity: Record<string, number>;
  totalActions: number;
  // distinct claims acted on
  claimsTouched: number;
  lastActionAt: string;
}

export interface GetBillingProductivityReportResponse {
  rows: ProductivityReportRow[];
  totals: { actions: number; claimsTouched: number; actors: number };
  generatedAt: string;
  fromCache?: boolean;
  status?: ReportRefreshStatus;
}

export type GetBillingCoverageResponse = BillingCoverageOption;

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

export interface OkResponse {
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

export interface AddClaimAttachmentResponse {
  uploadUrl: string;
}

export interface DownloadClaimAttachmentResponse {
  downloadUrl: string;
}
