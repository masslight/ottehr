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
  candidInvoicingEnabled: true,
  ottehrBillingInvoicingEnabled: true,
  // ON in core for testing + demoing the full FHIR-managed catalog flow.
  // Per-customer configs under local/secrets/<customer>/... omit this field
  // and land at undefined (falsy → FHIR categories suppressed) — customers
  // opt in explicitly by setting `dynamicServiceCategoriesEnabled: true`.
  dynamicServiceCategoriesEnabled: true,
};

export const FEATURE_FLAGS_CONFIG = Object.freeze(FeatureFlagsConfigSchema.parse(FEATURE_FLAGS_DATA));
