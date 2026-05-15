import { ActivityDefinition } from 'fhir/r4b';
import { describe, expect, test } from 'vitest';
import {
  compareSemver,
  indexLatestActivityDefinitionsByUrl,
  pickLatestActivityDefinition,
  urlFromInstantiatesCanonical,
} from '../../src/shared/in-house-lab/resolve-activity-definition';

const ad = (overrides: Partial<ActivityDefinition>): ActivityDefinition => ({
  resourceType: 'ActivityDefinition',
  status: 'active',
  ...overrides,
});

describe('compareSemver', () => {
  test('compares dotted-numeric versions numerically (not lexicographically)', () => {
    expect(compareSemver('1.10.0', '1.9.0')).toBeGreaterThan(0);
    expect(compareSemver('1.9.0', '1.10.0')).toBeLessThan(0);
    expect(compareSemver('2.0.0', '1.99.99')).toBeGreaterThan(0);
  });

  test('treats missing trailing segments as zero', () => {
    expect(compareSemver('1.0', '1.0.0')).toBe(0);
    expect(compareSemver('1.0.0', '1')).toBe(0);
  });

  test('a release version outranks the same version with a prerelease suffix', () => {
    expect(compareSemver('1.0.0', '1.0.0-beta')).toBeGreaterThan(0);
    expect(compareSemver('1.0.0-beta', '1.0.0')).toBeLessThan(0);
  });

  test('returns zero for equal versions', () => {
    expect(compareSemver('1.2.3', '1.2.3')).toBe(0);
  });

  test("non-numeric segments are treated as zero so they don't break ordering", () => {
    // Defensive: malformed input should not throw and should still produce a sensible answer.
    expect(compareSemver('1.x.0', '1.0.0')).toBe(0);
    expect(compareSemver('foo', 'bar')).toBe(0);
  });
});

describe('pickLatestActivityDefinition', () => {
  test('returns undefined for an empty input', () => {
    expect(pickLatestActivityDefinition([])).toBeUndefined();
  });

  test("returns the only AD when there's just one", () => {
    const only = ad({ id: 'one', url: 'https://example.com/a', version: '1.0.0' });
    expect(pickLatestActivityDefinition([only])).toBe(only);
  });

  test('returns the highest-semver AD when several share the same url', () => {
    const v1 = ad({ id: 'v1', url: 'https://example.com/a', version: '1.0.0' });
    const v2 = ad({ id: 'v2', url: 'https://example.com/a', version: '1.10.0' });
    const v3 = ad({ id: 'v3', url: 'https://example.com/a', version: '1.9.5' });
    expect(pickLatestActivityDefinition([v1, v2, v3])).toBe(v2);
    // Order-independent.
    expect(pickLatestActivityDefinition([v3, v1, v2])).toBe(v2);
  });

  test('prefers a versioned AD over one without a version field', () => {
    const versioned = ad({ id: 'v', url: 'https://example.com/a', version: '0.1.0' });
    const versionless = ad({ id: 'nv', url: 'https://example.com/a' });
    expect(pickLatestActivityDefinition([versioned, versionless])).toBe(versioned);
    expect(pickLatestActivityDefinition([versionless, versioned])).toBe(versioned);
  });
});

describe('indexLatestActivityDefinitionsByUrl', () => {
  test('groups ADs by url and stores only the latest version under each key', () => {
    const a1 = ad({ id: 'a1', url: 'https://example.com/a', version: '1.0.0' });
    const a2 = ad({ id: 'a2', url: 'https://example.com/a', version: '2.0.0' });
    const b1 = ad({ id: 'b1', url: 'https://example.com/b', version: '0.5.0' });
    const result = indexLatestActivityDefinitionsByUrl([a1, a2, b1]);
    expect(result.size).toBe(2);
    expect(result.get('https://example.com/a')).toBe(a2);
    expect(result.get('https://example.com/b')).toBe(b1);
  });

  test('ignores ADs with no url field', () => {
    const noUrl = ad({ id: 'noUrl', version: '1.0.0' });
    const withUrl = ad({ id: 'withUrl', url: 'https://example.com/x', version: '1.0.0' });
    const result = indexLatestActivityDefinitionsByUrl([noUrl, withUrl]);
    expect(result.size).toBe(1);
    expect(result.get('https://example.com/x')).toBe(withUrl);
  });
});

describe('urlFromInstantiatesCanonical', () => {
  test("returns the bare url when there's no version suffix", () => {
    expect(urlFromInstantiatesCanonical('https://example.com/a')).toBe('https://example.com/a');
  });

  test('strips the |version suffix from a versioned canonical', () => {
    expect(urlFromInstantiatesCanonical('https://example.com/a|1.2.3')).toBe('https://example.com/a');
  });
});
