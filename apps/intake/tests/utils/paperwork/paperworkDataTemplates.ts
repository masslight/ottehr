import { VALUE_SETS } from 'utils';

/**
 * Test data template factories
 *
 * These create value maps (linkId -> value) for filling questionnaire pages.
 * Each factory returns both valid and (optionally) invalid test data to enable
 * automated validation testing.
 */

export interface FieldTestData {
  /** Valid values that should pass validation */
  valid: Record<string, any>;
  /** Invalid values that should trigger validation errors (optional) */
  invalid?: Record<string, any>;
}

export const getTestDataForPage = (
  pageLinkId: string,
  context?: { serviceMode?: 'in-person' | 'virtual'; visitType?: 'walk-in' | 'prebook'; serviceCategory?: string }
): FieldTestData => {
  const factory = pageDataTemplateMapFactory(context)[pageLinkId];
  if (factory) {
    return factory();
  }
  // Fallback: return empty valid map if no template found
  return { valid: {} };
};

// todo: these just need to be static files somewhere, imported and accessed in getTestDataForPage
/**
 * Create contact information data
 */
const createContactInformationData = (overrides?: {
  email?: string;
  phoneNumber?: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  preferredCommunication?: string;
}): FieldTestData => {
  const valueSets = VALUE_SETS;
  return {
    valid: {
      'patient-email': overrides?.email || 'test@example.com',
      'patient-number': overrides?.phoneNumber || '1234567890',
      'patient-street-address': overrides?.address || '123 Test Street',
      'patient-street-address-2': overrides?.addressLine2 || '',
      'patient-city': overrides?.city || 'TestCity',
      'patient-state': overrides?.state || 'CA',
      'patient-zip': overrides?.zip || '12345',
      'patient-preferred-communication-method':
        overrides?.preferredCommunication || valueSets.preferredCommunicationMethodOptions[1].value, // 'Email'
    },
    invalid: {
      'patient-email': 'not-an-email',
      'patient-number': '123', // Too short
      'patient-zip': 'ABCDE', // Non-numeric
    },
  };
};

/**
 * Create patient details data
 */
export const createPatientDetailsData = (overrides?: {
  ethnicity?: string;
  race?: string;
  language?: string;
  pronouns?: string;
  pointOfDiscovery?: string;
  relayPhone?: string;
}): FieldTestData => {
  const valueSets = VALUE_SETS;
  return {
    valid: {
      'patient-ethnicity': overrides?.ethnicity || valueSets.ethnicityOptions[0].value,
      'patient-race': overrides?.race || valueSets.raceOptions[0].value,
      'preferred-language': overrides?.language || valueSets.languageOptions[0].value,
      // relay-phone is required for virtual flows
      'relay-phone': overrides?.relayPhone || valueSets.yesNoOptions[1].value, // 'No'
      ...(overrides?.pronouns && { 'patient-pronouns': overrides.pronouns }),
      ...(overrides?.pointOfDiscovery && { 'patient-point-of-discovery': overrides.pointOfDiscovery }),
    },
    // No meaningful invalid values for dropdown selections
  };
};

/**
 * Create primary care physician data
 */
const createPrimaryCarePhysicianData = (overrides?: {
  firstName?: string;
  lastName?: string;
  practiceName?: string;
  address?: string;
  phoneNumber?: string;
}): FieldTestData => ({
  valid: {
    'pcp-first-name': overrides?.firstName || 'PCP',
    'pcp-last-name': overrides?.lastName || 'LastName',
    'pcp-practice-name': overrides?.practiceName || 'PCP Practice',
    'pcp-practice-address': overrides?.address || '123 PCP Street',
    'pcp-number': overrides?.phoneNumber || '(123) 456-7890',
  },
  invalid: {
    'pcp-number': '123', // Too short
  },
});

/**
 * Create payment selection data
 */
const createPaymentSelectionData = (method: 'insurance' | 'self-pay'): FieldTestData => ({
  valid: {
    'payment-option': method === 'insurance' ? 'I have insurance' : 'I will pay without insurance',
  },
  // No invalid values for radio button selection
});

/**
 * Create combined payment page data (payment selection + conditional insurance fields)
 * When 'insurance' is selected, insurance fields become visible and required
 */
