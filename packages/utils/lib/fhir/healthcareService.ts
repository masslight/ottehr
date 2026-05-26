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
//    extension at SERVICE_CATEGORY_CONFIG_EXTENSION_URL — see design-debt-
//    log.md D-1 for the planned move to a contained ValueSet shape.
//
// 2. GROUP RESOURCES
//    Untagged (no SERVICE_CATEGORY_TAG). characteristic[] carries the
//    assignment-mode and uniform-qualifications toggles. type[] carries
//    the group's allow-listed service-category codes. Members are
//    discovered via PractitionerRole.healthcareService back-references.
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
// Schedules. Those use different code systems (parallel concepts, per
// design-debt-log.md D-2) and are intentionally not duplicated here.

import { CodeableConcept, Coding, HealthcareService } from 'fhir/r4b';
import { ServiceMode, ServiceVisitType } from '../types';
import {
  GROUP_ALL_LOCATIONS_SYSTEM,
  GROUP_ASSIGNMENT_MODE_SYSTEM,
  GROUP_UNIFORM_QUALIFICATIONS_SYSTEM,
  GroupAllLocationsCoding,
  GroupAssignmentModeCoding,
  GroupUniformQualificationsCoding,
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

export function getGroupUniformQualifications(hs: HealthcareService): boolean | undefined {
  for (const cc of hs.characteristic || []) {
    for (const coding of cc.coding || []) {
      if (coding.system === GROUP_UNIFORM_QUALIFICATIONS_SYSTEM) {
        if (coding.code === 'true') return true;
        if (coding.code === 'false') return false;
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
export const GROUP_OWNED_CHARACTERISTIC_SYSTEMS = [
  GROUP_ASSIGNMENT_MODE_SYSTEM,
  GROUP_UNIFORM_QUALIFICATIONS_SYSTEM,
  GROUP_ALL_LOCATIONS_SYSTEM,
];

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
 * Build the group's characteristics for assignment-mode, uniform-
 * qualifications, and the all-locations toggle. Caller is responsible for
 * preserving non-group characteristics on the resource (use
 * mergeOwnedCharacteristics).
 */
export function groupCharacteristics(input: {
  assignmentMode: GroupAssignmentMode;
  uniformQualifications: boolean;
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
      coding: [
        plainCoding(
          input.uniformQualifications ? GroupUniformQualificationsCoding.true : GroupUniformQualificationsCoding.false
        ),
      ],
    },
    {
      coding: [plainCoding(input.allLocations ? GroupAllLocationsCoding.true : GroupAllLocationsCoding.false)],
    },
  ];
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
