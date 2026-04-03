/**
 * All feature flags default to false. Override specific flags as needed.
 *
 * Usage in test files:
 *   vi.mock('src/constants/feature-flags', () => mockFeatureFlags({ LAB_ORDERS_ENABLED: true }));
 */
export function mockFeatureFlags(
  overrides: Partial<{
    LAB_ORDERS_ENABLED: boolean;
    RADIOLOGY_ENABLED: boolean;
    IN_HOUSE_LABS_ENABLED: boolean;
    NURSING_ORDERS_ENABLED: boolean;
    SUPERVISOR_APPROVAL_ENABLED: boolean;
    DEMO_VISITS_ENABLED: boolean;
    GLOBAL_TEMPLATES_ENABLED: boolean;
    FORMS_ENABLED: boolean;
    LEGACY_DATA_ENABLED: boolean;
    LEGACY_PATIENT_FOLLOWUPS_ENABLED: boolean;
    MAILING_PAPER_STATEMENTS_ENABLED: boolean;
    SKIP_SENDING_VISIT_NOTE_TO_PATIENT_PORTAL_WHEN_THE_NOTE_IS_SIGNED_FEATURE_FLAG: boolean;
  }> = {}
): { FEATURE_FLAGS: Record<string, boolean> } {
  return {
    FEATURE_FLAGS: {
      LAB_ORDERS_ENABLED: false,
      RADIOLOGY_ENABLED: false,
      IN_HOUSE_LABS_ENABLED: false,
      NURSING_ORDERS_ENABLED: false,
      SUPERVISOR_APPROVAL_ENABLED: false,
      DEMO_VISITS_ENABLED: false,
      GLOBAL_TEMPLATES_ENABLED: false,
      FORMS_ENABLED: false,
      LEGACY_DATA_ENABLED: false,
      LEGACY_PATIENT_FOLLOWUPS_ENABLED: false,
      MAILING_PAPER_STATEMENTS_ENABLED: false,
      SKIP_SENDING_VISIT_NOTE_TO_PATIENT_PORTAL_WHEN_THE_NOTE_IS_SIGNED_FEATURE_FLAG: false,
      ...overrides,
    },
  };
}
