import { HumanName } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { convertFhirNameToDisplayName } from './convertFhirNameToDisplayName';

describe('convertFhirNameToDisplayName', () => {
  it('should format as "LastName, FirstName"', () => {
    const name: HumanName = { family: 'Smith', given: ['John'] };
    expect(convertFhirNameToDisplayName(name)).toBe('Smith, John');
  });

  it('should join multiple given names with spaces', () => {
    const name: HumanName = { family: 'Doe', given: ['Jane', 'Marie'] };
    expect(convertFhirNameToDisplayName(name)).toBe('Doe, Jane Marie');
  });

  it('should handle missing given names', () => {
    const name: HumanName = { family: 'Smith' };
    expect(convertFhirNameToDisplayName(name)).toBe('Smith, undefined');
  });

  it('should handle empty given names array', () => {
    const name: HumanName = { family: 'Smith', given: [] };
    expect(convertFhirNameToDisplayName(name)).toBe('Smith, ');
  });
});
