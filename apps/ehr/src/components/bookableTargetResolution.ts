import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import {
  getGroupAllLocations,
  isBookingConfigServiceCategoryCode,
  isPractitionerRoleMemberOfGroup,
  practitionerRoleOffersCategory,
  SCHEDULE_DISPLAY_NAME_EXTENSION_URL,
  ScheduleType,
  SERVICE_CATEGORY_SYSTEM,
} from 'utils';

/**
 * Per-Location aggregation of every bookable surface that operates at that
 * Location. Three sources:
 *   - `ownSchedules` — Schedules actored directly by the Location.
 *   - `groupsHere` — HealthcareService Groups whose `location[]` includes the
 *     Location (the Group is offered AT this Location).
 *   - `prsHere` — PractitionerRoles whose `location[]` includes the Location,
 *     paired with their PR-actored Schedules. PRs without a Schedule are
 *     dropped; only Schedules can be booked against.
 *
 * Built once at picker-load time; the per-category resolver below walks
 * these inventories. Pure data — no callbacks, no FHIR I/O.
 */
export interface LocationBookableInventory {
  location: Location;
  ownSchedules: Schedule[];
  groupsHere: HealthcareService[];
  prsHere: Array<{ pr: PractitionerRole; practitioner?: Practitioner; schedules: Schedule[] }>;
}

/**
 * One concrete bookable target the picker can present. A resolved target
 * always names a single backend bookable resource (a Location, a
 * HealthcareService, or a PractitionerRole) — never a synthetic aggregate.
 * Selection of this target sets the form's `selectedBookable` and the
 * downstream slot loader keys off `resourceType` + `id` exactly as today.
 *
 * `baseName` is the Location display name ("NY — New York"); `typeSuffix`
 * disambiguates among multiple targets at the same Location (e.g.,
 * "Acupuncture Group" or "Dr. Smith"). The picker concatenates them only
 * when multiple targets at one Location need disambiguating.
 */
export interface ResolvedBookableTarget {
  resourceType: 'Location' | 'HealthcareService' | 'PractitionerRole';
  id: string;
  slug: string;
  baseName: string;
  typeSuffix?: string;
  walkinSchedule?: Schedule;
  schedules?: Schedule[];
  rawLocation?: Location;
  /**
   * Coarse priority of the surface type — 0 (Location) < 1 (Group) < 2
   * (PR-direct). Resolver returns only the targets at the lowest-priority
   * (most-preferred) tier that has any matches, so the picker either renders
   * one option (silent pick) or several sub-options at the same tier.
   */
  tier: 0 | 1 | 2;
}

interface ResolverFilter {
  serviceCategoryCode?: string;
  /**
   * FHIR HealthcareService id for the picked service category, when the
   * category is FHIR-backed (admin-managed). Required for FHIR categories
   * because the PR-side opt-in lives on `role.healthcareService[]` as a
   * FHIR reference — there's no other way to ask "does this PR offer the
   * picked category". BOOKING_CONFIG categories aren't FHIR-backed and so
   * have no id; the resolver detects them via `isBookingConfigServiceCategoryCode`
   * and uses the legacy Location-Schedule-only path with empty-codings
   * back-compat. Pass undefined for BOOKING_CONFIG categories.
   */
  serviceCategoryFhirId?: string;
}

/**
 * Whether a Schedule's `serviceCategory[]` admits the requested category
 * code. The admit rule differs by category source:
 *
 *   - BOOKING_CONFIG categories: empty codings (after filtering out
 *     foreign-system entries) count as "supports all" — the legacy
 *     contract for system categories that pre-dates explicit tagging.
 *   - FHIR-backed categories: codings must explicitly include the code.
 *     No back-compat: an untagged Location-Schedule does NOT offer a
 *     FHIR-managed service. A customer must opt the Schedule into the
 *     category by tagging it (or expose the service via a Group/PR at
 *     the Location instead).
 *
 * Schedule.serviceCategory is a multi-purpose slot — service-mode markers
 * and other foreign-system codings can sit alongside category codings.
 * Only SERVICE_CATEGORY_SYSTEM codings count toward the category-presence
 * check; everything else is metadata that mustn't pollute the rule.
 */
