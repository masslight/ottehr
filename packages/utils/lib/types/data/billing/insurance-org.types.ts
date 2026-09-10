import {
  InsuranceOrgAddress,
  InsuranceOrgClaimForm,
  InsuranceOrgSubmissionMechanism,
  InsuranceOrgType,
} from './insurance-org.schemas';
import { NioContact } from './non-insurance-org.schemas';

// --- FHIR systems & extensions (billing workspace) ---
// Organization.type carries the shared "kind" coding from non-insurance-org.types.ts
// (NIO_ORGANIZATION_KIND_SYSTEM) with this code, plus one coding per selected insurance type below.
export const INSURANCE_ORG_KIND_CODE = 'insurance-organization';

// Organization.identifier.system for the user-entered "OTR-" business id.
export const INSURANCE_ORG_ID_SYSTEM = 'https://fhir.ottehr.com/billing/insurance-organization-id';

// Organization.type coding system for the zero-or-more insurance-type checkboxes.
export const INSURANCE_ORG_TYPE_SYSTEM = 'https://fhir.ottehr.com/billing/insurance-organization-type';

export const INSURANCE_ORG_SUBMISSION_MECHANISM_EXTENSION_URL =
  'https://fhir.ottehr.com/billing/insurance-org-submission-mechanism';
export const INSURANCE_ORG_ACCEPTED_CLAIM_FORM_EXTENSION_URL =
  'https://fhir.ottehr.com/billing/insurance-org-accepted-claim-form';
export const INSURANCE_ORG_NOTE_EXTENSION_URL = 'https://fhir.ottehr.com/billing/insurance-org-note';
// Portal submission details free text; email/fax/portal URL live on Organization.telecom and the
// mail address on Organization.address, so this is the only submission-detail field needing an
// extension of its own.
export const INSURANCE_ORG_PORTAL_DETAILS_EXTENSION_URL =
  'https://fhir.ottehr.com/billing/insurance-org-portal-details';

export const INSURANCE_ORG_TYPE_LABELS: Record<InsuranceOrgType, string> = {
  'workers-comp': 'Workers Comp',
  auto: 'Auto',
  medical: 'Medical',
  other: 'Other',
};

export const INSURANCE_ORG_SUBMISSION_MECHANISM_LABELS: Record<InsuranceOrgSubmissionMechanism, string> = {
  email: 'Email',
  portal: 'Portal',
  fax: 'Fax',
  mail: 'Mail',
};

export const INSURANCE_ORG_CLAIM_FORM_LABELS: Record<InsuranceOrgClaimForm, string> = {
  'cms-1500': 'CMS-1500',
  'cms-1450': 'CMS-1450',
  other: 'Other',
};

// --- Billing app DTO ---

export interface InsuranceOrgSubmissionDetails {
  email?: string;
  portalUrl?: string;
  portalDetails?: string;
  faxNumber?: string;
  mailAddress?: InsuranceOrgAddress;
}

export interface InsuranceOrganizationItem {
  id: string;
  // The user-entered "OTR-" business id.
  orgId: string;
  name: string;
  active: boolean;
  insuranceTypes: InsuranceOrgType[];
  submissionMechanism: InsuranceOrgSubmissionMechanism;
  // Only the field(s) relevant to submissionMechanism are ever populated.
  submissionDetails?: InsuranceOrgSubmissionDetails;
  acceptedClaimForm: InsuranceOrgClaimForm;
  note?: string;
  contacts: NioContact[];
}

export interface SearchInsuranceOrgsResponse {
  organizations: InsuranceOrganizationItem[];
  total: number;
  offset: number;
  pageSize: number;
}
