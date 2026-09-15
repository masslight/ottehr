import { Address, Location } from 'fhir/r4b';
import { TelecomUpdate } from '../schedules';

/**
 * The intrinsic, self-service-editable fields of a Location — independent of any
 * Schedule. Shared by create + update so the two writers can't drift. `undefined`
 * means "leave unchanged"; `null` (where allowed) means "clear".
 */
export interface LocationFieldsInput {
  name?: string;
  description?: string | null;
  address?: Address | null;
  telecom?: TelecomUpdate | null;
  rooms?: string[];
  isVirtual?: boolean;
  isInPerson?: boolean;
  slug?: string;
  timezone?: string;
  stripeAccountId?: string | null;
  advapacsLocationId?: string | null;
  reviewLink?: string | null;
  /** Front-desk / patient support phone number surfaced in booking flows. */
  supportPhone?: string | null;
}

export interface CreateLocationParams extends LocationFieldsInput {
  /** Required — a bare Location with no name never becomes usable. */
  name: string;
}

export interface UpdateLocationParams extends LocationFieldsInput {
  locationId: string;
}

export interface GetLocationParams {
  locationId: string;
}

/**
 * A Schedule actored by the Location, reduced to what a caller needs to name and link to it.
 *
 * A Location may own several — one per service category is an established pattern — so this is
 * always a list rather than an optional "the" schedule.
 */
export interface LocationScheduleSummary {
  id: string;
  /** The schedule's display-name extension, if it carries one. Schedule has no `name` in R4B. */
  name?: string;
}

export interface GetLocationResponse {
  location: Location;
  /**
   * Returned alongside the Location because the two are read together: booking links are built from
   * Location config but only vend slots if a Schedule exists, so a caller that has one without the
   * other can't tell a working link from a dead one.
   */
  schedules: LocationScheduleSummary[];
}

/**
 * Every active Location reduced to what a picker needs. Deliberately not `Location[]`: callers that
 * only populate a select shouldn't receive — or need read access to — the whole resource.
 */
export interface ListActiveLocationsOutput {
  /** `name` falls back to the id so an unnamed Location is still selectable rather than blank. */
  locations: { id: string; name: string }[];
}

export interface ToggleLocationActiveParams {
  locationId: string;
  /** `true` → active, `false` → inactive (archived; drops out of patient booking). */
  active: boolean;
}

export interface DeleteLocationParams {
  locationId: string;
  /**
   * `false`/omitted → the delete is refused with `RESOURCE_HAS_DEPENDENTS` if the
   * Location has dependent Schedules/PractitionerRoles or any Appointments, so the UI
   * can warn first. `true` → proceed: dependent Schedules and PractitionerRoles are
   * cascade-deleted and the Location is deleted; Appointments are never deleted
   * (clinical history is kept — their location reference is orphaned).
   */
  force?: boolean;
}

/** Counts of what points at a Location — drives the pre-delete warning. */
export interface LocationDependents {
  schedules: number;
  practitionerRoles: number;
  appointments: number;
}

export interface DeleteLocationResponse {
  deleted: true;
  id: string;
  /** Cascade-deleted alongside the Location. */
  cascaded: { schedules: number; practitionerRoles: number };
  /** Appointments left intact (their location reference is now orphaned). */
  orphanedAppointments: number;
}
