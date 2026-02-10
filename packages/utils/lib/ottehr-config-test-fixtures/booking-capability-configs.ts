/**
 * Booking capability test configurations
 *
 * Each config exercises specific booking flow capabilities that downstream
 * repos might customize. Tests run against all these configs to ensure the
 * booking system handles any schema-valid configuration correctly.
 */

export interface BookingCapabilityTestConfig {
  name: string;
  description: string;
  overrides: Record<string, any>;
}

export const BOOKING_CAPABILITY_TEST_CONFIGS: Record<string, BookingCapabilityTestConfig> = {
  baseline: {
    name: 'baseline',
    description: 'Default booking configuration with all flows enabled',
    overrides: {},
  },

  inPersonOnly: {
    name: 'in-person-only',
    description: 'Only in-person visits enabled, no virtual visits',
    overrides: {
      serviceCategoriesEnabled: {
        serviceModes: ['in-person'],
        visitType: ['prebook', 'walk-in'],
      },
      homepageOptions: ['start-in-person-visit', 'schedule-in-person-visit'],
    },
  },

  virtualOnly: {
    name: 'virtual-only',
    description: 'Only virtual visits enabled, no in-person visits',
    overrides: {
      serviceCategoriesEnabled: {
        serviceModes: ['virtual'],
        visitType: ['prebook', 'walk-in'],
      },
      homepageOptions: ['start-virtual-visit', 'schedule-virtual-visit'],
    },
  },

  prebookOnly: {
    name: 'prebook-only',
    description: 'Only scheduled appointments, no walk-ins',
    overrides: {
      serviceCategoriesEnabled: {
        serviceModes: ['in-person', 'virtual'],
        visitType: ['prebook'],
      },
      homepageOptions: ['schedule-in-person-visit', 'schedule-virtual-visit'],
    },
  },

  walkInOnly: {
    name: 'walk-in-only',
    description: 'Only walk-in visits, no pre-scheduled appointments',
    overrides: {
      serviceCategoriesEnabled: {
        serviceModes: ['in-person', 'virtual'],
        visitType: ['walk-in'],
      },
      homepageOptions: ['start-in-person-visit', 'start-virtual-visit'],
    },
  },

  urgentCareOnly: {
    name: 'urgent-care-only',
    description: 'Single service category: urgent care',
    overrides: {
      serviceCategories: [
        {
          code: 'urgent-care',
          display: 'Urgent Care',
        },
      ],
    },
  },

  hiddenPatientFields: {
    name: 'hidden-patient-fields',
    description: 'Configuration with some patient info fields hidden',
    overrides: {
      formConfig: {
        FormFields: {
          patientInfo: {
            hiddenFields: ['patient-middle-name', 'patient-preferred-name'],
          },
        },
      },
    },
  },
};
