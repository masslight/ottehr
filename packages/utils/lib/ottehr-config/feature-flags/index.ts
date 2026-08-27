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
  // OFF until an environment migrates claims to Ottehr billing: the core e2e envs still run
  // BILLING_INTEGRATION 'all', and flag-on requires 'ottehr' exclusively (terraform generation
  // and shouldUseCandid both reject the combination). Flip to true alongside setting
  // BILLING_INTEGRATION='ottehr' in every env this build deploys to. Off, everything runs the
  // legacy Employers mode with Candid sync; unit/component tests pin the flag themselves, so
  // both paths stay covered either way.
  nonInsuranceOrganizationsEnabled: false,
};

export const FEATURE_FLAGS_CONFIG = Object.freeze(FeatureFlagsConfigSchema.parse(FEATURE_FLAGS_DATA));
