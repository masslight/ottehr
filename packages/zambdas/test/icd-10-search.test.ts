import { describe, expect, it } from 'vitest';
import { searchIcd10Codes } from '../src/shared/icd-10-search';

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

  it('should handle W21.89 codes correctly with X padding', async () => {
    // Test the bug: W21.89A should NOT be recognized (missing X padding)
    const resultsInvalidCode = await searchIcd10Codes('W21.89A');
    expect(resultsInvalidCode.length).toBe(0);

    // Test the correct code: W21.89XA should be recognized (with X padding)
    const resultsValidCode = await searchIcd10Codes('W21.89XA');
    expect(resultsValidCode.length).toBe(1);
    expect(resultsValidCode[0].code).toBe('W21.89XA');
    expect(resultsValidCode[0].display).toContain('Striking against or struck by other sports equipment');

    // Test that all W21.89 variants have proper X padding
    const allW2189Results = await searchIcd10Codes('W21.89');
    const w2189Codes = allW2189Results.filter((code) => code.code.startsWith('W21.89'));

    // Should have multiple variants with different seventh characters (A, D, S)
    expect(w2189Codes.length).toBeGreaterThan(1);

    // All should have X in the seventh position and an eighth character
    w2189Codes.forEach((code) => {
      expect(code.code.length).toBe(8); // W21.89X + one character = 8 total
      expect(code.code.charAt(6)).toBe('X'); // Seventh character should be X (padding)
      expect(code.code.charAt(7)).toMatch(/[ADS]/); // Eighth character should be A, D, or S
    });
  });

  it('should handle ICD-10 padding correctly for different code lengths', async () => {
    // Test 5-character code (should get XX padding + 7th char = 8 chars total)
    const w214Results = await searchIcd10Codes('W21.4');
    const w214Codes = w214Results.filter((code) => code.code.startsWith('W21.4') && code.code.length > 5);
    expect(w214Codes.length).toBeGreaterThan(0);
    w214Codes.forEach((code) => {
      expect(code.code.length).toBe(8); // W21.4XX + one character = 8 total
      expect(code.code.substring(5, 7)).toBe('XX'); // Should have XX padding
      expect(code.code.charAt(7)).toMatch(/[ADS]/); // Eighth character should be A, D, or S
    });

    // Test 6-character code (should get X padding + 7th char = 8 chars total)
    const w2189Results = await searchIcd10Codes('W21.89');
    const w2189Codes = w2189Results.filter((code) => code.code.startsWith('W21.89') && code.code.length > 6);
    expect(w2189Codes.length).toBeGreaterThan(0);
    w2189Codes.forEach((code) => {
      expect(code.code.length).toBe(8); // W21.89X + one character = 8 total
      expect(code.code.charAt(6)).toBe('X'); // Should have X padding
      expect(code.code.charAt(7)).toMatch(/[ADS]/); // Eighth character should be A, D, or S
    });
  });
});
