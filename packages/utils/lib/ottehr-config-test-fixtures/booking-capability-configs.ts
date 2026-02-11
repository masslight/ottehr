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
      homepageOptions: [
        { id: 'start-in-person-visit', label: 'Start In-Person Visit' },
        { id: 'schedule-in-person-visit', label: 'Schedule In-Person Visit' },
      ],
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
      homepageOptions: [
        { id: 'start-virtual-visit', label: 'Start Virtual Visit' },
        { id: 'schedule-virtual-visit', label: 'Schedule Virtual Visit' },
      ],
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
      homepageOptions: [
        { id: 'schedule-in-person-visit', label: 'Schedule In-Person Visit' },
        { id: 'schedule-virtual-visit', label: 'Schedule Virtual Visit' },
      ],
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
      homepageOptions: [
        { id: 'start-in-person-visit', label: 'Start In-Person Visit' },
        { id: 'start-virtual-visit', label: 'Start Virtual Visit' },
      ],
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
