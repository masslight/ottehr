import { Extension, Organization } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { EMPLOYER_NOTES_EXTENSION_URL, getEmployerNotes } from './organization';

const employerWithExtensions = (...extension: Extension[]): Organization => ({
  resourceType: 'Organization',
  extension,
});

describe('getEmployerNotes', () => {
  it('returns the notes recorded on the employer', () => {
    const employer = employerWithExtensions(
      { url: 'https://extensions.ottehr.com/fhir/StructureDefinition/other', valueString: 'unrelated' },
      { url: EMPLOYER_NOTES_EXTENSION_URL, valueString: 'Send results to HR only' }
    );

    expect(getEmployerNotes(employer)).toBe('Send results to HR only');
  });

  it('returns undefined when the employer has no notes', () => {
    expect(getEmployerNotes(employerWithExtensions({ url: EMPLOYER_NOTES_EXTENSION_URL, valueString: '' }))).toBe(
      undefined
    );
    expect(getEmployerNotes(employerWithExtensions())).toBe(undefined);
    expect(getEmployerNotes({ resourceType: 'Organization' })).toBe(undefined);
    expect(getEmployerNotes(undefined)).toBe(undefined);
  });
});
