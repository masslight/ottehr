import { describe, expect, it } from 'vitest';
import { convertFhirNameToDisplayName } from './convertFhirNameToDisplayName';

describe('convertFhirNameToDisplayName', () => {
  it('should return full name string', () => {
    const full = convertFhirNameToDisplayName({ family: 'John', given: ['Gait'] });
    expect(full).toEqual('John, Gait');
  });
});
