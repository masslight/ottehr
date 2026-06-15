import Oystehr from '@oystehr/sdk';
import { HealthcareService, PractitionerRole } from 'fhir/r4b';
import { getPractitionerRoleAllCategories, isServiceCategoryHealthcareService } from 'utils';

export interface PractitionerRoleConflict {
  /**
   * Id of the conflicting active PractitionerRole — the resource the new/
   * updated PR overlaps with. Not a Schedule id; callers needing the Schedule
   * should look it up by actor.
   */
  conflictingPractitionerRoleId: string;
  /**
   * Names of the categories that overlap between the two PRs, for the error
   * message. The contents depend on which sides have the all-categories
   * toggle:
   *   - both sides toggled: `['All services']` (overlap is conceptually
   *     "every category" with no concrete IDs to enumerate)
   *   - only the *other* PR toggled: `['All services']` (same reasoning —
   *     the candidate's specific cats are all swallowed by the other's "any")
   *   - only the candidate toggled: the other PR's concrete category names
   *     (these are the cats the candidate's "any" overlaps with)
   *   - neither toggled: the concrete intersection of the two cat lists
   */
  conflictingCategoryNames: string[];
}

/**
 * A provider may have multiple PR-actored schedules, but each (practitioner,
 * location, category) tuple should appear in at most one active PR. Two PRs
 * for the same provider at the same location offering the same category
 * produce duplicate-looking slots, near-duplicate admin rows, and arbitrary
 * stamping at booking time. We reject the configuration up front rather than
 * tolerating it.
 *
 * Returns null if no conflict exists. Otherwise returns the first conflicting
 * PR's id and the category names that overlap, so the admin can be told
 * exactly which schedule to reconcile against.
 *
 * Pass the candidate's id when validating an UPDATE so we don't flag the PR
 * against itself; omit (or pass undefined) when validating a CREATE.
 *
 * Handles the explicit `allCategories` toggle on both sides of the comparison:
 *   - candidate.allCategories=true overlaps any other PR that offers anything
 *     (specific cats OR the toggle).
 *   - other.allCategories=true overlaps any candidate that offers anything.
 *   - both falsy + empty arrays → no conflict possible.
 *
 * `PractitionerRole.healthcareService[]` may also carry non-service-category
 * refs (e.g., group-membership HSes). Only refs that resolve to
 * service-category HealthcareServices count toward overlap — otherwise a PR
 * that offers no real categories but happens to be in a group would
 * incorrectly block an allCategories PR at the same location. We resolve
 * referenced HSes inline via `_include` and discriminate with
 * `isServiceCategoryHealthcareService`.
 */
