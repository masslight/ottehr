import { Secrets } from '../../../secrets';
import { HasRoles } from '../get-employees/get-employees.types';
import { RoleType } from '../user.types';

export interface SignAppointmentInput {
  appointmentId: string;
  encounterId: string;
  secrets: Secrets;
  timezone: string | null;
  supervisorApprovalEnabled?: boolean;
}

export interface SignAppointmentResponse {
  message: string;
}

/**
 * Roles permitted to sign a visit note.
 *
 * Signing attests to the note as the visit's rendering provider, which is NPI-gated, so it stays
 * with provider-level roles. Clinician is deliberately absent: clinical staff without an NPI (nurses,
 * medical assistants) hold provider-level EHR access for everything else — the Clinician access
 * policy is a near-copy of the Provider one — but not for this.
 */
export const VISIT_NOTE_SIGNING_ROLES: RoleType[] = [RoleType.Provider];

/**
 * Copy for a refused sign, shown on the disabled sign button and returned by the sign-appointment
 * zambda, so the UI gate and the backend gate explain the refusal the same way.
 */
export const NO_SIGN_PERMISSION_MESSAGE =
  "You don't have permission to sign this note. Signing is limited to provider-level roles";

/**
 * Whether these roles may sign a visit note.
 *
 * Widened to {@link HasRoles} because role names reach the backend as plain strings off the Oystehr
 * user rather than as a typed {@link RoleType} list.
 */
export const canSignVisitNote = (user: HasRoles): boolean =>
  VISIT_NOTE_SIGNING_ROLES.some((role) => user.roles.includes(role));
