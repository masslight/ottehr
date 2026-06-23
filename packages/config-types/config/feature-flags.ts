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
  // When false, the patient-facing booking flow only sees BOOKING_CONFIG
  // categories — FHIR-managed (admin-registered) HealthcareService categories
  // are suppressed. Lets a customer experiment with adding a service category
  // in the admin UI without immediately exposing it to patients. Default off
  // so new customers don't accidentally surface in-progress configuration.
  // The admin UI is unaffected (it queries `admin-list-service-categories`,
  // not the patient-facing `get-service-categories`).
  dynamicServiceCategoriesEnabled: z.boolean().optional(),
  // Gates the billing pre-submission rules engine: the kickoff Task created on working-copy claim
  // creation, and the Rules admin screen in the billing app. Optional so existing per-customer
  // configs default to off (undefined → falsy). Turning it on enables auto-submission of claims that
  // pass the engine, so it is opt-in.
  presubmissionRulesEngineEnabled: z.boolean().optional(),
});

export type FeatureFlagsConfig = z.infer<typeof FeatureFlagsConfigSchema>;
