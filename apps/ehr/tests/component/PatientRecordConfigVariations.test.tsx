/**
 * Tests for patient-record configuration variations.
 *
 * Verifies that the PATIENT_RECORD_CONFIG proxy correctly handles:
 * - Default hiddenFormSections
 * - Default sections with items/fields
 * - Window-injected overrides for hiddenFormSections
 * - Window-injected overrides for multiple hidden sections
 * - Adding extra required fields to a section
 * - Hiding specific fields within a visible section
 * - Frozen (immutable) config objects
 */
import { CONFIG_INJECTION_KEYS, PATIENT_RECORD_CONFIG } from 'utils';
import { afterEach, describe, expect, it } from 'vitest';

afterEach(() => {
  delete (window as any)[CONFIG_INJECTION_KEYS.PATIENT_RECORD];
});

describe('Patient record config - default hiddenFormSections', () => {
  it('has hiddenFormSections as an array (possibly empty)', () => {
    const hidden = PATIENT_RECORD_CONFIG.hiddenFormSections;
    expect(Array.isArray(hidden)).toBe(true);
  });

  it('default hiddenFormSections is empty', () => {
    const hidden = PATIENT_RECORD_CONFIG.hiddenFormSections;
    expect(hidden).toEqual([]);
  });
});

describe('Patient record config - default sections with items/fields', () => {
  it('has patientSummary section with items', () => {
    const section = PATIENT_RECORD_CONFIG.FormFields.patientSummary;
    expect(section).toBeDefined();
    expect(section.linkId).toBe('patient-info-section');
    expect(Object.keys(section.items).length).toBeGreaterThan(0);
  });

  it('has patientDetails section with items', () => {
    const section = PATIENT_RECORD_CONFIG.FormFields.patientDetails;
    expect(section).toBeDefined();
    expect(section.linkId).toBe('patient-additional-details-section');
    expect(Object.keys(section.items).length).toBeGreaterThan(0);
  });

  it('has insurance section as an array section', () => {
    const section = PATIENT_RECORD_CONFIG.FormFields.insurance;
    expect(section).toBeDefined();
    expect(Array.isArray(section.linkId)).toBe(true);
  });

  it('has patientContactInformation section with items', () => {
    const section = PATIENT_RECORD_CONFIG.FormFields.patientContactInformation;
    expect(section).toBeDefined();
    expect(section.linkId).toBe('patient-contact-info-section');
    expect(Object.keys(section.items).length).toBeGreaterThan(0);
  });

  it('has all expected form field sections', () => {
    const fields = PATIENT_RECORD_CONFIG.FormFields;
    const expectedSections = [
      'patientSummary',
      'patientDetails',
      'patientContactInformation',
      'insurance',
      'primaryCarePhysician',
      'responsibleParty',
      'emergencyContact',
      'preferredPharmacy',
      'employerInformation',
      'occupationalMedicineEmployerInformation',
      'attorneyInformation',
    ];
    for (const section of expectedSections) {
      expect(fields[section]).toBeDefined();
    }
  });

  it('patientSummary has requiredFields', () => {
    const section = PATIENT_RECORD_CONFIG.FormFields.patientSummary;
    expect(Array.isArray(section.requiredFields)).toBe(true);
    expect(section.requiredFields.length).toBeGreaterThan(0);
    expect(section.requiredFields).toContain('patient-first-name');
    expect(section.requiredFields).toContain('patient-last-name');
    expect(section.requiredFields).toContain('patient-birthdate');
  });
});

describe('Patient record config - override hiddenFormSections with insurance', () => {
  it('overrides hiddenFormSections to hide insurance section', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PATIENT_RECORD] = {
      hiddenFormSections: ['insurance-section'],
    };

    const hidden = PATIENT_RECORD_CONFIG.hiddenFormSections;
    expect(hidden).toEqual(['insurance-section']);
  });

  it('does not affect FormFields when only hiddenFormSections is overridden', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PATIENT_RECORD] = {
      hiddenFormSections: ['insurance-section'],
    };

    const fields = PATIENT_RECORD_CONFIG.FormFields;
    expect(fields.patientSummary).toBeDefined();
    expect(fields.insurance).toBeDefined();
  });
});

