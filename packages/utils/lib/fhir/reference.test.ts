import { describe, expect, it } from 'vitest';
import { getIdFromReference } from './reference';

describe('getIdFromReference', () => {
  it('returns the id of a literal reference', () => {
    expect(getIdFromReference('Claim/c1')).toBe('c1');
  });

  it('returns the id of a versioned reference', () => {
    expect(getIdFromReference('Claim/c1/_history/2')).toBe('c1');
  });

  it('returns the id when the reference has the expected type', () => {
    expect(getIdFromReference('Claim/c1', 'Claim')).toBe('c1');
  });

  it.each([
    ['a reference of another type', 'Coverage/cov1'],
    ['a contained reference', '#request'],
    ['a urn reference', 'urn:uuid:9f0c'],
    ['an empty reference', ''],
    ['a missing reference', undefined],
  ])('returns undefined for %s', (_name, reference) => {
    expect(getIdFromReference(reference, 'Claim')).toBeUndefined();
  });
});
