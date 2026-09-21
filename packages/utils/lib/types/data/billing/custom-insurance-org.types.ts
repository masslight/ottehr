import {
  CustomInsuranceOrgAddress,
  CustomInsuranceOrgClaimForm,
  CustomInsuranceOrgSubmissionMechanism,
  CustomInsuranceOrgType,
} from './custom-insurance-org.schemas';
import { NioContact } from './non-insurance-org.schemas';

// --- FHIR systems & extensions (billing workspace) ---
// Organization.type carries the shared "kind" coding from non-insurance-org.types.ts
// (NIO_ORGANIZATION_KIND_SYSTEM) with this code, plus one coding per selected insurance type below.
export const CUSTOM_INSURANCE_ORG_KIND_CODE = 'insurance-organization';

// Organization.identifier.system for the user-entered "OTR-" business id.
export const CUSTOM_INSURANCE_ORG_ID_SYSTEM = 'https://fhir.ottehr.com/billing/insurance-organization-id';

// Every business id starts with this — a payer search matching it is an id lookup, not a name search
// (see search-billing-custom-insurance-orgs).
export const CUSTOM_INSURANCE_ORG_ID_PREFIX = 'OTR-';

// Organization.type coding system for the zero-or-more insurance-type checkboxes.
export const CUSTOM_INSURANCE_ORG_TYPE_SYSTEM = 'https://fhir.ottehr.com/billing/insurance-organization-type';

export const CUSTOM_INSURANCE_ORG_SUBMISSION_MECHANISM_EXTENSION_URL =
  'https://fhir.ottehr.com/billing/insurance-org-submission-mechanism';
export const CUSTOM_INSURANCE_ORG_ACCEPTED_CLAIM_FORM_EXTENSION_URL =
  'https://fhir.ottehr.com/billing/insurance-org-accepted-claim-form';
export const CUSTOM_INSURANCE_ORG_NOTE_EXTENSION_URL = 'https://fhir.ottehr.com/billing/insurance-org-note';
// Portal submission details free text; email/fax/portal URL live on Organization.telecom and the
// mail address on Organization.address, so this is the only submission-detail field needing an
// extension of its own.
export const CUSTOM_INSURANCE_ORG_PORTAL_DETAILS_EXTENSION_URL =
  'https://fhir.ottehr.com/billing/insurance-org-portal-details';

export const CUSTOM_INSURANCE_ORG_TYPE_LABELS: Record<CustomInsuranceOrgType, string> = {
  'workers-comp': 'Workers Comp',
  auto: 'Auto',
  medical: 'Medical',
  other: 'Other',
};

export const CUSTOM_INSURANCE_ORG_SUBMISSION_MECHANISM_LABELS: Record<CustomInsuranceOrgSubmissionMechanism, string> = {
  email: 'Email',
  portal: 'Portal',
  fax: 'Fax',
  mail: 'Mail',
};

export const CUSTOM_INSURANCE_ORG_CLAIM_FORM_LABELS: Record<CustomInsuranceOrgClaimForm, string> = {
  'cms-1500': 'CMS-1500',
  'cms-1450': 'CMS-1450',
  other: 'Other',
};

// --- Billing app DTO ---

export interface CustomInsuranceOrgSubmissionDetails {
  email?: string;
  portalUrl?: string;
  portalDetails?: string;
  faxNumber?: string;
  mailAddress?: CustomInsuranceOrgAddress;
}

export interface CustomInsuranceOrgItem {
  id: string;
  // The user-entered "OTR-" business id.
  orgId: string;
  name: string;
  active: boolean;
  insuranceTypes: CustomInsuranceOrgType[];
  submissionMechanism: CustomInsuranceOrgSubmissionMechanism;
  // Only the field(s) relevant to submissionMechanism are ever populated.
  submissionDetails?: CustomInsuranceOrgSubmissionDetails;
  acceptedClaimForm: CustomInsuranceOrgClaimForm;
  note?: string;
  contacts: NioContact[];
}

export interface SearchCustomInsuranceOrgsResponse {
  organizations: CustomInsuranceOrgItem[];
  total: number;
  offset: number;
  pageSize: number;
}

// --- Clinical interface DTOs ---
// The stable contract the clinical app consumes; deliberately minimal (no submission mechanism, no
// contacts) so billing internals can evolve freely. Mirrors ClinicalNioOption in
// non-insurance-org.types.ts.

export interface ClinicalCustomInsuranceOrgOption {
  id: string;
  // A reference token (see getCustomInsuranceOrgReferenceUrl) — what clinical code stores in
  // Reference.reference, never a direct "Organization/{id}" FHIR reference. Clinical code holds
  // only this token plus name/orgId and resolves the org through the billing zambda interface, the
  // same way an NIO reference works (see ClinicalNioOption).
  reference: string;
  orgId: string;
  name: string;
  // A stored reference can point at a since-deleted org; lookups by id still resolve it, with
  // active=false, so clinical validation and display both work.
  active: boolean;
}

export interface ListCustomInsuranceOrganizationsResponse {
  organizations: ClinicalCustomInsuranceOrgOption[];
}
