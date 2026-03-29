import { describe, expect, it } from 'vitest';
import { mapDispositionTypeToLabel } from './disposition';
import { ottehrCodeSystemUrl, ottehrExtensionUrl, ottehrIdentifierSystem, ottehrValueSetUrl } from './systemUrls';

describe('systemUrls', () => {
  it('ottehrCodeSystemUrl should build CodeSystem URL', () => {
    expect(ottehrCodeSystemUrl('visit-status')).toBe('https://fhir.ottehr.com/CodeSystem/visit-status');
  });

  it('ottehrValueSetUrl should build ValueSet URL', () => {
    expect(ottehrValueSetUrl('service-category')).toBe('https://fhir.ottehr.com/ValueSet/service-category');
  });

  it('ottehrExtensionUrl should build Extension URL', () => {
    expect(ottehrExtensionUrl('payment-variant')).toBe('https://fhir.ottehr.com/Extension/payment-variant');
  });

  it('ottehrIdentifierSystem should build Identifier URL', () => {
    expect(ottehrIdentifierSystem('patient-mrn')).toBe('https://fhir.ottehr.com/Identifier/patient-mrn');
  });
});

describe('disposition', () => {
  it('should map all disposition types to labels', () => {
    expect(mapDispositionTypeToLabel['ip']).toBe('Ottehr IP Transfer');
    expect(mapDispositionTypeToLabel['ed']).toBe('ED Transfer');
    expect(mapDispositionTypeToLabel['pcp']).toBe('Primary Care Physician');
    expect(mapDispositionTypeToLabel['pcp-no-type']).toBe('Primary Care Physician');
    expect(mapDispositionTypeToLabel['another']).toBe('Transfer to Another Location');
    expect(mapDispositionTypeToLabel['specialty']).toBe('Specialty Transfer');
  });
});