const createPaymentPageData = (method: 'insurance' | 'self-pay'): FieldTestData => {
  const paymentData = createPaymentSelectionData(method);

  if (method === 'self-pay') {
    return paymentData;
  }

  // For insurance, merge with insurance fields that appear conditionally
  const insuranceData = createInsuranceData();
  return {
    valid: {
      ...paymentData.valid,
      ...insuranceData.valid,
    },
    invalid: {
      ...paymentData.invalid,
      ...insuranceData.invalid,
    },
  };
};

/**
 * Create occupational medicine payment page data
 * Uses different field key and value set than regular payment page
 * Options: 'Self' (self-pay) or 'Employer' (employer-paid)
 */
const createOccMedPaymentPageData = (method: 'self' | 'employer'): FieldTestData => {
  const valueSets = VALUE_SETS;
  const paymentOptions = valueSets.patientOccMedPaymentPageOptions;
  const selectedOption = method === 'employer' ? paymentOptions[1].value : paymentOptions[0].value;

  return {
    valid: {
      'payment-option-occupational': selectedOption,
    },
  };
};

/**
 * Create insurance information data
 * Note: insurance-carrier is a reference field. The value is not used - tests select the first
 * available option from the environment's payers.json configuration.
 */
const createInsuranceData = (overrides?: {
  carrier?: string;
  memberId?: string;
  policyHolderFirstName?: string;
  policyHolderLastName?: string;
  policyHolderDOB?: string;
  policyHolderBirthSex?: string;
  relationship?: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
}): FieldTestData => {
  const valueSets = VALUE_SETS;
  return {
    valid: {
      'insurance-carrier': overrides?.carrier || '', // Value unused - first option selected
      'insurance-member-id': overrides?.memberId || '123456789',
      'policy-holder-first-name': overrides?.policyHolderFirstName || 'Insurance',
      'policy-holder-last-name': overrides?.policyHolderLastName || 'Holder',
      'policy-holder-date-of-birth': overrides?.policyHolderDOB || '01/01/1990',
      'policy-holder-birth-sex': overrides?.policyHolderBirthSex || valueSets.birthSexOptions[0].value,
      'patient-relationship-to-insured': overrides?.relationship || valueSets.relationshipOptions[1].value,
      'policy-holder-address-as-patient': false, // Uncheck to enable address fields
      'policy-holder-address': overrides?.address || '123 Insurance St',
      'policy-holder-address-additional-line': overrides?.addressLine2 || 'Apt 11',
      'policy-holder-city': overrides?.city || 'InsuranceCity',
      'policy-holder-state': overrides?.state || 'CA',
      'policy-holder-zip': overrides?.zip || '12345',
    },
    invalid: {
      'policy-holder-date-of-birth': '13/32/2020', // Invalid date
      'policy-holder-zip': 'ABCDE', // Non-numeric
    },
  };
};

/**
 * Create responsible party data
 */
const createResponsiblePartyData = (
  relationship: 'self' | 'not-self',
  overrides?: {
    relationshipValue?: string;
    firstName?: string;
    lastName?: string;
    dob?: string;
    birthSex?: string;
    phone?: string;
    email?: string;
    address?: string;
    addressLine2?: string;
    city?: string;
    state?: string;
    zip?: string;
  }
): FieldTestData => {
  const valueSets = VALUE_SETS;

  if (relationship === 'self') {
    return {
      valid: {
        'responsible-party-relationship': 'Self',
      },
    };
  }

  // Use index 1 (Spouse) to get a non-Self relationship that keeps name fields enabled
  // Set address-as-patient to false so address fields are enabled (they have enableWhen on this)
  return {
    valid: {
      'responsible-party-relationship': overrides?.relationshipValue || valueSets.relationshipOptions[1].value,
      'responsible-party-first-name': overrides?.firstName || 'Responsible',
      'responsible-party-last-name': overrides?.lastName || 'Party',
      'responsible-party-date-of-birth': overrides?.dob || '01/01/1980',
      'responsible-party-birth-sex': overrides?.birthSex || valueSets.birthSexOptions[0].value,
      'responsible-party-number': overrides?.phone || '1234567890',
      'responsible-party-email': overrides?.email || 'responsible@example.com',
      'responsible-party-address-as-patient': false, // Uncheck to enable address fields
      'responsible-party-address': overrides?.address || '123 RP Street',
      ...(overrides?.addressLine2 && { 'responsible-party-address-2': overrides.addressLine2 }),
      'responsible-party-city': overrides?.city || 'RPCity',
      'responsible-party-state': overrides?.state || 'CA',
      'responsible-party-zip': overrides?.zip || '12345',
    },
    invalid: {
      'responsible-party-email': 'not-an-email',
      'responsible-party-number': '123', // Too short
      'responsible-party-date-of-birth': '99/99/9999', // Invalid date
      'responsible-party-zip': 'ABCDE', // Non-numeric
    },
  };
};

