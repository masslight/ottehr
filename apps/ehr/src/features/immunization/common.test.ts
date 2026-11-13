import { RelatedPerson } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { formatPaperworkEmergencyContact, formatRecordedEmergencyContact } from './common';

const paperworkContact = (overrides: Partial<RelatedPerson> = {}): RelatedPerson => ({
  resourceType: 'RelatedPerson',
  patient: { reference: 'Patient/patient-1' },
  relationship: [
    { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v2-0131', code: 'EP', display: 'Parent' }] },
  ],
  name: [{ given: ['Martin', 'James'], family: 'Black' }],
  telecom: [{ system: 'phone', value: '+11234567890' }],
  ...overrides,
});

describe('formatPaperworkEmergencyContact', () => {
  it('shows relationship, full name and phone from the paperwork contact', () => {
    expect(formatPaperworkEmergencyContact(paperworkContact())).toBe('Parent | Martin James Black | (123) 456-7890');
  });

  it('skips the parts the paperwork did not collect', () => {
    expect(formatPaperworkEmergencyContact(paperworkContact({ relationship: undefined, telecom: undefined }))).toBe(
      'Martin James Black'
    );
  });

  it('ignores a phone number that is no longer in use', () => {
    expect(
      formatPaperworkEmergencyContact(
        paperworkContact({ telecom: [{ system: 'phone', value: '1234567890', period: { end: '2026-01-01' } }] })
      )
    ).toBe('Parent | Martin James Black');
  });

  it('returns nothing when the patient has no emergency contact', () => {
    expect(formatPaperworkEmergencyContact(undefined)).toBeUndefined();
    expect(
      formatPaperworkEmergencyContact(paperworkContact({ relationship: [], name: [], telecom: [] }))
    ).toBeUndefined();
  });
});

describe('formatRecordedEmergencyContact', () => {
  it('shows the contact recorded on an administered order with the relationship label', () => {
    expect(
      formatRecordedEmergencyContact({ relationship: 'legal-guardian', fullName: 'John Doe', mobile: '2027139680' })
    ).toBe('Legal Guardian | John Doe | (202) 713-9680');
  });

  it('returns nothing when no contact was recorded', () => {
    expect(formatRecordedEmergencyContact(undefined)).toBeUndefined();
    expect(formatRecordedEmergencyContact({ relationship: '', fullName: '', mobile: '' })).toBeUndefined();
  });
});
