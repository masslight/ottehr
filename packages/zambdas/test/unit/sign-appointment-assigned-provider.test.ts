import Oystehr from '@oystehr/sdk';
import { Encounter } from 'fhir/r4b';
import { RoleType } from 'utils/lib/types/api/user.types';
import { PRACTITIONER_CODINGS } from 'utils/lib/types/data/appointments/appointments.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it, vi } from 'vitest';
import {
  assertAssignedProviderCanSign,
  ASSIGNED_PROVIDER_NOT_A_PROVIDER_MESSAGE,
  NO_PROVIDER_ASSIGNED_MESSAGE,
} from '../../src/ehr/sign-appointment/helpers';

// The visit's assigned provider (the encounter's Attender) is the note's rendering provider, so
// signing must be refused once that person can no longer hold the slot. The stale-assignment case
// cannot be reached through the integration suite — there the attender is an M2M client's profile,
// which is deliberately unresolvable and therefore fails open — so it is covered here.

const PRACTITIONER_ID = 'practitioner-1';
const USER_ID = 'user-1';

const encounterWithAttender = (practitionerId?: string): Encounter =>
  ({
    resourceType: 'Encounter',
    id: 'encounter-1',
    status: 'in-progress',
    class: { code: 'ACUTE' },
    participant: practitionerId
      ? [
          {
            type: [{ coding: [PRACTITIONER_CODINGS.Attender[0]] }],
            individual: { reference: `Practitioner/${practitionerId}` },
          },
        ]
      : undefined,
  }) as Encounter;

const oystehrResolving = (roles?: { name: string }[], users: { id: string }[] = [{ id: USER_ID }]): Oystehr =>
  ({
    user: {
      listV2: vi.fn().mockResolvedValue({ data: users }),
      get: vi.fn().mockResolvedValue({ id: USER_ID, roles }),
    },
  }) as unknown as Oystehr;

describe('assertAssignedProviderCanSign', () => {
  it('passes when the assigned provider still holds the Provider role', async () => {
    const oystehr = oystehrResolving([{ name: RoleType.Provider }]);

    await expect(
      assertAssignedProviderCanSign(oystehr, encounterWithAttender(PRACTITIONER_ID))
    ).resolves.toBeUndefined();
  });

  it('rejects when the assigned provider was downgraded to a non-Provider role', async () => {
    const oystehr = oystehrResolving([{ name: RoleType.Clinician }]);

    await expect(assertAssignedProviderCanSign(oystehr, encounterWithAttender(PRACTITIONER_ID))).rejects.toMatchObject({
      code: APIErrorCode.RESOURCE_INCOMPLETE_FOR_OPERATION,
      message: ASSIGNED_PROVIDER_NOT_A_PROVIDER_MESSAGE,
    });
  });

  // Deactivation only *adds* the Inactive role, so a Provider check alone would wave a departed
  // employee through — while the EHR's assignment dropdown has already dropped them.
  it('rejects when the assigned provider has been deactivated but kept the Provider role', async () => {
    const oystehr = oystehrResolving([{ name: RoleType.Provider }, { name: RoleType.Inactive }]);

    await expect(assertAssignedProviderCanSign(oystehr, encounterWithAttender(PRACTITIONER_ID))).rejects.toMatchObject({
      code: APIErrorCode.RESOURCE_INCOMPLETE_FOR_OPERATION,
      message: ASSIGNED_PROVIDER_NOT_A_PROVIDER_MESSAGE,
    });
  });

  it('rejects when the assigned provider is customer support', async () => {
    const oystehr = oystehrResolving([{ name: RoleType.Provider }, { name: RoleType.CustomerSupport }]);

    await expect(assertAssignedProviderCanSign(oystehr, encounterWithAttender(PRACTITIONER_ID))).rejects.toMatchObject({
      message: ASSIGNED_PROVIDER_NOT_A_PROVIDER_MESSAGE,
    });
  });

  it('rejects when the assigned provider holds no roles at all', async () => {
    const oystehr = oystehrResolving([]);

    await expect(assertAssignedProviderCanSign(oystehr, encounterWithAttender(PRACTITIONER_ID))).rejects.toMatchObject({
      message: ASSIGNED_PROVIDER_NOT_A_PROVIDER_MESSAGE,
    });
  });

  it('rejects when no provider is assigned to the encounter', async () => {
    const oystehr = oystehrResolving([{ name: RoleType.Provider }]);

    await expect(assertAssignedProviderCanSign(oystehr, encounterWithAttender(undefined))).rejects.toMatchObject({
      code: APIErrorCode.RESOURCE_INCOMPLETE_FOR_OPERATION,
      message: NO_PROVIDER_ASSIGNED_MESSAGE,
    });
  });

  it('passes when no Oystehr user owns the assigned Practitioner — an unresolved identity is not a denial', async () => {
    const oystehr = oystehrResolving(undefined, []);

    await expect(
      assertAssignedProviderCanSign(oystehr, encounterWithAttender(PRACTITIONER_ID))
    ).resolves.toBeUndefined();
  });
});
