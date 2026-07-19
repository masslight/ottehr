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

describe('icd-10-search ranking (clinical-default + region synonyms + head word)', () => {
  const top = async (q: string): Promise<string> => (await searchIcd10Codes(q))[0]?.code ?? '(none)';

  it('picks the base/unspecified code for bare disease names', async () => {
    expect(await top('gout')).toBe('M10.9');
    expect(await top('migraine')).toBe('G43.909');
    expect(await top('headache')).toBe('R51.9');
  });

  it('resolves Latin region qualifiers via synonyms (cervical→neck, lumbar→lower back)', async () => {
    expect(await top('cervical strain')).toBe('S16.1XXA');
    expect(await top('lumbar strain')).toBe('S39.012A');
  });

  it('matches common names for Latin-only displays (hives→urticaria)', async () => {
    expect(await top('hives')).toBe('L50.9');
  });

  it('prefers the unspecified-side default over a lateralized sibling for side-less queries', async () => {
    // "bilateral" has a shorter display than "unspecified ear" and used to win on brevity.
    expect(await top('otitis media')).toBe('H66.90');
  });

  it('resolves trunk sites via synonyms (coccyx/tailbone→lower back, bruise→contusion)', async () => {
    // Without the synonym, "coccyx" matched no contusion display and the tie went to the
    // document-order-first contusion code — a HEAD-block (ear) code for a tailbone injury.
    expect(await top('contusion of coccyx')).toBe('S30.0XXA');
    expect(await top('tailbone bruise')).toBe('S30.0XXA');
  });

  it('prefers the head-word disease over a qualifier-only match', async () => {
    // "cervical strain" must resolve to a STRAIN, never a same-region different disease
    // (the old ranking picked M40.202 kyphosis because only "cervical" matched).
    const results = await searchIcd10Codes('cervical strain');
    expect(results[0].display.toLowerCase()).toContain('strain');
  });

  it('ranks initial encounter above subsequent/sequela for acute-visit searches', async () => {
    const results = await searchIcd10Codes('neck strain');
    const codes = results.map((c) => c.code);
    expect(codes.indexOf('S16.1XXA')).toBeLessThan(codes.indexOf('S16.1XXD'));
    expect(codes.indexOf('S16.1XXA')).toBeLessThan(codes.indexOf('S16.1XXS'));
  });
});

// Body-part phrasing: ICD-10 files limb abscesses under "lower limb", never "thigh" — without the
// synonym the tendon-sheath code (M65.051, literal "thigh") outranked the cutaneous abscess.
import { searchIcd10Codes as search2 } from '../src/shared/icd-10-search';
describe('icd-10 body-part phrasing', () => {
  it('cutaneous abscess of right thigh → L02.415 (cutaneous, right lower limb), not tendon sheath', async () => {
    const res = await search2('cutaneous abscess of right thigh');
    expect(res[0].code).toBe('L02.415');
  });
});
