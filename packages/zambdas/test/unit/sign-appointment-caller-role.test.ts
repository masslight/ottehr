import { User } from '@oystehr/sdk';
import { NO_SIGN_PERMISSION_MESSAGE } from 'utils/lib/types/api/sign-appointment/sign-appointment.types';
import { RoleType } from 'utils/lib/types/api/user.types';
import { APIErrorCode } from 'utils/lib/types/errors';
import { describe, expect, it } from 'vitest';
import { assertCallerCanSign } from '../../src/ehr/sign-appointment/helpers';

// Signing a visit note is limited to provider-level roles. The EHR greys the button out, but the
// zambda is directly callable and the Clinician access policy is a near-copy of the Provider one,
// so this gate is the only thing standing between a Clinician and a signed note.

const userWithRoles = (...roleNames: string[]): User =>
  ({
    id: 'user-1',
    profile: 'Practitioner/practitioner-1',
    roles: roleNames.map((name) => ({ name })),
  }) as unknown as User;

describe('assertCallerCanSign', () => {
  it('permits a caller holding the Provider role', () => {
    expect(() => assertCallerCanSign(userWithRoles(RoleType.Provider))).not.toThrow();
  });

  it('permits a provider who also holds administrative roles', () => {
    expect(() => assertCallerCanSign(userWithRoles(RoleType.Administrator, RoleType.Provider))).not.toThrow();
  });

  it('refuses a caller holding only the Clinician role', () => {
    expect(() => assertCallerCanSign(userWithRoles(RoleType.Clinician))).toThrow(
      expect.objectContaining({
        code: APIErrorCode.NOT_AUTHORIZED,
        message: NO_SIGN_PERMISSION_MESSAGE,
        statusCode: 403,
      })
    );
  });

  // Clinician plus a non-clinical role must not add up to signing rights.
  it('refuses a clinician who also holds Manager and Staff', () => {
    expect(() => assertCallerCanSign(userWithRoles(RoleType.Clinician, RoleType.Manager, RoleType.Staff))).toThrow(
      expect.objectContaining({ message: NO_SIGN_PERMISSION_MESSAGE })
    );
  });

  it('refuses a caller with no roles at all', () => {
    expect(() =>
      assertCallerCanSign({ id: 'user-1', profile: 'Practitioner/practitioner-1' } as unknown as User)
    ).toThrow(expect.objectContaining({ message: NO_SIGN_PERMISSION_MESSAGE }));
  });
});
