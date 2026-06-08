// HealthcareService characterization helpers.
//
// HealthcareService resources play three distinct roles in the group-
// scheduling system, and this file co-locates the logic for translating
// between FHIR shapes and product-level concepts for each role.
//
// 1. SERVICE-CATEGORY CATALOG ENTRIES
//    Tagged with SERVICE_CATEGORY_TAG.meta. type[] carries the category
//    code (urgent-care, botox, etc.). characteristic[] carries the runtime
//    config: supported modes, supported visit types, default duration, slot
//    cadence. Free-form fields (reasonsForVisit) still live in a JSON-blob
//    extension at SERVICE_CATEGORY_CONFIG_EXTENSION_URL.
//
// 2. GROUP RESOURCES
//    Untagged (no SERVICE_CATEGORY_TAG). characteristic[] carries the
//    assignment-mode toggle and the all-locations toggle. type[] carries
//    the group's allow-listed service-category codes. Members are
//    discovered via PractitionerRole.healthcareService back-references
//    and (when the all-locations toggle is off) via Location overlap.
//
// 3. SCHEDULE-ACTOR HEALTHCARESERVICES
//    A Schedule.actor that is a HealthcareService — used by the group-
//    scheduling path. These overlap with #2 (a group can also be a
//    schedule-actor HS) but the distinction is operational: a schedule-
//    actor HS has Schedule resources referencing it.
//
// Adjacent helpers in fhir/helpers.ts (serviceModeForHealthcareService,
// scheduleStrategyForHealthcareService) handle the HL7-aligned service-
// mode and pools/owns strategy used on Location/Practitioner-actored
// Schedules. Those use different code systems (parallel concepts) and
// are intentionally not duplicated here.

import { CodeableConcept, Coding, HealthcareService, Location, PractitionerRole, Resource, Schedule } from 'fhir/r4b';
import { ServiceMode, ServiceVisitType } from '../types';
import {
  GROUP_ALL_LOCATIONS_SYSTEM,
  GROUP_ASSIGNMENT_MODE_SYSTEM,
  GroupAllLocationsCoding,
  GroupAssignmentModeCoding,
  SERVICE_CATEGORY_CADENCE_MINUTES_SYSTEM,
  SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM,
  SERVICE_CATEGORY_MODE_SYSTEM,
  SERVICE_CATEGORY_TAG,
  SERVICE_CATEGORY_VISIT_TYPE_SYSTEM,
  ServiceCategoryModeCoding,
  ServiceCategoryVisitTypeCoding,
} from './constants';

export type GroupAssignmentMode = 'anonymous' | 'provider';

// ── Discriminators ──────────────────────────────────────────────────────────

/** True if the resource carries the booking-service-category meta tag. */
export function isServiceCategoryHealthcareService(hs: HealthcareService): boolean {
  return (hs.meta?.tag ?? []).some(
    (t) => t.system === SERVICE_CATEGORY_TAG.system && t.code === SERVICE_CATEGORY_TAG.code
  );
}

// ── Service-category readers (one per characteristic dimension) ─────────────

export function getServiceCategoryModes(hs: HealthcareService): ServiceMode[] {
  return extractEnumCodes(hs, SERVICE_CATEGORY_MODE_SYSTEM, Object.values(ServiceMode));
}

export function getServiceCategoryVisitTypes(hs: HealthcareService): ServiceVisitType[] {
  return extractEnumCodes(hs, SERVICE_CATEGORY_VISIT_TYPE_SYSTEM, Object.values(ServiceVisitType));
}

export function getServiceCategoryDurationMinutes(hs: HealthcareService): number | undefined {
  return extractMinutesCharacteristic(hs, SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM);
}

export function getServiceCategoryCadenceMinutes(hs: HealthcareService): number | undefined {
  return extractMinutesCharacteristic(hs, SERVICE_CATEGORY_CADENCE_MINUTES_SYSTEM);
}

// ── Group readers ───────────────────────────────────────────────────────────

export function getGroupAssignmentMode(hs: HealthcareService): GroupAssignmentMode | undefined {
  for (const cc of hs.characteristic || []) {
    for (const coding of cc.coding || []) {
      if (coding.system === GROUP_ASSIGNMENT_MODE_SYSTEM) {
        if (coding.code === 'anonymous' || coding.code === 'provider') return coding.code;
      }
    }
  }
  return undefined;
}

/**
 * True when the group pools from every active PractitionerRole in the system
 * (ignoring its `.location[]` entries). Undefined when the toggle was never
 * set; callers should treat undefined as false.
 */
export function getGroupAllLocations(hs: HealthcareService): boolean | undefined {
  for (const cc of hs.characteristic || []) {
    for (const coding of cc.coding || []) {
      if (coding.system === GROUP_ALL_LOCATIONS_SYSTEM) {
        if (coding.code === 'true') return true;
        if (coding.code === 'false') return false;
      }
    }
  }
  return undefined;
}

