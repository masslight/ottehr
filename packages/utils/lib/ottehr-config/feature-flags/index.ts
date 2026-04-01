import { FeatureFlagsConfigSchema } from 'config-types';

const FEATURE_FLAGS_DATA = {
  labOrdersEnabled: false,
  inHouseLabsEnabled: false,
  radiologyEnabled: false,
  nursingOrdersEnabled: false,
  supervisorApprovalEnabled: false,
  demoVisitsEnabled: false,
  globalTemplatesEnabled: false,
  formsEnabled: false,
  legacyDataEnabled: false,
  mailingPaperStatementsEnabled: false,
  legacyPatientFollowupsEnabled: false,
  skipSendingVisitNoteToPatientPortalEnabled: false,
  sendgridEnabled: false,
};

export const FEATURE_FLAGS_CONFIG = Object.freeze(FeatureFlagsConfigSchema.parse(FEATURE_FLAGS_DATA));
