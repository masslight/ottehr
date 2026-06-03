import z from 'zod';

export const FeatureFlagsConfigSchema = z.object({
  labOrdersEnabled: z.boolean(),
  inHouseLabsEnabled: z.boolean(),
  radiologyEnabled: z.boolean(),
  nursingOrdersEnabled: z.boolean(),
  supervisorApprovalEnabled: z.boolean(),
  demoVisitsEnabled: z.boolean(),
  globalTemplatesEnabled: z.boolean(),
  formsEnabled: z.boolean(),
  legacyDataEnabled: z.boolean(),
  mailingPaperStatementsEnabled: z.boolean(),
  automatedPatientOutreachEnabled: z.boolean(),
  legacyPatientFollowupsEnabled: z.boolean(),
  skipSendingVisitNoteToPatientPortalEnabled: z.boolean(),
  sendgridEnabled: z.boolean(),
  hideRegisterAnotherPatient: z.boolean().optional(),
});

export type FeatureFlagsConfig = z.infer<typeof FeatureFlagsConfigSchema>;
