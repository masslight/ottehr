import { FeatureFlagsConfigSchema } from 'config-types';

const FEATURE_FLAGS_DATA = {
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
  legacyPatientFollowupsEnabled: false,
  skipSendingVisitNoteToPatientPortalEnabled: false,
  sendgridEnabled: false,
};

export const FEATURE_FLAGS_CONFIG = Object.freeze(FeatureFlagsConfigSchema.parse(FEATURE_FLAGS_DATA));