export const scheduleSupportsCategory = (sched: Schedule, code: string, isBookingConfig: boolean): boolean => {
  const codes = (sched.serviceCategory ?? [])
    .flatMap((cc) => cc.coding ?? [])
    .filter((c) => c.system === SERVICE_CATEGORY_SYSTEM)
    .map((c) => c.code)
    .filter((c): c is string => !!c);
  if (isBookingConfig) return codes.length === 0 || codes.includes(code);
  return codes.includes(code);
};

/**
 * Whether the Location itself (via its own Schedule(s)) offers the
 * requested category. With no Schedules attached, the BOOKING_CONFIG path
 * admits as "no restriction" (preserves pre-fix behavior); the FHIR path
 * rejects because a Location with no Schedule cannot vend FHIR-managed
 * services either — the resolver should fall through to the Group/PR
 * tiers for that case.
 *
 * `code === undefined` skips the category filter entirely — used when the
 * caller wants to surface every Location that has at least one Schedule.
 */
const locationSelfSupports = (
  inv: LocationBookableInventory,
  code: string | undefined,
  isBookingConfig: boolean
): boolean => {
  if (!code) return inv.ownSchedules.length > 0;
  if (isBookingConfig && inv.ownSchedules.length === 0) return true;
  return inv.ownSchedules.some((s) => scheduleSupportsCategory(s, code, isBookingConfig));
};

/**
 * Whether the Group's own `HealthcareService.type[]` allow-list admits the
 * requested category code. Mirrors the identical gate in the
 * `get-schedule` zambda (`packages/zambdas/src/patient/get-schedule/index.ts`,
 * "For group bookings, the group's type[] is the authoritative allow-list
 * of categories patients can book through it"). If we admit a Group here
 * whose type[] excludes the code, `get-schedule` will 400 with
 * `CATEGORY_NOT_SUPPORTED_BY_GROUP` and the picker + slot flow will
 * silently show no slots.
 *
 * Empty type[] → supports all (back-compat with Groups that never
 * configured an allow-list). Populated → strict membership required.
 */
const groupTypeAllowsCategory = (group: HealthcareService, code: string): boolean => {
  const codes = (group.type ?? [])
    .flatMap((t) => t.coding ?? [])
    .map((c) => c.code)
    .filter((c): c is string => !!c);
  return codes.length === 0 || codes.includes(code);
};

/**
 * Whether a Group offers the requested FHIR category at the inventory's
 * Location. Only relevant for FHIR-backed categories — Groups are not a
 * surface for BOOKING_CONFIG categories per the codebase invariant (see
 * isBookingConfigServiceCategoryCode docblock: a Slot stamped with a
 * BOOKING_CONFIG code must live on a Location-actored Schedule, never a
 * Group/PR-actored one).
 *
 * Two gates, ANDed:
 *   1. Group's own `type[]` allow-list must admit the code — same rule the
 *      get-schedule zambda enforces. Skipping this gate produces silent
 *      "no slots" for Groups whose type[] filters the category out.
 *   2. At least one PR at L must be a member of the Group AND opt into the
 *      category via `practitionerRoleOffersCategory` — same rule
 *      get-schedule uses when filtering the member Schedule list. Without
 *      this, we'd admit Groups whose members can't actually vend the
 *      category, producing empty slot lists further downstream.
 */
