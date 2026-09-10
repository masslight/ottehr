import { type FeatureFlagsConfig, FeatureFlagsConfigSchema } from 'config-types';

const FEATURE_FLAGS_DATA: FeatureFlagsConfig = {
  labOrdersEnabled: true,
  inHouseLabsEnabled: true,
  radiologyEnabled: true,
  nursingOrdersEnabled: true,
  supervisorApprovalEnabled: true,
  demoVisitsEnabled: true,
  globalTemplatesEnabled: true,
  formsEnabled: true,
  legacyDataEnabled: true,
  mailingPaperStatementsEnabled: true,
  automatedPatientOutreachEnabled: true,
  legacyPatientFollowupsEnabled: false,
  skipSendingVisitNoteToPatientPortalEnabled: false,
  sendgridEnabled: false,
  ottehrBillingInvoicingEnabled: true,
  // ON in core for testing + demoing the full FHIR-managed catalog flow.
  // Per-customer configs under local/secrets/<customer>/... omit this field
  // and land at undefined (falsy → FHIR categories suppressed) — customers
  // opt in explicitly by setting `dynamicServiceCategoriesEnabled: true`.
  dynamicServiceCategoriesEnabled: true,
  // OFF until an environment puts Ottehr billing in its claims path. Flag-on requires
  // BILLING_INTEGRATION 'ottehr' or 'all' — with 'all', Candid runs alongside for claim
  // comparison, but employers come only from the billing app (Candid claims go out without a
  // non-insurance payer). Candid-only routing ('candid', or unset, whose runtime default is
  // Candid) is rejected by terraform generation and by shouldUseCandid. Off, everything runs the
  // legacy Employers mode with Candid sync; unit/component tests pin the flag themselves, so
  // both paths stay covered either way.
  nonInsuranceOrganizationsEnabled: false,
  // ON in core so the Ambient Scribe recommendations prototype can be exercised locally.
  // Per-customer configs omit this field and land at undefined (falsy -> panel hidden).
  ambientScribeRecommendationsEnabled: true,
};

export const FEATURE_FLAGS_CONFIG = Object.freeze(FeatureFlagsConfigSchema.parse(FEATURE_FLAGS_DATA));
