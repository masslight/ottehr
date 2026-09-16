import Oystehr from '@oystehr/sdk';
import { RoleType } from 'utils/lib/types/api/user.types';
import { describe, expect, it, vi } from 'vitest';
import { getPractitionerRoles } from '../../src/shared/auth';

// Backs the sign-appointment guard for the visit's assigned provider (the encounter's Attender).
// Roles live in Oystehr rather than FHIR, and nothing strips the Attender participant when an
// employee is moved off the Provider role — so a visit can hold a stale assignment that only a
// role lookup can detect.
//
// The undefined-vs-empty distinction is load-bearing: a Practitioner may be an M2M client's profile
// rather than a user's (integration tests are built that way), and callers must be able to tell
// "not an employee at all" apart from "an employee holding no roles".

const PRACTITIONER_ID = 'practitioner-1';
const USER_ID = 'user-1';

const makeOystehr = (options: {
  users?: { id: string }[];
  roles?: { name: string }[];
}): { oystehr: Oystehr; listV2: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> } => {
  const listV2 = vi.fn().mockResolvedValue({ data: options.users ?? [] });
  const get = vi.fn().mockResolvedValue({ id: USER_ID, roles: options.roles });
  return { oystehr: { user: { listV2, get } } as unknown as Oystehr, listV2, get };
};

describe('getPractitionerRoles', () => {
  it('returns every role the user behind the practitioner holds', async () => {
    const { oystehr, listV2 } = makeOystehr({
      users: [{ id: USER_ID }],
      roles: [{ name: RoleType.Manager }, { name: RoleType.Provider }],
    });

    await expect(getPractitionerRoles(oystehr, PRACTITIONER_ID)).resolves.toEqual([
      RoleType.Manager,
      RoleType.Provider,
    ]);
    expect(listV2).toHaveBeenCalledWith({ profile: `Practitioner/${PRACTITIONER_ID}`, limit: 1 });
  });

  it('omits Provider after a downgrade to Clinician', async () => {
    const { oystehr } = makeOystehr({ users: [{ id: USER_ID }], roles: [{ name: RoleType.Clinician }] });

    const roles = await getPractitionerRoles(oystehr, PRACTITIONER_ID);
    expect(roles).toEqual([RoleType.Clinician]);
    expect(roles).not.toContain(RoleType.Provider);
  });

  it('returns an empty list — not undefined — for a user carrying no roles', async () => {
    const { oystehr } = makeOystehr({ users: [{ id: USER_ID }], roles: undefined });

    await expect(getPractitionerRoles(oystehr, PRACTITIONER_ID)).resolves.toEqual([]);
  });

  it('returns undefined without a second lookup when no user owns the practitioner profile', async () => {
    const { oystehr, get } = makeOystehr({ users: [] });

    await expect(getPractitionerRoles(oystehr, PRACTITIONER_ID)).resolves.toBeUndefined();
    expect(get).not.toHaveBeenCalled();
  });
});
