import { ActivityDefinition } from 'fhir/r4b';

/**
 * Compare two semver-style version strings.
 *
 * Implementation goals (in priority order):
 *   - Handle the common case of dotted-numeric versions ("1.2.3", "0.10.1").
 *     Numeric segments are compared as numbers so "1.10.0" > "1.9.0".
 *   - A bare release version sorts higher than the same version with a
 *     prerelease suffix ("1.0.0" > "1.0.0-beta").
 *   - Missing segments are treated as zero ("1.0" == "1.0.0").
 *
 * We intentionally don't depend on a full semver library here - the in-house
 * lab ActivityDefinition versions are produced by the admin tooling in this
 * repo and follow the simple X.Y.Z convention.
 */
export const compareSemver = (a: string, b: string): number => {
  const parse = (v: string): { segments: number[]; hasPrerelease: boolean } => {
    const [main, ...preParts] = v.split('-');
    const segments = main
      .split('.')
      .map((s) => Number.parseInt(s, 10))
      .map((n) => (Number.isFinite(n) ? n : 0));
    return { segments, hasPrerelease: preParts.length > 0 };
  };
  const pa = parse(a);
  const pb = parse(b);
  const len = Math.max(pa.segments.length, pb.segments.length);
  for (let i = 0; i < len; i++) {
    const da = pa.segments[i] ?? 0;
    const db = pb.segments[i] ?? 0;
    if (da !== db) return da - db;
  }
  if (pa.hasPrerelease && !pb.hasPrerelease) return -1;
  if (!pa.hasPrerelease && pb.hasPrerelease) return 1;
  return 0;
};

/**
 * Given a list of ActivityDefinitions (typically the result of a search by url),
 * return the one with the highest semver version. ADs without a version field
 * sort below any versioned ones. Returns undefined for an empty input.
 *
 * This is how apply-template and admin-get-template-detail keep global
 * templates working as in-house lab ActivityDefinitions get new versions:
 * templates store only the AD's url (no version), and resolution finds the
 * current AD at apply time.
 */
export const pickLatestActivityDefinition = (ads: ActivityDefinition[]): ActivityDefinition | undefined => {
  if (ads.length === 0) return undefined;
  return ads.reduce<ActivityDefinition | undefined>((latest, candidate) => {
    if (!latest) return candidate;
    const latestVersion = latest.version ?? '';
    const candidateVersion = candidate.version ?? '';
    if (!candidateVersion) return latest;
    if (!latestVersion) return candidate;
    return compareSemver(candidateVersion, latestVersion) > 0 ? candidate : latest;
  }, undefined);
};

/**
 * Group ADs by canonical URL and pick the latest version within each group.
 * Returns a Map keyed by ad.url -> the latest-version AD for that url.
 */
export const indexLatestActivityDefinitionsByUrl = (ads: ActivityDefinition[]): Map<string, ActivityDefinition> => {
  const byUrl = new Map<string, ActivityDefinition[]>();
  for (const ad of ads) {
    if (!ad.url) continue;
    const bucket = byUrl.get(ad.url);
    if (bucket) bucket.push(ad);
    else byUrl.set(ad.url, [ad]);
  }
  const out = new Map<string, ActivityDefinition>();
  for (const [url, bucket] of byUrl) {
    const latest = pickLatestActivityDefinition(bucket);
    if (latest) out.set(url, latest);
  }
  return out;
};

/**
 * A canonical reference saved on a plan ServiceRequest may be either a bare
 * url ("https://...") or include a version ("https://...|1.2.3"). Newer
 * templates save the bare url so resolution can float to the latest AD; older
 * templates may still carry a versioned ref. Either way we look up by the url
 * part - the version segment is ignored.
 */
export const urlFromInstantiatesCanonical = (ref: string): string => ref.split('|')[0];
