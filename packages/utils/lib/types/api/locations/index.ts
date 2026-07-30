import { Address } from 'fhir/r4b';
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