export async function checkPractitionerRoleConflict(
  oystehr: Oystehr,
  candidate: {
    id?: string;
    practitionerRef: string;
    locationRef: string;
    categoryHsIds: string[];
    allCategories?: boolean;
  },
  options: {
    /** Map of HealthcareService id → display name, for the error message. */
    categoryNameById?: Map<string, string>;
  } = {}
): Promise<PractitionerRoleConflict | null> {
  // Candidate that offers nothing can't conflict with anyone.
  if (!candidate.allCategories && candidate.categoryHsIds.length === 0) return null;

  // Active PRs for this practitioner, with their HealthcareServices included
  // inline so we can discriminate category-HSes from group/other refs in the
  // same round-trip. Cheap query — most providers have single-digit PR counts.
  // Inactive (soft-deleted) PRs aren't candidates.
  const bundle = await oystehr.fhir.search<PractitionerRole | HealthcareService>({
    resourceType: 'PractitionerRole',
    params: [
      { name: 'practitioner', value: candidate.practitionerRef },
      { name: 'active', value: 'true' },
      { name: '_include', value: 'PractitionerRole:service' },
    ],
  });
  const resources = bundle.unbundle();

  // Split the mixed bundle and build a category-HS id set + a name map for
  // error-message resolution. Only HSes that actually pass the category
  // classifier go in; non-category refs (groups, etc.) are excluded so they
  // can't drive conflict logic. Pre-seeded names from the caller win when the
  // included HS lacks a display name.
  const others: PractitionerRole[] = [];
  const categoryHsIds = new Set<string>();
  const nameById = new Map<string, string>(options.categoryNameById ?? []);
  for (const r of resources) {
    if (r.resourceType === 'PractitionerRole') {
      if (r.id !== candidate.id) others.push(r);
    } else if (r.resourceType === 'HealthcareService' && isServiceCategoryHealthcareService(r)) {
      if (r.id) {
        categoryHsIds.add(r.id);
        if (!nameById.has(r.id)) nameById.set(r.id, r.name ?? r.id);
      }
    }
  }

  // Candidate IDs the caller passed might include non-category refs (e.g.,
  // group-membership refs), particularly on UPDATE where they may be sourced
  // from the existing PR's full `healthcareService[]`. Classify any that
  // weren't picked up via `_include` so the overlap logic below doesn't
  // false-positive — most importantly, in the otherAllCategories branch where
  // a non-empty candidate set returns a conflict without further checks.
  // Membership in `categoryHsIds` is the authoritative "is a category"
  // signal; `nameById` may include caller-seeded display names for IDs
  // we haven't actually classified yet, so don't gate on it.
  const unclassifiedCandidateIds = candidate.categoryHsIds.filter((id) => !categoryHsIds.has(id));
  if (unclassifiedCandidateIds.length > 0) {
    const candidateBundle = await oystehr.fhir.search<HealthcareService>({
      resourceType: 'HealthcareService',
      params: [{ name: '_id', value: unclassifiedCandidateIds.join(',') }],
    });
    for (const hs of candidateBundle.unbundle()) {
      if (!hs.id) continue;
      if (isServiceCategoryHealthcareService(hs)) {
        categoryHsIds.add(hs.id);
        if (!nameById.has(hs.id)) nameById.set(hs.id, hs.name ?? hs.id);
      }
    }
  }

  const filteredCandidateCategoryIds = candidate.categoryHsIds.filter((id) => categoryHsIds.has(id));
  // Re-apply the "offers nothing" early-out after filtering — a candidate
  // whose only refs were group memberships truly offers no categories.
  if (!candidate.allCategories && filteredCandidateCategoryIds.length === 0) return null;
  const candidateCategorySet = new Set(filteredCandidateCategoryIds);

  for (const other of others) {
    const otherLocation = other.location?.[0]?.reference;
    if (otherLocation !== candidate.locationRef) continue;

    const otherAllCategories = getPractitionerRoleAllCategories(other);
    const otherCategoryIds = (other.healthcareService ?? [])
      .map((ref) => ref.reference?.split('/')[1])
      .filter((id): id is string => !!id && categoryHsIds.has(id));

    // Other offers nothing → can't conflict with whatever candidate offers.
    if (!otherAllCategories && otherCategoryIds.length === 0) continue;

    // Compute the overlap. Three "any" combinations short-circuit; the
    // fall-through is the specific-vs-specific intersection.
    let conflictingNames: string[];
    if (candidate.allCategories && otherAllCategories) {
      conflictingNames = ['All services'];
    } else if (candidate.allCategories) {
      conflictingNames = otherCategoryIds.map((id) => nameById.get(id) ?? id);
    } else if (otherAllCategories) {
      conflictingNames = ['All services'];
    } else {
      const overlapping = otherCategoryIds.filter((id) => candidateCategorySet.has(id));
      if (overlapping.length === 0) continue;
      conflictingNames = overlapping.map((id) => nameById.get(id) ?? id);
    }

    return {
      conflictingPractitionerRoleId: other.id ?? '',
      conflictingCategoryNames: conflictingNames,
    };
  }
  return null;
}
