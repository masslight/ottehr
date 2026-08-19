import Oystehr from '@oystehr/sdk';
import { RoleType } from 'utils/lib/types/api/user.types';
import { describe, expect, it, vi } from 'vitest';
import { practitionerHasRole } from '../../src/shared/auth';

// Backs the sign-appointment guard for the visit's assigned provider (the encounter's Attender).
// Roles live in Oystehr rather than FHIR, and nothing strips the Attender participant when an
// employee is moved off the Provider role — so a visit can hold a stale assignment that only a
// role lookup can detect.

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

describe('practitionerHasRole', () => {
  it('is true when the user behind the practitioner holds the role', async () => {
    const { oystehr, listV2 } = makeOystehr({
      users: [{ id: USER_ID }],
      roles: [{ name: RoleType.Manager }, { name: RoleType.Provider }],
    });

    await expect(practitionerHasRole(oystehr, PRACTITIONER_ID, RoleType.Provider)).resolves.toBe(true);
    expect(listV2).toHaveBeenCalledWith({ profile: `Practitioner/${PRACTITIONER_ID}`, limit: 1 });
  });

  it('is false when the user holds other roles only — the Provider-to-Clinician downgrade', async () => {
    const { oystehr } = makeOystehr({ users: [{ id: USER_ID }], roles: [{ name: RoleType.Clinician }] });

    await expect(practitionerHasRole(oystehr, PRACTITIONER_ID, RoleType.Provider)).resolves.toBe(false);
  });

  it('is false when the user has no roles at all', async () => {
    const { oystehr } = makeOystehr({ users: [{ id: USER_ID }], roles: undefined });

    await expect(practitionerHasRole(oystehr, PRACTITIONER_ID, RoleType.Provider)).resolves.toBe(false);
  });

  it('is false without a second lookup when no user owns the practitioner profile', async () => {
    const { oystehr, get } = makeOystehr({ users: [] });

    await expect(practitionerHasRole(oystehr, PRACTITIONER_ID, RoleType.Provider)).resolves.toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
});
