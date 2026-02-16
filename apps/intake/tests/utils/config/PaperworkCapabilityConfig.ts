/**
 * Paperwork capability configs for automated testing
 *
 * Each config represents a different paperwork flow variation to ensure
 * comprehensive test coverage without exploding test count.
 */

export type PaperworkConfigName =
  | 'baseline-in-person'
  | 'required-only-in-person'
  | 'workers-comp-in-person'
  | 'workers-comp-virtual'
  | 'occ-med-in-person'
  | 'occ-med-virtual'
  | 'photo-id-in-person'
  | 'baseline-virtual'
  | 'minimal-virtual'
  | 'virtual-with-secondary-insurance'
  | 'hidden-fields-test'
  | 'validation-test';

export interface PaperworkCapabilityConfig {
  name: PaperworkConfigName;
  description: string;
  serviceMode: 'in-person' | 'virtual';

  // Data generation hints
  dataOptions: {
    fillAllFields: boolean; // true = all fields, false = required only
    paymentMethod: 'insurance' | 'self-pay' | 'workers-comp';
    responsibleParty: 'self' | 'not-self';
    hasSecondaryInsurance: boolean;

    // Medical history (virtual only)
    hasMedications?: boolean;
    hasAllergies?: boolean;
    hasMedicalHistory?: boolean;
    hasSurgicalHistory?: boolean;

    // Attachments
    includePhotoID?: boolean;
    includeInsuranceCards?: boolean;

    // Service-specific
    serviceCategory?: 'urgent-care' | 'workers-comp' | 'occ-med';
    hasEmployerInfo?: boolean;
    hasAttorney?: boolean;
    needsWorkNote?: boolean;
  };

  // Config injection (if needed)
  configOverrides?: {
    hiddenFields?: string[];
    requiredFields?: string[];
  };
}

/**
 * Create a paperwork capability config by name
 */
