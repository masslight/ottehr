import type { ErxSearchMedicationsResponse } from '@oystehr/sdk';
import type { ExtractObjectType } from '../stores/appointment/appointment.queries';

type SearchResult = ExtractObjectType<ErxSearchMedicationsResponse>;

/**
 * Normalize a strength string for comparison by stripping whitespace and lowercasing.
 * e.g. "500 mg" → "500mg", "20 MG" → "20mg"
 */
export function normalizeStrength(strength: string | null | undefined): string {
  if (!strength) return '';
  return strength.toLowerCase().replace(/\s+/g, '');
}

/**
 * Score a search result against the external medication's name and strength.
 * Higher score = better match. Name is weighted more heavily than strength
 * since correctly identifying the medication is more important than matching dose.
 *   +4 = exact name match
 *   +2 = name is a substring match (external name appears in search result name or vice versa)
 *   +2 = exact strength match
 *   +1 = strength appears somewhere in the search result's strength or name
 */
export function scoreMatch(candidate: SearchResult, externalName: string, externalStrength: string | null): number {
  let score = 0;
  const candidateNameLower = candidate.name.toLowerCase();
  const externalNameLower = externalName.toLowerCase();

  // Name scoring (weighted higher)
  if (candidateNameLower === externalNameLower) {
    score += 4;
  } else if (candidateNameLower.includes(externalNameLower) || externalNameLower.includes(candidateNameLower)) {
    score += 2;
  }

  // Strength scoring
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

/**
 * Find the best matching medication from search results.
 * Priority order:
 *   1. rxcui match — strongest exact match if the external med has an rxcui
 *   2. Name + strength scoring — falls back to fuzzy matching
 */
export function findBestMatch(
  searchResponse: ErxSearchMedicationsResponse,
  externalName: string,
  externalStrength: string | null,
  externalRxcui: number | null
): { match: SearchResult | null; isExact: boolean } {
  if (searchResponse.length === 0) return { match: null, isExact: false };

  // Step 1: Try rxcui match first — this is the strongest identifier match
  if (externalRxcui != null) {
    const rxcuiMatch = searchResponse.find((med) => med.rxcui === externalRxcui);
    if (rxcuiMatch) {
      return { match: rxcuiMatch, isExact: true };
    }
  }

  // Step 2: Fall back to name + strength scoring
  let bestCandidate: SearchResult | null = null;
  let bestScore = -1;

  for (const candidate of searchResponse) {
    const score = scoreMatch(candidate, externalName, externalStrength);
    if (score > bestScore) {
      bestScore = score;
      bestCandidate = candidate;
    }
  }

  // Exact match = name exact (4) + strength exact (2) = 6, or name exact (4) with no strength to match
  const isExact = externalStrength
    ? bestScore >= 6
    : bestScore >= 4 && bestCandidate?.name.toLowerCase() === externalName.toLowerCase();

  return { match: bestCandidate, isExact };
}
