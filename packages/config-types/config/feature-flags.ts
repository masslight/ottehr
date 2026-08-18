import z from 'zod';

export const FeatureFlagsConfigSchema = z.object({
  labOrdersEnabled: z.boolean(),
  inHouseLabsEnabled: z.boolean(),
  radiologyEnabled: z.boolean(),
  nursingOrdersEnabled: z.boolean(),
  supervisorApprovalEnabled: z.boolean(),
  demoVisitsEnabled: z.boolean(),
  /** Easy Chart: the AI-assisted charting page. Gated by BOTH this flag and the charting role set. */
  easyChartEnabled: z.boolean(),
  globalTemplatesEnabled: z.boolean(),
  formsEnabled: z.boolean(),
  legacyDataEnabled: z.boolean(),
  mailingPaperStatementsEnabled: z.boolean(),
  automatedPatientOutreachEnabled: z.boolean(),
  legacyPatientFollowupsEnabled: z.boolean(),
  skipSendingVisitNoteToPatientPortalEnabled: z.boolean(),
  sendgridEnabled: z.boolean(),
  hideRegisterAnotherPatient: z.boolean().optional(),
  ottehrBillingInvoicingEnabled: z.boolean().optional(),
  // When false, the patient-facing booking flow only sees BOOKING_CONFIG
  // categories — FHIR-managed (admin-registered) HealthcareService categories
  // are suppressed. Lets a customer experiment with adding a service category
  // in the admin UI without immediately exposing it to patients. Default off
  // so new customers don't accidentally surface in-progress configuration.
  // The admin UI is unaffected (it queries `admin-list-service-categories`,
  // not the patient-facing `get-service-categories`).
  dynamicServiceCategoriesEnabled: z.boolean().optional(),
});

export type FeatureFlagsConfig = z.infer<typeof FeatureFlagsConfigSchema>;
