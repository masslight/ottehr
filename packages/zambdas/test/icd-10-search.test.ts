import { describe, expect, it } from 'vitest';
import { searchIcd10Codes } from '../src/ehr/icd-10-search/index';

describe('icd-10-search tests', () => {
  it('should find J06 codes correctly', async () => {
    const results = await searchIcd10Codes('J06');

    // Should return results
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);

    // All results should have the required structure
    results.forEach((code) => {
      expect(code).toHaveProperty('code');
      expect(code).toHaveProperty('display');
      expect(typeof code.code).toBe('string');
      expect(typeof code.display).toBe('string');
      expect(code.code.length).toBeGreaterThan(0);
      expect(code.display.length).toBeGreaterThan(0);
    });

    // Should find codes that start with J06
    const j06Codes = results.filter((code) => code.code.startsWith('J06'));
    expect(j06Codes.length).toBeGreaterThan(0);

    const j060 = results.find((code) => code.code === 'J06.0');
    expect(j060).toBeDefined();
    expect(j060?.display).toContain('Acute laryngopharyngitis');

    const j069 = results.find((code) => code.code === 'J06.9');
    expect(j069).toBeDefined();
    expect(j069?.display).toContain('Acute upper respiratory infection, unspecified');
  });

  it('should find exactly J06.9 code correctly', async () => {
    const results = await searchIcd10Codes('J06.9');

    // Should return results
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(1);

    const j069 = results.find((code) => code.code === 'J06.9');
    expect(j069).toBeDefined();
    expect(j069?.display).toContain('Acute upper respiratory infection, unspecified');
  });

  it('should find exactly J06.9 in first place when searching on "respiratory infection"', async () => {
    const results = await searchIcd10Codes('respiratory infection');

    // Should return results
    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(1);

    const j069 = results[0];
    expect(j069).toBeDefined();
    expect(j069?.display).toContain('Acute upper respiratory infection, unspecified');
    expect(j069?.code).toBe('J06.9');
  });

  it('should handle seventh character codes correctly', async () => {
    const results = await searchIcd10Codes('S82.821');

    // S82.821 should NOT be returned (not billable by itself)
    expect(results.some((code) => code.code === 'S82.821')).toBe(false);

    // S82.821A (with seventh character) SHOULD be returned
    expect(results.some((code) => code.code === 'S82.821A')).toBe(true);

    // Should have multiple variants with different seventh characters
    const s82821Codes = results.filter((code) => code.code.startsWith('S82.821'));
    expect(s82821Codes.length).toBeGreaterThan(1);

    // Check that all variants have seventh characters
    s82821Codes.forEach((code) => {
      expect(code.code.length).toBe(8); // S82.821 + one character = 8 total
      expect(code.code.charAt(7)).toMatch(/[A-Z]/); // Seventh character should be a letter
    });
  });
});
