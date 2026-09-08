import { BillingPayerOption } from './billing.types';
import {
  NioAddress,
  NioContact,
  NioCoverageCategory,
  NioSubmission,
  NioWcBillingMode,
} from './non-insurance-org.schemas';

// --- FHIR systems & extensions (billing workspace) ---

// Organization.type coding marking the role an Organization plays in the billing workspace.
export const NIO_ORGANIZATION_KIND_SYSTEM = 'https://fhir.ottehr.com/billing/organization-kind';
export const NIO_KIND_CODE = 'non-insurance-organization';
export const NIO_COVERAGE_KIND_CODE = 'nio-coverage';
export const NIO_EMPLOYER_KIND_CODE = 'employer';

// Coverage category, carried on both the coverage Organization's type and the
// OrganizationAffiliation.code, so list/directory reads never need the coverage org.
export const NIO_COVERAGE_CATEGORY_SYSTEM = 'https://fhir.ottehr.com/billing/nio-coverage-category';

export const NIO_PREFERRED_SUBMISSION_EXTENSION_URL = 'https://fhir.ottehr.com/billing/preferred-submission-mechanism';
export const NIO_PORTAL_NOTES_EXTENSION_URL = 'https://fhir.ottehr.com/billing/portal-submission-notes';
export const NIO_WC_BILLING_MODE_EXTENSION_URL = 'https://fhir.ottehr.com/billing/wc-billing-mode';
export const NIO_WC_PAYER_EXTENSION_URL = 'https://fhir.ottehr.com/billing/wc-insurance-payer';

export const NIO_COVERAGE_CATEGORY_LABELS: Record<NioCoverageCategory, string> = {
  'workers-comp': 'Workers Comp',
  'occupational-medicine': 'Occupational Medicine',
  other: 'Other',
};

// --- Billing app DTOs ---

export interface NioWorkersCompCoverage {
  category: 'workers-comp';
  billingMode: NioWcBillingMode;
  payer?: BillingPayerOption;
  submission?: NioSubmission;
}

export interface NioStandardCoverage {
  category: Exclude<NioCoverageCategory, 'workers-comp'>;
  // User-entered name; 'other' only.
  name?: string;
  submission?: NioSubmission;
}

export type NioCoverageDetail = NioWorkersCompCoverage | NioStandardCoverage;

export interface NonInsuranceOrganizationItem {
  id: string;
  name: string;
  employer: boolean;
  active: boolean;
  address?: NioAddress;
  contacts: NioContact[];
  covers: NioCoverageDetail[];
}

export interface SearchNonInsuranceOrgsResponse {
  organizations: NonInsuranceOrganizationItem[];
  total: number;
  offset: number;
  pageSize: number;
}

// --- Clinical interface DTOs ---
// The stable contract the clinical app consumes; deliberately minimal (no payer refs, no
// submission details, no contacts) so billing internals can evolve freely.

export interface ClinicalNioOption {
  id: string;
  // NIO reference token (see getNioReferenceUrl) — what clinical code stores in Reference.reference.
  reference: string;
  name: string;
  employer: boolean;
  // A stored reference can point at a since-deleted NIO; lookups by nioId still resolve it, with
  // active=false, so clinical validation and display both work.
  active: boolean;
  address?: NioAddress;
  coversCategories: NioCoverageCategory[];
}

export interface ListNonInsuranceOrganizationsResponse {
  organizations: ClinicalNioOption[];
}