/**
 * Create emergency contact data
 */
const createEmergencyContactData = (overrides?: {
  relationship?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
}): FieldTestData => {
  const valueSets = VALUE_SETS;
  return {
    valid: {
      'emergency-contact-relationship':
        overrides?.relationship || valueSets.emergencyContactRelationshipOptions[0].value,
      'emergency-contact-first-name': overrides?.firstName || 'Emergency',
      'emergency-contact-last-name': overrides?.lastName || 'Contact',
      'emergency-contact-number': overrides?.phone || '1234567890',
      'emergency-contact-address-as-patient': false, // Uncheck to enable address fields
      'emergency-contact-address': overrides?.address || '123 EC Street',
      ...(overrides?.addressLine2 && { 'emergency-contact-address-2': overrides.addressLine2 }),
      'emergency-contact-city': overrides?.city || 'ECCity',
      'emergency-contact-state': overrides?.state || 'CA',
      'emergency-contact-zip': overrides?.zip || '12345',
    },
    invalid: {
      'emergency-contact-number': '123', // Too short
      'emergency-contact-zip': 'ABCDE', // Non-numeric
    },
  };
};

/**
 * Create employer information data (for workers comp)
 */
const createEmployerInformationData = (overrides?: {
  employerName?: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  contactFirstName?: string;
  contactLastName?: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactFax?: string;
}): FieldTestData => ({
  valid: {
    'employer-name': overrides?.employerName || 'Test Employer Inc',
    'employer-address': overrides?.address || '123 Employer St',
    ...(overrides?.addressLine2 && { 'employer-address-2': overrides.addressLine2 }),
    'employer-city': overrides?.city || 'EmployerCity',
    'employer-state': overrides?.state || 'CA',
    'employer-zip': overrides?.zip || '12345',
    'employer-contact-first-name': overrides?.contactFirstName || 'Contact',
    'employer-contact-last-name': overrides?.contactLastName || 'Person',
    'employer-contact-title': overrides?.contactTitle || 'HR Manager',
    'employer-contact-email': overrides?.contactEmail || 'contact@employer.com',
    'employer-contact-phone': overrides?.contactPhone || '1234567890',
    'employer-contact-fax': overrides?.contactFax || '0987654321',
  },
  invalid: {
    'employer-contact-email': 'not-an-email',
    'employer-contact-phone': '123', // Too short
    'employer-zip': 'ABCDE', // Non-numeric
  },
});

/**
 * Create occupational medicine employer data
 * This page has a single reference field to select an employer Organization.
 * For reference fields, the helper automatically selects the first available option
 * from the dropdown - the value provided here is just a placeholder to trigger filling.
 */
const createOccMedEmployerInformationData = (): FieldTestData => ({
  valid: {
    // Reference field - helper will select first available option from the dropdown
    'occupational-medicine-employer': true,
  },
});

/**
 * Create current medications data (virtual only)
 */
const createCurrentMedicationsData = (
  state: 'empty' | 'filled',
  _medications?: { typed?: string[]; selected?: string[] }
): FieldTestData => {
  const valueSets = VALUE_SETS;
  // Index 0 = "Patient does not take any medications currently"
  // Index 1 = "Patient takes medication currently"
  const noOption = valueSets.currentMedicationsYesNoOptions[0].value;
  const yesOption = valueSets.currentMedicationsYesNoOptions[1].value;

  if (state === 'empty') {
    return {
      valid: {
        'current-medications-yes-no': noOption,
      },
    };
  }

  return {
    valid: {
      'current-medications-yes-no': yesOption,
      // TODO: Handle the multi-select group for medications
    },
  };
};

/**
 * Create current allergies data (virtual only)
 */
