import z from 'zod';

export const FeatureFlagsConfigSchema = z.object({
  labOrdersEnabled: z.boolean().default(false),
  inHouseLabsEnabled: z.boolean().default(false),
  radiologyEnabled: z.boolean().default(false),
  nursingOrdersEnabled: z.boolean().default(false),
  supervisorApprovalEnabled: z.boolean().default(false),
  demoVisitsEnabled: z.boolean().default(false),
  globalTemplatesEnabled: z.boolean().default(false),
  formsEnabled: z.boolean().default(false),
  legacyDataEnabled: z.boolean().default(false),
  mailingPaperStatementsEnabled: z.boolean().default(false),
  legacyPatientFollowupsEnabled: z.boolean().default(false),
  skipSendingVisitNoteToPatientPortalEnabled: z.boolean().default(false),
  sendgridEnabled: z.boolean().default(false),
});

export type FeatureFlagsConfig = z.infer<typeof FeatureFlagsConfigSchema>;