// ── Writers (return characteristics; caller merges with preserved foreign ones) ──

/** Service-category characteristic systems this module owns. */
export const SERVICE_CATEGORY_OWNED_CHARACTERISTIC_SYSTEMS = [
  SERVICE_CATEGORY_MODE_SYSTEM,
  SERVICE_CATEGORY_VISIT_TYPE_SYSTEM,
  SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM,
  SERVICE_CATEGORY_CADENCE_MINUTES_SYSTEM,
];

/** Group characteristic systems this module owns. */
export const GROUP_OWNED_CHARACTERISTIC_SYSTEMS = [GROUP_ASSIGNMENT_MODE_SYSTEM, GROUP_ALL_LOCATIONS_SYSTEM];

/**
 * Build the characteristics that capture a service-category record's runtime
 * config: supported modes, supported visit types, default duration, slot
 * cadence. Caller is responsible for preserving any non-service-category
 * characteristics on the resource (use mergeOwnedCharacteristics for that).
 */
export function serviceCategoryCharacteristics(input: {
  modes: ServiceMode[];
  visitTypes: ServiceVisitType[];
  durationMinutes?: number;
  cadenceMinutes?: number;
}): CodeableConcept[] {
  const ccs: CodeableConcept[] = [];
  for (const mode of input.modes) {
    ccs.push({ coding: [codingForServiceMode(mode)] });
  }
  for (const visitType of input.visitTypes) {
    ccs.push({ coding: [codingForVisitType(visitType)] });
  }
  if (input.durationMinutes !== undefined) {
    ccs.push({ coding: [minutesCoding(SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM, input.durationMinutes)] });
  }
  if (input.cadenceMinutes !== undefined) {
    ccs.push({ coding: [minutesCoding(SERVICE_CATEGORY_CADENCE_MINUTES_SYSTEM, input.cadenceMinutes)] });
  }
  return ccs;
}

/**
 * Build the group's characteristics for assignment-mode and the all-
 * locations toggle. Caller is responsible for preserving non-group
 * characteristics on the resource (use mergeOwnedCharacteristics).
 */
export function groupCharacteristics(input: {
  assignmentMode: GroupAssignmentMode;
  allLocations: boolean;
}): CodeableConcept[] {
  return [
    {
      coding: [
        plainCoding(
          input.assignmentMode === 'anonymous'
            ? GroupAssignmentModeCoding.anonymous
            : GroupAssignmentModeCoding.provider
        ),
      ],
    },
    {
      coding: [plainCoding(input.allLocations ? GroupAllLocationsCoding.true : GroupAllLocationsCoding.false)],
    },
  ];
}

/**
 * Whether a PractitionerRole is a member of a `pools-providers` group via
 * any of three additive sources:
 *   (a) back-reference — `role.healthcareService[]` includes a ref to the
 *       group resource;
 *   (b) location-overlap — `role.location[]` intersects the group's own
 *       `location[]`, filtered to active Locations only (inactive Locations
 *       are skipped so they stop contributing slots automatically when an
 *       admin marks them inactive — see `inactiveLocationIds` below);
 *   (c) all-locations widening — the group is flagged "pool from every
 *       active PR system-wide" (allLocationsFlag) and the role is active.
 * Any single source is sufficient. Inactive roles are excluded from the
 * all-locations source only (other sources don't check active to preserve
 * caller-controlled inclusion).
 *
 * `inactiveLocationIds` — pass the set of Location IDs whose
 * `Location.status` is `inactive`. Refs in `group.location[]` pointing at
 * those IDs are dropped from the membership check, so a PR that's only a
 * member via an inactive Location is no longer counted. When omitted, the
 * filter is a no-op (back-compat for callers that don't have the Location
 * resources to hand).
 */
export function isPractitionerRoleMemberOfGroup(input: {
  role: PractitionerRole;
  group: HealthcareService;
  allLocationsFlag: boolean;
  inactiveLocationIds?: Set<string>;
}): boolean {
  const { role, group, allLocationsFlag, inactiveLocationIds } = input;
  const groupLocationRefs = new Set(
    (group.location ?? [])
      .map((l) => l.reference)
      .filter((r): r is string => {
        if (!r) return false;
        if (!inactiveLocationIds || inactiveLocationIds.size === 0) return true;
        const id = r.startsWith('Location/') ? r.slice('Location/'.length) : r;
        return !inactiveLocationIds.has(id);
      })
  );
  const isMemberByReference = role.healthcareService?.some((ref) => ref.reference === `HealthcareService/${group.id}`);
  const isMemberByLocation = role.location?.some(
    (ref) => ref.reference !== undefined && groupLocationRefs.has(ref.reference)
  );
  const isMemberByAllLocations = allLocationsFlag && role.active !== false;
  return !!(isMemberByReference || isMemberByLocation || isMemberByAllLocations);
}