export function createPaperworkCapabilityConfig(name: PaperworkConfigName): PaperworkCapabilityConfig {
  const configs: Record<PaperworkConfigName, PaperworkCapabilityConfig> = {
    'baseline-in-person': {
      name: 'baseline-in-person',
      description: 'Complete happy path with all fields visible and filled',
      serviceMode: 'in-person',
      dataOptions: {
        fillAllFields: true,
        paymentMethod: 'insurance',
        responsibleParty: 'not-self',
        hasSecondaryInsurance: false,
        includePhotoID: true,
        includeInsuranceCards: true,
        serviceCategory: 'urgent-care',
        hasEmployerInfo: false,
        hasAttorney: false,
        needsWorkNote: false,
      },
    },

    'required-only-in-person': {
      name: 'required-only-in-person',
      description: 'Minimal required fields, self-pay',
      serviceMode: 'in-person',
      dataOptions: {
        fillAllFields: false,
        paymentMethod: 'self-pay',
        responsibleParty: 'self',
        hasSecondaryInsurance: false,
        includePhotoID: false,
        includeInsuranceCards: false,
        serviceCategory: 'urgent-care',
        hasEmployerInfo: false,
        hasAttorney: false,
        needsWorkNote: false,
      },
    },

    'workers-comp-in-person': {
      name: 'workers-comp-in-person',
      description: 'Workers compensation flow with employer info',
      serviceMode: 'in-person',
      dataOptions: {
        fillAllFields: true,
        paymentMethod: 'workers-comp',
        responsibleParty: 'self',
        hasSecondaryInsurance: false,
        includePhotoID: true,
        includeInsuranceCards: false,
        serviceCategory: 'workers-comp',
        hasEmployerInfo: true,
        hasAttorney: false, // Can be toggled for conditional testing
        needsWorkNote: false,
      },
    },

    'workers-comp-virtual': {
      name: 'workers-comp-virtual',
      description: 'Workers compensation virtual flow with employer info',
      serviceMode: 'virtual',
      dataOptions: {
        fillAllFields: true,
        paymentMethod: 'workers-comp',
        responsibleParty: 'self',
        hasSecondaryInsurance: false,
        hasMedications: true,
        hasAllergies: true,
        hasMedicalHistory: true,
        hasSurgicalHistory: true,
        includePhotoID: true,
        includeInsuranceCards: false,
        serviceCategory: 'workers-comp',
        hasEmployerInfo: true,
        hasAttorney: false,
        needsWorkNote: false,
      },
    },

    'occ-med-in-person': {
      name: 'occ-med-in-person',
      description: 'Occupational medicine with employer requirements',
      serviceMode: 'in-person',
      dataOptions: {
        fillAllFields: true,
        paymentMethod: 'insurance', // Or employer-paid
        responsibleParty: 'self',
        hasSecondaryInsurance: false,
        includePhotoID: true,
        includeInsuranceCards: true,
        serviceCategory: 'occ-med',
        hasEmployerInfo: true,
        hasAttorney: false,
        needsWorkNote: true,
      },
    },

    'occ-med-virtual': {
      name: 'occ-med-virtual',
      description: 'Occupational medicine virtual flow with employer requirements',
      serviceMode: 'virtual',
      dataOptions: {
        fillAllFields: true,
        paymentMethod: 'insurance',
        responsibleParty: 'self',
        hasSecondaryInsurance: false,
        hasMedications: true,
        hasAllergies: true,
        hasMedicalHistory: true,
        hasSurgicalHistory: true,
        includePhotoID: true,
        includeInsuranceCards: true,
        serviceCategory: 'occ-med',
        hasEmployerInfo: true,
        hasAttorney: false,
        needsWorkNote: true,
      },
    },

    'photo-id-in-person': {
      name: 'photo-id-in-person',
      description: 'Test attachment upload with photo ID',
      serviceMode: 'in-person',
      dataOptions: {
        fillAllFields: true,
        paymentMethod: 'insurance',
        responsibleParty: 'self',
        hasSecondaryInsurance: false,
        includePhotoID: true,
        includeInsuranceCards: true,
        serviceCategory: 'urgent-care',
        hasEmployerInfo: false,
        hasAttorney: false,
        needsWorkNote: false,
      },
    },

    'baseline-virtual': {
      name: 'baseline-virtual',
      description: 'Virtual visit happy path with medical history',
      serviceMode: 'virtual',
      dataOptions: {
        fillAllFields: true,
        paymentMethod: 'insurance',
        responsibleParty: 'not-self',
        hasSecondaryInsurance: false,
        hasMedications: true,
        hasAllergies: true,
        hasMedicalHistory: true,
        hasSurgicalHistory: true,
        includePhotoID: true,
        includeInsuranceCards: true,
        serviceCategory: 'urgent-care',
        hasEmployerInfo: false,
        hasAttorney: false,
        needsWorkNote: false,
      },
    },

    'minimal-virtual': {
      name: 'minimal-virtual',
      description: 'Virtual visit with no medical history',
      serviceMode: 'virtual',
      dataOptions: {
        fillAllFields: false,
        paymentMethod: 'self-pay',
        responsibleParty: 'self',
        hasSecondaryInsurance: false,
        hasMedications: false,
        hasAllergies: false,
        hasMedicalHistory: false,
        hasSurgicalHistory: false,
        includePhotoID: false,
        includeInsuranceCards: false,
        serviceCategory: 'urgent-care',
        hasEmployerInfo: false,
        hasAttorney: false,
        needsWorkNote: false,
      },
    },

    'virtual-with-secondary-insurance': {
      name: 'virtual-with-secondary-insurance',
      description: 'Complex insurance scenario (virtual)',
      serviceMode: 'virtual',
      dataOptions: {
        fillAllFields: true,
        paymentMethod: 'insurance',
        responsibleParty: 'self',
        hasSecondaryInsurance: true,
        hasMedications: true,
        hasAllergies: false,
        hasMedicalHistory: true,
        hasSurgicalHistory: false,
        includePhotoID: true,
        includeInsuranceCards: true,
        serviceCategory: 'urgent-care',
        hasEmployerInfo: false,
        hasAttorney: false,
        needsWorkNote: false,
      },
    },

    'hidden-fields-test': {
      name: 'hidden-fields-test',
      description: 'Test config-based field hiding',
      serviceMode: 'in-person',
      dataOptions: {
        fillAllFields: true,
        paymentMethod: 'insurance',
        responsibleParty: 'self',
        hasSecondaryInsurance: false,
        includePhotoID: false,
        includeInsuranceCards: true,
        serviceCategory: 'urgent-care',
        hasEmployerInfo: false,
        hasAttorney: false,
        needsWorkNote: false,
      },
      configOverrides: {
        // Example: Hide specific fields to test conditional rendering
        hiddenFields: ['patient-ethnicity', 'patient-race', 'primary-care-physician-name'],
      },
    },

    'validation-test': {
      name: 'validation-test',
      description: 'Test field validation with invalid data',
      serviceMode: 'in-person',
      dataOptions: {
        fillAllFields: true,
        paymentMethod: 'insurance',
        responsibleParty: 'not-self',
        hasSecondaryInsurance: false,
        includePhotoID: false,
        includeInsuranceCards: true,
        serviceCategory: 'urgent-care',
        hasEmployerInfo: false,
        hasAttorney: false,
        needsWorkNote: false,
      },
    },
  };

  return configs[name];
}

/**
 * Get all paperwork config names
 */
export function getAllPaperworkConfigNames(): PaperworkConfigName[] {
  return [
    'baseline-in-person',
    'required-only-in-person',
    'workers-comp-in-person',
    'workers-comp-virtual',
    'occ-med-in-person',
    'occ-med-virtual',
    'photo-id-in-person',
    'baseline-virtual',
    'minimal-virtual',
    'virtual-with-secondary-insurance',
    'hidden-fields-test',
    'validation-test',
  ];
}

/**
 * Get paperwork config names filtered by service mode
 */
export function getPaperworkConfigNamesByMode(mode: 'in-person' | 'virtual'): PaperworkConfigName[] {
  return getAllPaperworkConfigNames().filter((name) => {
    const config = createPaperworkCapabilityConfig(name);
    return config.serviceMode === mode;
  });
}