const groupSupportsFhirCategory = (
  group: HealthcareService,
  inv: LocationBookableInventory,
  fhirId: string,
  code: string
): boolean => {
  if (!groupTypeAllowsCategory(group, code)) return false;
  // Read the Group's all-locations toggle off its characteristics — same
  // as walkGroupMemberPractitionerRoleSchedules and every other caller of
  // isPractitionerRoleMemberOfGroup. Hardcoding false would silently drop
  // Groups whose membership is intentionally "all active PRs system-wide"
  // (typical anonymous-mode pooling config), producing empty pickers in
  // production even though the Group can vend the category.
  const allLocationsFlag = getGroupAllLocations(group) === true;
  return inv.prsHere.some(({ pr, schedules }) => {
    if (schedules.length === 0) return false;
    const isMember = isPractitionerRoleMemberOfGroup({
      role: pr,
      group,
      allLocationsFlag,
    });
    if (!isMember) return false;
    return practitionerRoleOffersCategory(pr, fhirId);
  });
};

/**
 * Whether a PractitionerRole offers the requested FHIR category. Same
 * authoritative `practitionerRoleOffersCategory` check used everywhere
 * else in the codebase, plus a precondition that the PR has at least one
 * Schedule (no bookable surface otherwise).
 *
 * Not used for BOOKING_CONFIG categories — same invariant as above:
 * PR-Schedules don't carry BOOKING_CONFIG codings.
 */
const prSupportsFhirCategory = (pr: PractitionerRole, schedules: Schedule[], fhirId: string): boolean => {
  if (schedules.length === 0) return false;
  return practitionerRoleOffersCategory(pr, fhirId);
};

/**
 * Returns the Location display name used by the picker — state-prefixed
 * when the Location carries an address state, plain name otherwise. Lives
 * here so the resolver's outputs already carry the user-visible name and
 * the picker doesn't need to redo the format.
 */
export const formatLocationDisplayName = (loc: Location): string =>
  loc.address?.state
    ? `${loc.address.state.toUpperCase()} — ${loc.name ?? 'Unnamed'}`
    : (loc.name ?? 'Unnamed location');

const formatHumanName = (p?: Practitioner): string => {
  if (!p?.name?.[0]) return 'Unknown provider';
  const n = p.name[0];
  const parts = [n.prefix?.[0], n.given?.join(' '), n.family].filter(Boolean);
  return parts.join(' ') || 'Unknown provider';
};

const groupSuffix = (group: HealthcareService): string => group.name ?? 'Unnamed group';

const prSuffix = (pr: PractitionerRole, practitioner?: Practitioner): string => {
  const providerName = formatHumanName(practitioner);
  const explicitName = (pr.extension ?? []).find((e) => e.url === SCHEDULE_DISPLAY_NAME_EXTENSION_URL)?.valueString;
  return explicitName?.trim() ? `${providerName}: ${explicitName.trim()}` : providerName;
};

/**
 * Resolve the bookable targets that should appear under a Location in the
 * picker, given an active category filter. Priority order — first
 * non-empty tier wins, all targets at that tier are returned:
 *   1. Location-Schedule (the "plainest" booking surface).
 *   2. Groups at L that fulfill the category (anonymous-mode aggregation).
 *   3. PR-Schedules at L (provider-direct).
 *
 * Multiple targets at the winning tier surface as sub-options in the
 * picker; a single match silently resolves to that target. Returns [] when
 * no target at any tier supports the category — the picker drops the
 * Location entirely.
 */
