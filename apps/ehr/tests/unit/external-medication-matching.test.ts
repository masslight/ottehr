/**
 * Tests for external medication matching logic.
 *
 * The scoreMatch, findBestMatch, and normalizeStrength functions are private
 * to useExternalMedicationHistory. We re-implement the same logic here to
 * verify the matching algorithm in isolation.
 */
import { describe, expect, test } from 'vitest';

// Re-implement the matching functions for testing (same logic as the hook)

function normalizeStrength(strength: string | null | undefined): string {
  if (!strength) return '';
  return strength.toLowerCase().replace(/\s+/g, '');
}

interface SearchResult {
  id: number;
  name: string;
  rxcui: number | null;
  ndc: string | null;
  strength: string;
  isObsolete: boolean;
  routedDoseFormDrugId: number;
}

function scoreMatch(candidate: SearchResult, externalName: string, externalStrength: string | null): number {
  let score = 0;
  const candidateNameLower = candidate.name.toLowerCase();
  const externalNameLower = externalName.toLowerCase();

  if (candidateNameLower === externalNameLower) {
    score += 2;
  } else if (candidateNameLower.includes(externalNameLower) || externalNameLower.includes(candidateNameLower)) {
    score += 1;
  }

  const normExtStrength = normalizeStrength(externalStrength);
  if (normExtStrength) {
    const normCandStrength = normalizeStrength(candidate.strength);
    if (normCandStrength === normExtStrength) {
      score += 2;
    } else if (normCandStrength.includes(normExtStrength) || normExtStrength.includes(normCandStrength)) {
      score += 1;
    }
  }

  return score;
}

