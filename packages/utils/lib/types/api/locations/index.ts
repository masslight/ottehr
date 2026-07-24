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
