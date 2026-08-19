import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { RoleType } from 'utils/lib/types/api/user.types';
import { RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR } from 'utils/lib/types/errors';
import { getPractitionerRoles } from '../../shared/auth';

export const NO_PROVIDER_ASSIGNED_MESSAGE = 'No provider is assigned to this visit. Select a provider before signing.';

export const ASSIGNED_PROVIDER_NOT_A_PROVIDER_MESSAGE =
  'The provider assigned to this visit is no longer a provider. Select a provider before signing.';

/**
 * Throws unless the visit's assigned provider (the encounter's Attender) may still hold that slot.
 *
 * The Attender is the note's — and the claim's — rendering provider. Nothing removes the participant
 * when an employee's role is downgraded (e.g. Provider to Clinician), so a stale assignment survives
 * on the encounter and has to be rejected rather than assumed valid.
 *
 * Unresolvable roles mean no Oystehr user owns that Practitioner (it may be an M2M client's profile),
 * which is not the same as holding no roles — only a resolved non-Provider is a stale assignment.
 * Same stance as the EHR's useAssignedProvider: block on a known-bad role, never on an unresolved
 * identity.
 *
 * Throws an APIError rather than a bare Error so the message reaches the caller instead of becoming
 * a 500 "Internal error" — and so it isn't reported to Sentry as an internal fault, which this
 * ordinary validation outcome is not.
 */
export const assertAssignedProviderCanSign = async (oystehr: Oystehr, encounter: Encounter): Promise<void> => {
  const attendingPractitionerId = getAttendingPractitionerId(encounter);
  if (!attendingPractitionerId) {
    console.error(`Encounter ${encounter.id} has no Attender participant; refusing to sign`);
    throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(NO_PROVIDER_ASSIGNED_MESSAGE);
  }

  const roles = await getPractitionerRoles(oystehr, attendingPractitionerId);
  if (roles && !roles.includes(RoleType.Provider)) {
    console.error(
      `Practitioner ${attendingPractitionerId} assigned to encounter ${encounter.id} holds roles ` +
        `[${roles.join(', ')}] and no longer holds ${RoleType.Provider}; refusing to sign`
    );
    throw RESOURCE_INCOMPLETE_FOR_OPERATION_ERROR(ASSIGNED_PROVIDER_NOT_A_PROVIDER_MESSAGE);
  }
};
