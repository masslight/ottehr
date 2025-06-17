import { describe, expect, it } from 'vitest';
import { convertFhirNameToDisplayName } from './convertFhirNameToDisplayName';

describe('convertFhirNameToDisplayName', () => {
  it('should return full name string', () => {
    const full = convertFhirNameToDisplayName({ family: 'John', given: ['Galt'] });
    expect(full).toEqual('John, Galt');
  });
});
