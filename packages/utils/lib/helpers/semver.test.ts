import { describe, expect, it } from 'vitest';
import { bumpKind, compareSemver, isSemver } from './semver';

describe('isSemver', () => {
  it('accepts major.minor.patch', () => {
    expect(isSemver('1.0.0')).toBe(true);
    expect(isSemver('1.0.12')).toBe(true);
    expect(isSemver('10.20.30')).toBe(true);
  });

  it('rejects non-semver strings and non-strings', () => {
    expect(isSemver('1.0')).toBe(false);
    expect(isSemver('1.0.0.0')).toBe(false);
    expect(isSemver('1.0.0-beta')).toBe(false);
    expect(isSemver('v1.0.0')).toBe(false);
    expect(isSemver('')).toBe(false);
    expect(isSemver(undefined)).toBe(false);
    expect(isSemver(100)).toBe(false);
  });
});

describe('compareSemver', () => {
  it('orders by major, then minor, then patch', () => {
    expect(compareSemver('2.0.0', '1.9.9')).toBeGreaterThan(0);
    expect(compareSemver('1.2.0', '1.1.9')).toBeGreaterThan(0);
    expect(compareSemver('1.1.2', '1.1.1')).toBeGreaterThan(0);
    expect(compareSemver('1.1.1', '1.1.2')).toBeLessThan(0);
    expect(compareSemver('1.1.1', '1.1.1')).toBe(0);
  });

  it('throws on invalid input', () => {
    expect(() => compareSemver('1.0', '1.0.0')).toThrow();
  });
});

describe('bumpKind', () => {
  it('classifies strict increases', () => {
    expect(bumpKind('1.2.3', '2.0.0')).toBe('major');
    expect(bumpKind('1.2.3', '1.3.0')).toBe('minor');
    expect(bumpKind('1.2.3', '1.2.4')).toBe('patch');
  });

  it('returns null for equal, lower, or invalid versions', () => {
    expect(bumpKind('1.2.3', '1.2.3')).toBeNull();
    expect(bumpKind('1.2.3', '1.2.2')).toBeNull();
    expect(bumpKind('1.2.3', '1.1.9')).toBeNull();
    expect(bumpKind('1.2.3', 'nope')).toBeNull();
    expect(bumpKind('bad', '1.2.4')).toBeNull();
  });
});
