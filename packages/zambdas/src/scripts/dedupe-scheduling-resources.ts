import { default as Oystehr } from '@oystehr/sdk';
import { FhirResource, PractitionerRole, Schedule } from 'fhir/r4b';
import { SLUG_SYSTEM } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { createOystehrClientFromConfig, performEffectWithEnvFile } from './helpers';

/**
 * TRANSITIONAL cleanup tool for the self-service-locations migration.
 *
 * That migration moved Locations + their Schedules and the group-scheduling graph
 * out of Terraform (removed from state via `removed{}`, seeded at runtime instead).
 * While the migration is in flight against SHARED state, an un-migrated `terraform
 * apply` (a branch that still declares these resources) will find them in config but
 * not in state and re-create them. The Oystehr provider's create is a plain
 * unconditional POST — no conditional-create/upsert — so it produces DUPLICATES that
 * share a slug. Booking resolves owners by slug, so slug collisions cause ambiguous
 * lookups.
 *
 * This finds slug-collision duplicates among the runtime-seeded anchor types
 * (Location, HealthcareService, Practitioner), KEEPS THE OLDEST of each slug, and
 * deletes the newer copies plus their orphaned Schedules/PractitionerRoles. As a hard
 * safety guard it never deletes an anchor that has real Appointments.
 *
 * Dry-run by default; pass `--apply` to actually delete:
 *   npm run dedupe-scheduling-resources -- <env>            # report only
 *   npm run dedupe-scheduling-resources -- <env> --apply    # delete
 *
 * OBSOLETE once every environment is past the migration — delete this script then.
 */
const ANCHOR_TYPES = ['Location', 'HealthcareService', 'Practitioner'] as const;
type AnchorType = (typeof ANCHOR_TYPES)[number];

const APPLY = process.argv.includes('--apply');

const slugOf = (resource: FhirResource): string | undefined =>
  (resource as { identifier?: { system?: string; value?: string }[] }).identifier?.find(
    (id) => id.system === SLUG_SYSTEM
  )?.value;

const updatedAt = (resource: FhirResource): number => {
  const iso = resource.meta?.lastUpdated;
  return iso ? Date.parse(iso) : 0;
};

// A candidate anchor is safe to delete only if nothing real points at it — no
// Appointment names it as an actor. Freshly re-created duplicates never do; anything
// that does is not a throwaway duplicate and is kept for manual review.
const hasAppointments = async (oystehr: Oystehr, type: AnchorType, id: string): Promise<boolean> => {
  const found = await oystehr.fhir.search({
    resourceType: 'Appointment',
    params: [
      { name: 'actor', value: `${type}/${id}` },
      { name: '_summary', value: 'count' },
    ],
  });
  return (found.total ?? 0) > 0;
};

const referencesAny = (references: (string | undefined)[], deleted: Set<string>): boolean =>
  references.some((ref) => ref !== undefined && deleted.has(ref));

const deleteInOrder = async (oystehr: Oystehr, refs: string[]): Promise<void> => {
  for (const ref of refs) {
    const [resourceType, id] = ref.split('/');
    try {
      await oystehr.fhir.delete({ resourceType: resourceType as any, id });
      console.log(`  deleted ${ref}`);
    } catch (err) {
      console.error(`  FAILED to delete ${ref}:`, err);
    }
  }
};

const dedupeSchedulingResources = async (oystehr: Oystehr): Promise<void> => {
  // Refs ("Type/id") of duplicate anchors slated for deletion, and the human-readable plan.
  const deletedAnchorRefs = new Set<string>();
  const anchorDeletions: string[] = [];
  const kept: string[] = [];

  // 1. Dedupe slug-bearing anchors: keep the oldest per slug, queue newer duplicates.
  for (const type of ANCHOR_TYPES) {
    const all = await getAllFhirSearchPages<FhirResource>({ resourceType: type }, oystehr);
    const bySlug = new Map<string, FhirResource[]>();
    for (const resource of all) {
      const slug = slugOf(resource);
      if (!slug) continue;
      const list = bySlug.get(slug);
      if (list) list.push(resource);
      else bySlug.set(slug, [resource]);
    }

    for (const [slug, group] of bySlug) {
      if (group.length < 2) continue;
      const sorted = [...group].sort((a, b) => updatedAt(a) - updatedAt(b));
      const keeper = sorted[0];
      kept.push(`${type}/${keeper.id} (slug "${slug}", oldest of ${group.length})`);
      for (const candidate of sorted.slice(1)) {
        const ref = `${type}/${candidate.id}`;
        if (await hasAppointments(oystehr, type, candidate.id!)) {
          console.warn(`  KEPT ${ref} (slug "${slug}") — has Appointments; review manually.`);
          continue;
        }
        deletedAnchorRefs.add(ref);
        anchorDeletions.push(`${ref} (duplicate slug "${slug}", keeping ${type}/${keeper.id})`);
      }
    }
  }

  // 2. Sweep dependents that belong to a deleted duplicate anchor.
  //    PractitionerRoles first (a duplicate Schedule may be actored on a duplicate PR).
  const deletedRefs = new Set<string>(deletedAnchorRefs);
  const roleRefs: string[] = [];
  const roles = await getAllFhirSearchPages<PractitionerRole>({ resourceType: 'PractitionerRole' }, oystehr);
  for (const role of roles) {
    const refs = [
      role.practitioner?.reference,
      ...(role.healthcareService ?? []).map((r) => r.reference),
      ...(role.location ?? []).map((r) => r.reference),
    ];
    if (referencesAny(refs, deletedAnchorRefs)) {
      const ref = `PractitionerRole/${role.id}`;
      roleRefs.push(ref);
      deletedRefs.add(ref);
    }
  }

  const scheduleRefs: string[] = [];
  const schedules = await getAllFhirSearchPages<Schedule>({ resourceType: 'Schedule' }, oystehr);
  for (const schedule of schedules) {
    const refs = (schedule.actor ?? []).map((a) => a.reference);
    if (referencesAny(refs, deletedRefs)) {
      scheduleRefs.push(`Schedule/${schedule.id}`);
    }
  }

  // 3. Report, then (with --apply) delete in dependency order: Schedules → PRs → anchors.
  const total = scheduleRefs.length + roleRefs.length + anchorDeletions.length;
  console.log(`\n=== dedupe-scheduling-resources (${APPLY ? 'APPLY' : 'DRY-RUN'}) ===`);
  if (kept.length) console.log(`Keepers:\n  ${kept.join('\n  ')}`);
  if (total === 0) {
    console.log('No slug-collision duplicates found. Nothing to do.');
    return;
  }
  console.log(`\nWould delete ${total} resource(s):`);
  [...scheduleRefs, ...roleRefs, ...anchorDeletions].forEach((line) => console.log(`  ${line}`));

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with `--apply` to delete.');
    return;
  }

  console.log('\nDeleting...');
  await deleteInOrder(oystehr, scheduleRefs);
  await deleteInOrder(oystehr, roleRefs);
  await deleteInOrder(oystehr, [...deletedAnchorRefs]);
  console.log('Done.');
};

const main = async (): Promise<void> => {
  await performEffectWithEnvFile(async (config) => {
    const oystehr = await createOystehrClientFromConfig(config);
    await dedupeSchedulingResources(oystehr);
  });
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