const createCurrentAllergiesData = (
  state: 'empty' | 'filled',
  _allergies?: { typed?: string[]; selected?: string[] }
): FieldTestData => {
  const valueSets = VALUE_SETS;
  // Index 0 = "Patient has no known current allergies"
  // Index 1 = "Patient has known current allergies"
  const noOption = valueSets.allergiesYesNoOptions[0].value;
  const yesOption = valueSets.allergiesYesNoOptions[1].value;

  if (state === 'empty') {
    return {
      valid: {
        'allergies-yes-no': noOption,
      },
    };
  }

  return {
    valid: {
      'allergies-yes-no': yesOption,
      // TODO: Handle the multi-select group for allergies
    },
  };
};

/**
 * Create medical history data
 * Note: For in-person flows, this page uses AI Interview and skips patch-paperwork.
 * For virtual flows, this uses a yes/no field with optional conditions list.
 */
const createMedicalHistoryData = (
  state: 'empty' | 'filled',
  _conditions?: { typed?: string[]; selected?: string[] }
): FieldTestData => {
  const valueSets = VALUE_SETS;
  // Index 0 = "Patient has no current medical conditions"
  // Index 1 = "Patient has current medical conditions"
  const noOption = valueSets.medicalHistoryYesNoOptions[0].value;
  const yesOption = valueSets.medicalHistoryYesNoOptions[1].value;

  if (state === 'empty') {
    return {
      valid: {
        'medical-history-yes-no': noOption,
      },
    };
  }

  return {
    valid: {
      'medical-history-yes-no': yesOption,
      // TODO: Handle the multi-select group for conditions
    },
  };
};

/**
 * Create surgical history data (virtual only)
 */
const createSurgicalHistoryData = (
  state: 'empty' | 'filled',
  _surgeries?: { typed?: string[]; selected?: string[] }
): FieldTestData => {
  const valueSets = VALUE_SETS;
  // Index 0 = "Patient has no surgical history"
  // Index 1 = "Patient has surgical history"
  const noOption = valueSets.surgicalHistoryYesNoOptions[0].value;
  const yesOption = valueSets.surgicalHistoryYesNoOptions[1].value;

  if (state === 'empty') {
    return {
      valid: {
        'surgical-history-yes-no': noOption,
      },
    };
  }

  return {
    valid: {
      'surgical-history-yes-no': yesOption,
      // TODO: Handle the multi-select group for surgeries
    },
  };
};

/**
 * Create additional questions/flags data (virtual only)
 */
const createAdditionalQuestionsData = (overrides?: Record<string, string>): FieldTestData => ({
  valid: {
    // Default answers for common screening questions
    'covid-19-exposure': overrides?.['covid-19-exposure'] || 'No',
    'recent-testing': overrides?.['recent-testing'] || 'No',
    'recent-travel': overrides?.['recent-travel'] || 'No',
    ...overrides,
  },
  // No invalid values for yes/no questions
});

/**
 * Create school/work note request data (virtual only)
 */
const createSchoolWorkNoteData = (noteType: 'none' | 'school' | 'work' | 'both'): FieldTestData => {
  const valueSets = VALUE_SETS;
  // Options: 'Neither', 'School only', 'Work only', 'Both school and work notes'
  const options = valueSets.schoolWorkNoteOptions;

  let selectedValue: string;
  switch (noteType) {
    case 'school':
      selectedValue = options.find((o) => o.value.includes('School'))?.value || 'School only';
      break;
    case 'work':
      selectedValue = options.find((o) => o.value.includes('Work only'))?.value || 'Work only';
      break;
    case 'both':
      selectedValue = options.find((o) => o.value.includes('Both'))?.value || 'Both school and work notes';
      break;
    case 'none':
    default:
      selectedValue = options[0].value; // 'Neither'
      break;
  }

  return {
    valid: {
      'school-work-note-choice': selectedValue,
    },
  };
};

/**
 * Create invite participant data (virtual only)
 */
const createInviteParticipantData = (): FieldTestData => {
  const valueSets = VALUE_SETS;
  // Index 0 = "No, only one device will be connected"
  // Index 1 = "Yes, I will add invite details below"
  const noOption = valueSets.inviteFromAnotherDeviceOptions[0].value;

  return {
    valid: {
      'invite-from-another-device': noOption,
    },
  };
};

/**
 * Create photo ID upload data
 */
const createPhotoIDData = (options?: { includeFront?: boolean; includeBack?: boolean }): FieldTestData => ({
  valid: {
    ...(options?.includeFront !== false && { 'photo-id-front': 'upload' }),
    ...(options?.includeBack !== false && { 'photo-id-back': 'upload' }),
  },
  // No invalid values for file upload
});