describe('Patient record config - override hiddenFormSections with multiple sections', () => {
  it('hides employer and attorney sections', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PATIENT_RECORD] = {
      hiddenFormSections: ['employer-information-page', 'attorney-mva-page'],
    };

    const hidden = PATIENT_RECORD_CONFIG.hiddenFormSections;
    expect(hidden).toEqual(['employer-information-page', 'attorney-mva-page']);
    expect(hidden).toContain('employer-information-page');
    expect(hidden).toContain('attorney-mva-page');
  });

  it('replaces the entire hiddenFormSections array (does not merge with default)', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PATIENT_RECORD] = {
      hiddenFormSections: ['employer-information-page'],
    };

    const hidden = PATIENT_RECORD_CONFIG.hiddenFormSections;
    expect(hidden).toHaveLength(1);
    expect(hidden).toEqual(['employer-information-page']);
  });
});

describe('Patient record config - override adding extra required field to a section', () => {
  it('adds an extra required field to patientSummary', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PATIENT_RECORD] = {
      FormFields: {
        patientSummary: {
          requiredFields: [
            'patient-first-name',
            'patient-last-name',
            'patient-birthdate',
            'patient-birth-sex',
            'patient-middle-name',
          ],
        },
      },
    };

    const section = PATIENT_RECORD_CONFIG.FormFields.patientSummary;
    expect(section.requiredFields).toContain('patient-middle-name');
    expect(section.requiredFields).toContain('patient-first-name');
  });
});

describe('Patient record config - override hiding specific fields within a visible section', () => {
  it('overrides hiddenFields within patientSummary', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PATIENT_RECORD] = {
      FormFields: {
        patientSummary: {
          hiddenFields: ['patient-middle-name', 'patient-name-suffix'],
        },
      },
    };

    const section = PATIENT_RECORD_CONFIG.FormFields.patientSummary;
    expect(section.hiddenFields).toContain('patient-middle-name');
    expect(section.hiddenFields).toContain('patient-name-suffix');
    // Section itself should still be visible with its other properties intact
    expect(section.linkId).toBe('patient-info-section');
    expect(Object.keys(section.items).length).toBeGreaterThan(0);
  });

  it('overrides hiddenFields within patientDetails', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PATIENT_RECORD] = {
      FormFields: {
        patientDetails: {
          hiddenFields: ['patient-ethnicity'],
        },
      },
    };

    const section = PATIENT_RECORD_CONFIG.FormFields.patientDetails;
    expect(section.hiddenFields).toContain('patient-ethnicity');
    expect(section.linkId).toBe('patient-additional-details-section');
  });
});

describe('Patient record config - immutability', () => {
  it('config is frozen (mutation throws)', () => {
    // Inject an override so the config goes through mergeAndFreezeConfigObjects,
    // which deep-freezes the entire result including nested objects and arrays.
    (window as any)[CONFIG_INJECTION_KEYS.PATIENT_RECORD] = {
      hiddenFormSections: ['insurance-section'],
    };

    const formFields = PATIENT_RECORD_CONFIG.FormFields;
    expect(Object.isFrozen(formFields)).toBe(true);

    expect(() => {
      (formFields as any).patientSummary = {};
    }).toThrow();
  });

  it('frozen hiddenFormSections array rejects mutation', () => {
    (window as any)[CONFIG_INJECTION_KEYS.PATIENT_RECORD] = {
      hiddenFormSections: ['insurance-section'],
    };

    const hidden = PATIENT_RECORD_CONFIG.hiddenFormSections;
    expect(Object.isFrozen(hidden)).toBe(true);

    expect(() => {
      (hidden as any).push('something');
    }).toThrow();

    expect(() => {
      (hidden as any)[0] = 'replaced';
    }).toThrow();
  });
});