export const resolveTargetsAtLocation = (
  inv: LocationBookableInventory,
  filter: ResolverFilter
): ResolvedBookableTarget[] => {
  const baseName = formatLocationDisplayName(inv.location);
  if (!inv.location.id) return [];
  const code = filter.serviceCategoryCode;
  // BOOKING_CONFIG codes can't be referenced from PR.healthcareService[]
  // (no FHIR id exists) and per invariant don't appear on PR/Group
  // Schedules; FHIR-backed codes require strict opt-in via
  // practitionerRoleOffersCategory across tiers. Branch up front so the
  // tier checks below pick the right admit rule.
  const isBookingConfig = !code || isBookingConfigServiceCategoryCode(code);
  const fhirId = filter.serviceCategoryFhirId;

  // Tier 1: Location-Schedule. Applies to both BOOKING_CONFIG and FHIR
  // categories — the Location's own Schedule can be tagged for either
  // source. The admit rule inside `locationSelfSupports` is what differs
  // (empty-codings supports-all for BOOKING_CONFIG, strict membership for
  // FHIR). The Location is its own bookable target; it's a single entry
  // even with multiple Schedules — the slot loader handles which Schedule
  // gets used.
  if (locationSelfSupports(inv, code, isBookingConfig)) {
    return [
      {
        resourceType: 'Location',
        id: inv.location.id,
        slug: '',
        baseName,
        walkinSchedule: inv.ownSchedules[0],
        schedules: inv.ownSchedules,
        rawLocation: inv.location,
        tier: 0,
      },
    ];
  }

  // Tiers 2 (Group) and 3 (PR) apply only to FHIR-backed categories. For
  // BOOKING_CONFIG categories, falling off Tier 1 means the Location can't
  // serve the picked category through any surface — drop it entirely.
  if (isBookingConfig || !code || !fhirId) return [];

  // Tier 2: Groups at L. A Group qualifies iff (a) its type[] allows the
  // category (matching get-schedule's allow-list gate) AND (b) some member
  // PR at this Location offers the FHIR category via
  // practitionerRoleOffersCategory. Multiple matching Groups surface as
  // sub-options under the Location.
  const matchingGroups = inv.groupsHere.filter((g) => groupSupportsFhirCategory(g, inv, fhirId, code));
  if (matchingGroups.length > 0) {
    return matchingGroups
      .filter((g): g is HealthcareService & { id: string } => !!g.id)
      .map((g) => ({
        resourceType: 'HealthcareService' as const,
        id: g.id,
        slug: '',
        baseName,
        typeSuffix: groupSuffix(g),
        tier: 1 as const,
      }));
  }

  // Tier 3: PR-direct. PR is admitted only when it explicitly offers the
  // category (per practitionerRoleOffersCategory) AND has at least one
  // Schedule. PR-Schedule.serviceCategory codings are NOT consulted here
  // — the per-PR opt-in lives on `role.healthcareService[]`, not on the
  // Schedule itself.
  const matchingPRTargets = inv.prsHere.flatMap(({ pr, practitioner, schedules }) => {
    if (!pr.id) return [];
    if (!prSupportsFhirCategory(pr, schedules, fhirId)) return [];
    return [
      {
        resourceType: 'PractitionerRole' as const,
        id: pr.id,
        slug: '',
        baseName,
        typeSuffix: prSuffix(pr, practitioner),
        schedules,
        tier: 2 as const,
      },
    ];
  });
  return matchingPRTargets;
};

/**
 * Build one inventory per Location from the flat resource sets the picker
 * already loads. Pure — does the bucketing in O(N+M+P) by stashing index
 * maps. Locations with no inventory entries at all still appear (the
 * resolver handles the no-Schedules back-compat case).
 *
 * Caller passes:
 *   - `locations` — every Location to consider
 *   - `schedules` — every Schedule from the Location-revinclude query +
 *      every Schedule from the PR-revinclude query (the function
 *      partitions by actor type)
 *   - `groups` — every Group HealthcareService to consider
 *   - `prs` — every PractitionerRole to consider
 *   - `practitionersById` — Practitioner resources keyed by id, for PR
 *     display names
 */