/**
 * Create credit card data (Stripe payment)
 *
 * This is a special case that uses Stripe iframe for PCI compliance.
 * The linkId is 'valid-card-on-file' but the value is a structured object
 * that gets handled specially by fillCreditCard().
 */
const createCreditCardData = (overrides?: { number?: string; expiry?: string; cvc?: string }): FieldTestData => ({
  valid: {
    'valid-card-on-file': {
      number: overrides?.number || '4242424242424242', // Stripe test card
      expiry: overrides?.expiry || '12/30',
      cvc: overrides?.cvc || '123',
    },
  },
  // No invalid values - Stripe iframe handles validation
});

/**
 * Create pharmacy data (Places API search)
 *
 * This is a special case that uses autocomplete search backed by Places API.
 * Pass null/undefined to skip pharmacy selection (it's optional).
 */
const createPharmacySearchData = (pharmacyName?: string | null): FieldTestData => ({
  valid: {
    'pharmacy-collection': pharmacyName || 'CVS Pharmacy',
  },
  // Pharmacy is optional, can be skipped by passing null
});

/**
 * Create consent forms data
 *
 * Consent forms page has:
 * - Dynamic checkboxes for each consent form (checked automatically by PagedQuestionnaireFlowHelper)
 * - Signature field
 * - Full name field
 * - Relationship to patient field
 *
 * Note: Consent form checkboxes are NOT included here because they vary by instance.
 * The PagedQuestionnaireFlowHelper.fillPage method automatically checks all consent
 * checkboxes when it detects we're on the consent-forms-page.
 */
const createConsentFormsData = (overrides?: { signerName?: string; relationship?: string }): FieldTestData => {
  const valueSets = VALUE_SETS;
  return {
    valid: {
      // Consent form checkboxes are checked automatically by PagedQuestionnaireFlowHelper
      // Signer information
      signature: overrides?.signerName || 'Test Signer',
      'full-name': overrides?.signerName || 'Test Signer',
      'consent-form-signer-relationship': overrides?.relationship || valueSets.relationshipOptions[0].value,
    },
  };
};

// Map pageLinkId to data template factory
// Keys must match actual questionnaire page linkIds (with -page suffix)
const pageDataTemplateMapFactory: (context?: {
  serviceMode?: 'in-person' | 'virtual';
  visitType?: 'walk-in' | 'prebook';
  serviceCategory?: string;
}) => Record<string, () => FieldTestData> = (context) => {
  // Shared pages (in-person and virtual)
  const maybeServiceMode = context?.serviceMode;
  const maybeVisitType = context?.visitType;
  const maybeServiceCategory = context?.serviceCategory;
  if (context) {
    console.log('test data factory context: ');
    console.log(`  serviceMode: ${maybeServiceMode}`);
    console.log(`  visitType: ${maybeVisitType}`);
    console.log(`  serviceCategory: ${maybeServiceCategory}`);
  } else {
    console.log('test data factory context: none');
  }
  return {
    'contact-information-page': createContactInformationData,
    'patient-details-page': createPatientDetailsData,
    'primary-care-physician-page': createPrimaryCarePhysicianData,
    'pharmacy-page': createPharmacySearchData,
    'payment-option-page': () => createPaymentPageData('insurance'),
    'payment-option-occ-med-page': () => createOccMedPaymentPageData('employer'),
    'card-payment-page': createCreditCardData,
    'responsible-party-page': () => createResponsiblePartyData('not-self'),
    'emergency-contact-page': createEmergencyContactData,
    'employer-information-page': createEmployerInformationData,
    'occupational-medicine-employer-information-page': createOccMedEmployerInformationData,
    'attorney-mva-page': () => ({ valid: {} }), // TODO: create attorney data template
    'photo-id-page': createPhotoIDData,
    'consent-forms-page': createConsentFormsData,
    'medical-history-page': () => createMedicalHistoryData('empty'),

    // Virtual-only pages
    'current-medications-page': () => createCurrentMedicationsData('empty'),
    'allergies-page': () => createCurrentAllergiesData('empty'),
    'surgical-history-page': () => createSurgicalHistoryData('empty'),
    'additional-page': createAdditionalQuestionsData,
    'patient-condition-page': () => ({ valid: {} }), // TODO: create patient condition photo data template
    'school-work-note-page': () => createSchoolWorkNoteData('none'),
    'invite-participant-page': createInviteParticipantData,
  };
};
