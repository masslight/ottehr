import { describe, expect, it } from 'vitest';
import { searchIcd10Codes } from './index';

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
});