export const buildLocationInventories = (input: {
  locations: Location[];
  schedules: Schedule[];
  groups: HealthcareService[];
  prs: PractitionerRole[];
  practitionersById: Map<string, Practitioner>;
}): LocationBookableInventory[] => {
  const { locations, schedules, groups, prs, practitionersById } = input;

  // Index Schedules by actor: Location-actored vs PR-actored. A Schedule
  // can only have one actor here — we look at actor[0] (matches the
  // patient-side resolver's assumption).
  const locationSchedulesByLocationId = new Map<string, Schedule[]>();
  const prSchedulesByPrId = new Map<string, Schedule[]>();
  for (const sched of schedules) {
    const actorRef = sched.actor?.[0]?.reference ?? '';
    const [actorType, actorId] = actorRef.split('/');
    if (!actorId) continue;
    if (actorType === 'Location') {
      const list = locationSchedulesByLocationId.get(actorId) ?? [];
      list.push(sched);
      locationSchedulesByLocationId.set(actorId, list);
    } else if (actorType === 'PractitionerRole') {
      const list = prSchedulesByPrId.get(actorId) ?? [];
      list.push(sched);
      prSchedulesByPrId.set(actorId, list);
    }
  }

  // Bucket Groups + PRs by the Locations they reference. A Group/PR with
  // N location refs appears in N buckets — same intentional shape as the
  // location-overlap membership rule in isPractitionerRoleMemberOfGroup.
  const groupsByLocationId = new Map<string, HealthcareService[]>();
  for (const g of groups) {
    for (const ref of g.location ?? []) {
      const id = ref.reference?.startsWith('Location/') ? ref.reference.slice('Location/'.length) : undefined;
      if (!id) continue;
      const list = groupsByLocationId.get(id) ?? [];
      list.push(g);
      groupsByLocationId.set(id, list);
    }
  }

  const prsByLocationId = new Map<string, PractitionerRole[]>();
  for (const pr of prs) {
    for (const ref of pr.location ?? []) {
      const id = ref.reference?.startsWith('Location/') ? ref.reference.slice('Location/'.length) : undefined;
      if (!id) continue;
      const list = prsByLocationId.get(id) ?? [];
      list.push(pr);
      prsByLocationId.set(id, list);
    }
  }

  return locations
    .filter((loc): loc is Location & { id: string } => !!loc.id)
    .map((loc) => {
      const ownSchedules = locationSchedulesByLocationId.get(loc.id) ?? [];
      const groupsHere = groupsByLocationId.get(loc.id) ?? [];
      const prList = prsByLocationId.get(loc.id) ?? [];
      // Drop PRs with no attached Schedule right here — a PR without a
      // Schedule has no bookable surface and can't satisfy either the
      // PR-direct tier or (via `schedules.length > 0`) contribute to a
      // Group's member set. Filtering upfront matches the interface
      // docblock ("PRs without a Schedule are dropped") and lets resolver
      // call sites stop defensively re-checking `schedules.length`.
      const prsHere = prList.flatMap((pr) => {
        const schedules = pr.id ? (prSchedulesByPrId.get(pr.id) ?? []) : [];
        if (schedules.length === 0) return [];
        const pracId = pr.practitioner?.reference?.split('/')[1];
        return [
          {
            pr,
            practitioner: pracId ? practitionersById.get(pracId) : undefined,
            schedules,
          },
        ];
      });
      return { location: loc, ownSchedules, groupsHere, prsHere };
    });
};

/**
 * Convenience re-export so picker code keeps a single import surface. The
 * picker maps ResolvedBookableTarget → its own BookableTarget shape; the
 * `tier` field is dropped at that boundary (only needed inside this
 * helper).
 */
export const isLocationTier = (t: ResolvedBookableTarget): boolean => t.tier === 0;

/**
 * Unused at the moment but kept exported for AddPatient when wiring its
 * scheduleType derivation. The picker writes the bookable's
 * `resourceType` directly; the slot loader infers `ScheduleType` from it.
 * This mapping lives here so a single source of truth exists if/when more
 * call sites need it.
 */
export const scheduleTypeForResourceType = (
  rt: 'Location' | 'HealthcareService' | 'PractitionerRole'
): ScheduleType => {
  if (rt === 'HealthcareService') return ScheduleType.group;
  if (rt === 'PractitionerRole') return ScheduleType.provider;
  return ScheduleType.location;
};