/**
 * Walks a pre-fetched FHIR bundle and returns the (Schedule, PractitionerRole)
 * pairs that make up a `pools-providers` group's member set. Pure: no FHIR
 * I/O. Each Schedule whose actor[0] is a PR is included iff the PR passes
 * `isPractitionerRoleMemberOfGroup`. All-locations widening is read off
 * the group's characteristics (not a parameter — would just duplicate
 * state already on the resource).
 *
 * Expected bundle contents (anything else is ignored):
 *   - PractitionerRoles whose .healthcareService back-refs the group AND/OR
 *     whose .location[] overlaps the group's .location[]
 *   - Schedules whose actor[0] is one of those PractitionerRoles
 * FHIR query that produces this shape: see
 * getGroupMemberPractitionerRoleSchedules in zambdas/src/shared/fhir.ts.
 */
export function walkGroupMemberPractitionerRoleSchedules(input: {
  bundle: Resource[];
  group: HealthcareService;
}): { schedule: Schedule; role: PractitionerRole }[] {
  const { bundle, group } = input;
  const allLocationsFlag = getGroupAllLocations(group) === true;
  const schedules: Schedule[] = [];
  const practitionerRoles: PractitionerRole[] = [];
  const inactiveLocationIds = new Set<string>();
  for (const res of bundle) {
    if (res.resourceType === 'Schedule') schedules.push(res as Schedule);
    else if (res.resourceType === 'PractitionerRole') practitionerRoles.push(res as PractitionerRole);
    else if (res.resourceType === 'Location' && res.id && (res as Location).status === 'inactive') {
      inactiveLocationIds.add(res.id);
    }
  }
  const result: { schedule: Schedule; role: PractitionerRole }[] = [];
  for (const sched of schedules) {
    const owner = sched.actor?.[0]?.reference ?? '';
    const [ownerType, ownerId] = owner.split('/');
    if (ownerType !== 'PractitionerRole' || !ownerId) continue;
    const role = practitionerRoles.find((r) => r.id === ownerId);
    if (!role) continue;
    if (!isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag, inactiveLocationIds })) continue;
    result.push({ schedule: sched, role });
  }
  return result;
}

/**
 * Replace any characteristics whose codings reference one of the owned
 * systems, then append the new owned characteristics. Preserves
 * characteristics whose codings are entirely outside the owned systems —
 * use this on resource updates so concerns owned by other code paths
 * aren't stomped.
 */
export function mergeOwnedCharacteristics(
  existing: CodeableConcept[] | undefined,
  ownedSystems: string[],
  newOwned: CodeableConcept[]
): CodeableConcept[] {
  const ownedSet = new Set(ownedSystems);
  const preserved = (existing ?? []).filter((cc) => !cc.coding?.some((c) => c.system && ownedSet.has(c.system)));
  return [...preserved, ...newOwned];
}

// ── Internal helpers ────────────────────────────────────────────────────────

function extractEnumCodes<T extends string>(hs: HealthcareService, system: string, allowedValues: T[]): T[] {
  const allowed = new Set<string>(allowedValues);
  const out: T[] = [];
  for (const cc of hs.characteristic || []) {
    for (const coding of cc.coding || []) {
      if (coding.system === system && coding.code && allowed.has(coding.code)) {
        out.push(coding.code as T);
      }
    }
  }
  return out;
}

function extractMinutesCharacteristic(hs: HealthcareService, system: string): number | undefined {
  for (const cc of hs.characteristic || []) {
    for (const coding of cc.coding || []) {
      if (coding.system === system && coding.code) {
        const n = Number(coding.code);
        if (Number.isFinite(n) && n > 0) return n;
      }
    }
  }
  return undefined;
}

function codingForServiceMode(mode: ServiceMode): Coding {
  return plainCoding(
    mode === ServiceMode['in-person'] ? ServiceCategoryModeCoding.inPerson : ServiceCategoryModeCoding.virtual
  );
}

function codingForVisitType(visitType: ServiceVisitType): Coding {
  return plainCoding(
    visitType === ServiceVisitType.prebook
      ? ServiceCategoryVisitTypeCoding.prebook
      : ServiceCategoryVisitTypeCoding.walkIn
  );
}

function minutesCoding(system: string, minutes: number): Coding {
  return { system, code: String(minutes), display: `${minutes} min` };
}

/**
 * Strip non-FHIR fields (e.g. `fullParam`, a search-param convenience present
 * on the typed Coding constants in fhir/constants.ts) before writing into a
 * FHIR resource. The Oystehr server rejects unknown properties on Coding.
 */
function plainCoding(c: { system: string; code: string; display?: string }): Coding {
  return { system: c.system, code: c.code, display: c.display };
}
