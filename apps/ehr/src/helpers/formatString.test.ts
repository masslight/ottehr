import { describe, expect, it } from 'vitest';
import { addSpacesAfterCommas } from './formatString';

describe('addSpacesAfterCommas', () => {
  it('should add spaces after commas where they are missing', () => {
    expect(addSpacesAfterCommas('Fever,Vomiting and/or diarrhea')).toBe('Fever, Vomiting and/or diarrhea');
  });

  it('should not add extra spaces if they already exist', () => {
    expect(addSpacesAfterCommas('Fever, Vomiting, and/or diarrhea')).toBe('Fever, Vomiting, and/or diarrhea');
  });

  it('should handle multiple consecutive commas', () => {
    expect(addSpacesAfterCommas('One,Two,,Three,Four')).toBe('One, Two, , Three, Four');
  });

  it('should handle commas at the end of the string', () => {
    expect(addSpacesAfterCommas('One,Two,Three,')).toBe('One, Two, Three,');
  });

  it('should return the same string if there are no commas', () => {
    expect(addSpacesAfterCommas('No commas here')).toBe('No commas here');
  });

  it('should handle empty strings', () => {
    expect(addSpacesAfterCommas('')).toBe('');
  });

  it('should handle strings with only commas', () => {
    expect(addSpacesAfterCommas(',,,,')).toBe(', , , ,');
  });

  it('should preserve existing whitespace', () => {
    expect(addSpacesAfterCommas('One,  Two,Three')).toBe('One,  Two, Three');
  });
});
