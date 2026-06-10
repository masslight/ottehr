import Oystehr from '@oystehr/sdk';
import { HealthcareService, PractitionerRole } from 'fhir/r4b';
import { getPractitionerRoleAllCategories } from 'utils';

export interface PractitionerRoleConflict {
  conflictingScheduleId: string;
  /**
   * Names of the categories that overlap between the two PRs, for the error
   * message. When either side has the all-categories toggle on, the overlap
   * is conceptually "every category," and this list is the special-cased
   * `['All services']` rather than a concrete category list.
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

  // Active PRs for this practitioner. Cheap query — most providers have
  // single-digit PR counts. Inactive (soft-deleted) PRs aren't candidates.
  const bundle = await oystehr.fhir.search<PractitionerRole>({
    resourceType: 'PractitionerRole',
    params: [
      { name: 'practitioner', value: candidate.practitionerRef },
      { name: 'active', value: 'true' },
    ],
  });
  const others = bundle.unbundle().filter((pr) => pr.id !== candidate.id);

  const candidateCategorySet = new Set(candidate.categoryHsIds);

  for (const other of others) {
    const otherLocation = other.location?.[0]?.reference;
    if (otherLocation !== candidate.locationRef) continue;

    const otherAllCategories = getPractitionerRoleAllCategories(other);
    const otherCategoryIds = (other.healthcareService ?? [])
      .map((ref) => ref.reference?.split('/')[1])
      .filter((id): id is string => !!id);

    // Other offers nothing → can't conflict with whatever candidate offers.
    if (!otherAllCategories && otherCategoryIds.length === 0) continue;

    // Compute the overlap. Three "any" combinations short-circuit; the
    // fall-through is the specific-vs-specific intersection. The set of
    // category IDs that need display names depends on which branch fires.
    let conflictingIds: string[] | null = null;
    let conflictingNames: string[];
    if (candidate.allCategories && otherAllCategories) {
      conflictingNames = ['All services'];
    } else if (candidate.allCategories) {
      // Candidate's "any" overlaps every concrete category other has. Names
      // for these IDs likely aren't in the caller's map (the caller only
      // knows about the candidate's own cat IDs), so we'll resolve them
      // below if not already present.
      conflictingIds = otherCategoryIds;
      conflictingNames = [];
    } else if (otherAllCategories) {
      conflictingNames = ['All services'];
    } else {
      const overlapping = otherCategoryIds.filter((id) => candidateCategorySet.has(id));
      if (overlapping.length === 0) continue;
      conflictingIds = overlapping;
      conflictingNames = [];
    }

    if (conflictingIds) {
      const missingIds = conflictingIds.filter((id) => !options.categoryNameById?.has(id));
      const nameById = new Map(options.categoryNameById ?? []);
      if (missingIds.length > 0) {
        const hsBundle = await oystehr.fhir.search<HealthcareService>({
          resourceType: 'HealthcareService',
          params: [{ name: '_id', value: missingIds.join(',') }],
        });
        for (const hs of hsBundle.unbundle()) {
          if (hs.id) nameById.set(hs.id, hs.name ?? hs.id);
        }
      }
      conflictingNames = conflictingIds.map((id) => nameById.get(id) ?? id);
    }

    return {
      conflictingScheduleId: other.id ?? '',
      conflictingCategoryNames: conflictingNames,
    };
  }
  return null;
}
