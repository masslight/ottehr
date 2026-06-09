import Oystehr from '@oystehr/sdk';
import { PractitionerRole } from 'fhir/r4b';

export interface PractitionerRoleConflict {
  conflictingScheduleId: string;
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
 */
export async function checkPractitionerRoleConflict(
  oystehr: Oystehr,
  candidate: {
    id?: string;
    practitionerRef: string;
    locationRef: string;
    categoryHsIds: string[];
  },
  options: {
    /** Map of HealthcareService id → display name, for the error message. */
    categoryNameById?: Map<string, string>;
  } = {}
): Promise<PractitionerRoleConflict | null> {
  if (candidate.categoryHsIds.length === 0) return null;

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

    const otherCategoryIds = (other.healthcareService ?? [])
      .map((ref) => ref.reference?.split('/')[1])
      .filter((id): id is string => !!id);
    const overlapping = otherCategoryIds.filter((id) => candidateCategorySet.has(id));
    if (overlapping.length === 0) continue;

    return {
      conflictingScheduleId: other.id ?? '',
      conflictingCategoryNames: overlapping.map((id) => options.categoryNameById?.get(id) ?? id),
    };
  }
  return null;
}