function findBestMatch(
  searchResponse: SearchResult[],
  externalName: string,
  externalStrength: string | null,
  externalRxcui: number | null
): { match: SearchResult | null; isExact: boolean } {
  if (searchResponse.length === 0) return { match: null, isExact: false };

  if (externalRxcui != null) {
    const rxcuiMatch = searchResponse.find((med) => med.rxcui === externalRxcui);
    if (rxcuiMatch) {
      return { match: rxcuiMatch, isExact: true };
    }
  }

  let bestCandidate: SearchResult | null = null;
  let bestScore = -1;

  for (const candidate of searchResponse) {
    const score = scoreMatch(candidate, externalName, externalStrength);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  const isExact = externalStrength
    ? bestScore >= 4
    : bestScore >= 2 && bestCandidate?.name.toLowerCase() === externalName.toLowerCase();

  return { match: bestCandidate, isExact };
}

const makeResult = (overrides: Partial<SearchResult> & { name: string }): SearchResult => ({
  id: 1,
  routedDoseFormDrugId: 1,
  rxcui: null,
  ndc: null,
  strength: '',
  isObsolete: false,
  ...overrides,
});

// ── normalizeStrength ────────────────────────────────────────────────────────

describe('normalizeStrength', () => {
  test('lowercases and strips whitespace', () => {
    expect(normalizeStrength('500 MG')).toBe('500mg');
    expect(normalizeStrength('20 mg')).toBe('20mg');
    expect(normalizeStrength('0.3-0.1 %')).toBe('0.3-0.1%');
  });

  test('returns empty string for null/undefined', () => {
    expect(normalizeStrength(null)).toBe('');
    expect(normalizeStrength(undefined)).toBe('');
    expect(normalizeStrength('')).toBe('');
  });
});

// ── scoreMatch ───────────────────────────────────────────────────────────────

describe('scoreMatch', () => {
  test('exact name match scores 2', () => {
    const candidate = makeResult({ name: 'Omeprazole' });
    expect(scoreMatch(candidate, 'Omeprazole', null)).toBe(2);
  });

  test('exact name match is case-insensitive', () => {
    const candidate = makeResult({ name: 'omeprazole' });
    expect(scoreMatch(candidate, 'Omeprazole', null)).toBe(2);
  });

  test('substring name match scores 1', () => {
    const candidate = makeResult({ name: 'Omeprazole Magnesium Oral Capsule' });
    expect(scoreMatch(candidate, 'Omeprazole', null)).toBe(1);
  });

  test('reverse substring name match scores 1', () => {
    const candidate = makeResult({ name: 'Omeprazole' });
    expect(scoreMatch(candidate, 'Omeprazole Magnesium Oral Capsule', null)).toBe(1);
  });

  test('no name match scores 0', () => {
    const candidate = makeResult({ name: 'Ibuprofen' });
    expect(scoreMatch(candidate, 'Omeprazole', null)).toBe(0);
  });

  test('exact name + exact strength scores 4', () => {
    const candidate = makeResult({ name: 'Omeprazole', strength: '20 mg' });
    expect(scoreMatch(candidate, 'Omeprazole', '20 mg')).toBe(4);
  });

  test('exact name + substring strength scores 3', () => {
    const candidate = makeResult({ name: 'Omeprazole', strength: '20 MG Capsule' });
    expect(scoreMatch(candidate, 'Omeprazole', '20 mg')).toBe(3);
  });

  test('strength normalization handles whitespace differences', () => {
    const candidate = makeResult({ name: 'Metformin', strength: '500MG' });
    expect(scoreMatch(candidate, 'Metformin', '500 mg')).toBe(4);
  });

  test('null external strength skips strength scoring', () => {
    const candidate = makeResult({ name: 'Omeprazole', strength: '20 mg' });
    expect(scoreMatch(candidate, 'Omeprazole', null)).toBe(2);
  });
});

// ── findBestMatch ────────────────────────────────────────────────────────────

describe('findBestMatch', () => {
  test('returns null for empty search results', () => {
    const result = findBestMatch([], 'Omeprazole', '20 mg', null);
    expect(result.match).toBeNull();
    expect(result.isExact).toBe(false);
  });

  test('rxcui match takes priority over name match', () => {
    const results = [
      makeResult({ id: 1, name: 'Wrong Name', rxcui: 12345 }),
      makeResult({ id: 2, name: 'Omeprazole', rxcui: 99999 }),
    ];
    const result = findBestMatch(results, 'Omeprazole', '20 mg', 12345);
    expect(result.match?.id).toBe(1);
    expect(result.isExact).toBe(true);
  });

  test('falls back to name match when rxcui not found', () => {
    const results = [makeResult({ id: 1, name: 'Omeprazole', strength: '20 mg', rxcui: 99999 })];
    const result = findBestMatch(results, 'Omeprazole', '20 mg', 12345);
    expect(result.match?.id).toBe(1);
    expect(result.isExact).toBe(true); // name + strength exact
  });

  test('falls back to name match when rxcui is null', () => {
    const results = [makeResult({ id: 1, name: 'Omeprazole', strength: '20 mg' })];
    const result = findBestMatch(results, 'Omeprazole', '20 mg', null);
    expect(result.match?.id).toBe(1);
    expect(result.isExact).toBe(true);
  });

  test('exact match with name only (no strength)', () => {
    const results = [makeResult({ id: 1, name: 'Acetaminophen' })];
    const result = findBestMatch(results, 'Acetaminophen', null, null);
    expect(result.match?.id).toBe(1);
    expect(result.isExact).toBe(true);
  });

  test('inexact match when name is substring only', () => {
    const results = [makeResult({ id: 1, name: 'Acetaminophen Extra Strength Tablet' })];
    const result = findBestMatch(results, 'Acetaminophen', null, null);
    expect(result.match?.id).toBe(1);
    expect(result.isExact).toBe(false); // substring, not exact name
  });

  test('inexact match when strength partially matches', () => {
    const results = [makeResult({ id: 1, name: 'Omeprazole', strength: '40 mg' })];
    const result = findBestMatch(results, 'Omeprazole', '20 mg', null);
    expect(result.match?.id).toBe(1);
    expect(result.isExact).toBe(false); // name exact but strength doesn't match
  });

  test('selects best candidate from multiple results', () => {
    const results = [
      makeResult({ id: 1, name: 'Metformin HCl', strength: '1000 mg' }),
      makeResult({ id: 2, name: 'MetFORMIN', strength: '500 mg' }),
      makeResult({ id: 3, name: 'Metformin Extended Release', strength: '500 mg' }),
    ];
    const result = findBestMatch(results, 'MetFORMIN', '500 mg', null);
    expect(result.match?.id).toBe(2); // exact name + exact strength
    expect(result.isExact).toBe(true);
  });

  test('no match at all returns best candidate as inexact', () => {
    const results = [makeResult({ id: 1, name: 'Completely Different Drug' })];
    const result = findBestMatch(results, 'Omeprazole', '20 mg', null);
    expect(result.match?.id).toBe(1); // still returns best (only) candidate
    expect(result.isExact).toBe(false);
  });
});

// ── Chart filtering logic ────────────────────────────────────────────────────

describe('chart medication filtering', () => {
  // Re-implement the filtering logic from the hook
  function filterChartedMedications(externalNames: string[], chartedNames: string[]): string[] {
    const chartedLower = chartedNames.map((n) => n.toLowerCase().trim());
    return externalNames.filter((name) => {
      const lower = name.toLowerCase().trim();
      return !chartedLower.some((charted) => charted.includes(lower) || lower.includes(charted));
    });
  }

  test('filters exact name matches', () => {
    const result = filterChartedMedications(['Omeprazole', 'Metformin'], ['Omeprazole']);
    expect(result).toEqual(['Metformin']);
  });

  test('filters when charted name contains external name', () => {
    const result = filterChartedMedications(
      ['Omeprazole'],
      ['Omeprazole Magnesium Oral Capsule Delayed Release (20.6 (20 Base) MG)']
    );
    expect(result).toEqual([]);
  });

  test('filters when external name contains charted name', () => {
    const result = filterChartedMedications(['Omeprazole Magnesium'], ['Omeprazole']);
    expect(result).toEqual([]);
  });

  test('case-insensitive matching', () => {
    const result = filterChartedMedications(['omeprazole'], ['OMEPRAZOLE']);
    expect(result).toEqual([]);
  });

  test('does not filter unrelated medications', () => {
    const result = filterChartedMedications(['Omeprazole', 'Metformin', 'Lisinopril'], ['Atorvastatin']);
    expect(result).toEqual(['Omeprazole', 'Metformin', 'Lisinopril']);
  });

  test('empty charted list returns all external meds', () => {
    const result = filterChartedMedications(['Omeprazole', 'Metformin'], []);
    expect(result).toEqual(['Omeprazole', 'Metformin']);
  });
});
