/**
 * Capability test configurations
 *
 * Each config exercises a specific configuration capability that downstream
 * repos might use. Tests run against all these configs to ensure the system
 * handles any schema-valid configuration correctly.
 *
 * These are OVERRIDE objects that get merged with the base defaults,
 * following the same pattern as downstream ottehr-config-overrides.
 */

export interface CapabilityTestConfig {
  name: string;
  description: string;
  overrides: Record<string, any>; // Override object to merge with defaults
}

export const CAPABILITY_TEST_CONFIGS: Record<string, CapabilityTestConfig> = {
  baseline: {
    name: 'baseline',
    description: 'Default configuration with no overrides',
    overrides: {}, // Empty overrides = pure defaults
  },

  hiddenFields: {
    name: 'hidden-fields',
    description: 'Configuration with various fields hidden via hiddenFields array',
    overrides: {
      FormFields: {
        contactInformation: {
          hiddenFields: ['patient-street-address-2', 'patient-preferred-communication-method'],
        },
        patientDetails: {
          hiddenFields: ['preferred-language', 'mobile-opt-in', 'patient-point-of-discovery'],
        },
      },
    },
  },

  customCopy: {
    name: 'custom-copy',
    description: 'Configuration with customized page titles and labels',
    overrides: {
      FormFields: {
        contactInformation: {
          title: 'Your Contact Details',
        },
        patientDetails: {
          title: 'About the Patient',
        },
        responsiblePartyPage: {
          title: 'Guardian Information',
        },
      },
    },
  },
};
