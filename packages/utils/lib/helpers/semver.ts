/**
 * Minimal semantic-version helpers for the `major.minor.patch` convention Ottehr uses for
 * canonical Questionnaire versions (e.g. '1.0.12'). Kept dependency-free so it can run in both the
 * browser (admin portal import validation) and zambdas (server-side re-validation). This is not a
 * full semver implementation — pre-release/build metadata is intentionally not supported, matching
 * how versions are minted across the codebase.
 */

const SEMVER_REGEX = /^\d+\.\d+\.\d+$/;

export type SemverBumpKind = 'major' | 'minor' | 'patch';

/** True when `version` is a strict `major.minor.patch` string of non-negative integers. */
export function isSemver(version: unknown): version is string {
  return typeof version === 'string' && SEMVER_REGEX.test(version);
}

/**
 * Compares two `major.minor.patch` strings.
 * Returns a positive number when `a > b`, negative when `a < b`, and 0 when equal.
 * Throws if either argument is not a valid semver string.
 */
export function compareSemver(a: string, b: string): number {
  if (!isSemver(a) || !isSemver(b)) {
    throw new Error(`compareSemver requires major.minor.patch strings, received "${a}" and "${b}"`);
  }
  const [aMajor, aMinor, aPatch] = a.split('.').map(Number);
  const [bMajor, bMinor, bPatch] = b.split('.').map(Number);

  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return aPatch - bPatch;
}

/**
 * Classifies how `next` bumps `current`. Returns the bump kind for a strict single-or-multi field
 * increase (any version strictly greater than `current`), or `null` when `next` is not valid semver,
 * `current` is not valid semver, or `next` is not strictly greater than `current`.
 */
export function bumpKind(current: string, next: string): SemverBumpKind | null {
  if (!isSemver(current) || !isSemver(next)) return null;
  if (compareSemver(next, current) <= 0) return null;

  const [curMajor, curMinor] = current.split('.').map(Number);
  const [nextMajor, nextMinor] = next.split('.').map(Number);

  if (nextMajor !== curMajor) return 'major';
  if (nextMinor !== curMinor) return 'minor';
  return 'patch';
}
