import Oystehr, { Role, User } from '@oystehr/sdk';
import { userMe } from 'utils/lib/auth/user-me.helper';
import { Secrets, SecretsKeys } from 'utils/lib/secrets';
import { RoleType } from 'utils/lib/types/api/user.types';
import { NOT_AUTHORIZED } from 'utils/lib/types/errors';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCaller, getUser, requireAdminTierUser, requireAdminUser, requireUserWithRole } from '../../src/shared/auth';
import { createClinicalOystehrClient } from '../../src/shared/helpers';

vi.mock('utils/lib/auth/user-me.helper', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils/lib/auth/user-me.helper')>();
  return {
    ...actual,
    userMe: vi.fn(),
  };
});

const m2mMe = vi.fn();
vi.mock('../../src/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/shared/helpers')>()),
  createClinicalOystehrClient: vi.fn(() => ({ m2m: { me: m2mMe } })),
}));

const secrets: Secrets = {
  [SecretsKeys.FHIR_API]: 'http://fhir',
  [SecretsKeys.PROJECT_API]: 'http://project',
  [SecretsKeys.ENVIRONMENT]: 'local',
  [SecretsKeys.PROJECT_ID]: 'project-1',
};

const buildUser = (roles: Role[]): User => ({
  id: 'user-id',
  name: 'Test User',
  phoneNumber: null,
  authenticationMethod: 'email',
  email: 'test@ottehr.com',
  profile: 'Practitioner/abc-123',
  roles,
});

const adminRole = {
  id: 'role-admin',
  name: RoleType.Administrator,
} as Role;

const staffRole = {
  id: 'role-staff',
  name: RoleType.Staff,
} as Role;

const managerRole = {
  id: 'role-manager',
  name: RoleType.Manager,
} as Role;

const customerSupportRole = {
  id: 'role-customer-support',
  name: RoleType.CustomerSupport,
} as Role;

describe('requireAdminUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolves and forwards token + secrets to userMe when the caller is an Administrator', async () => {
    vi.mocked(userMe).mockResolvedValue(buildUser([staffRole, adminRole]));

    await expect(requireAdminUser('user-token-xyz', secrets)).resolves.toBeUndefined();
    expect(userMe).toHaveBeenCalledWith('user-token-xyz', secrets);
  });

  it('throws NOT_AUTHORIZED when the caller lacks the Administrator role', async () => {
    vi.mocked(userMe).mockResolvedValue(buildUser([staffRole]));

    await expect(requireAdminUser('user-token', secrets)).rejects.toEqual(NOT_AUTHORIZED);
  });

  it('throws NOT_AUTHORIZED when the caller has no roles', async () => {
    vi.mocked(userMe).mockResolvedValue(buildUser([]));

    await expect(requireAdminUser('user-token', secrets)).rejects.toEqual(NOT_AUTHORIZED);
  });
});

describe('requireAdminTierUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Pins the role set rather than the mechanism. The set is a decision — it has to match the roles the
  // admin navigation admits, or an endpoint refuses users the UI invites in — and nothing else fails if
  // it drifts.
  it('admits every role the administration area is offered to', async () => {
    for (const role of [adminRole, managerRole, customerSupportRole]) {
      vi.mocked(userMe).mockResolvedValue(buildUser([role]));
      await expect(requireAdminTierUser('token', secrets)).resolves.toBeUndefined();
    }
  });

  it('refuses a purely clinical caller', async () => {
    vi.mocked(userMe).mockResolvedValue(buildUser([staffRole]));
    await expect(requireAdminTierUser('token', secrets)).rejects.toEqual(NOT_AUTHORIZED);
  });
});

describe('requireUserWithRole', () => {
  const allowedRoles = [RoleType.Administrator, RoleType.Manager, RoleType.CustomerSupport];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['Administrator', adminRole],
    ['Manager', managerRole],
    ['Customer Support', customerSupportRole],
  ])('resolves when the caller has the %s role', async (_label, role) => {
    const user = buildUser([role]);
    vi.mocked(userMe).mockResolvedValue(user);

    await expect(requireUserWithRole('user-token', secrets, allowedRoles)).resolves.toEqual(user);
  });

  it('throws NOT_AUTHORIZED when the caller has none of the allowed roles', async () => {
    vi.mocked(userMe).mockResolvedValue(buildUser([staffRole]));

    await expect(requireUserWithRole('user-token', secrets, allowedRoles)).rejects.toEqual(NOT_AUTHORIZED);
  });

  it('throws NOT_AUTHORIZED when the caller has no roles', async () => {
    vi.mocked(userMe).mockResolvedValue(buildUser([]));

    await expect(requireUserWithRole('user-token', secrets, allowedRoles)).rejects.toEqual(NOT_AUTHORIZED);
  });
});

describe('getUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the user when userMe resolves', async () => {
    const user = buildUser([staffRole]);
    vi.mocked(userMe).mockResolvedValue(user);

    await expect(getUser('user-token', secrets)).resolves.toEqual(user);
    expect(userMe).toHaveBeenCalledWith('user-token', secrets);
  });

  it.each([401, 403, '4031', '4011'])(
    'throws NOT_AUTHORIZED when userMe throws an OystehrSdkError %s',
    async (code) => {
      vi.mocked(userMe).mockRejectedValue(
        new Oystehr.OystehrSdkError({ message: 'explicit deny', code: code as unknown as number })
      );

      await expect(getUser('user-token', secrets)).rejects.toEqual(NOT_AUTHORIZED);
    }
  );

  it.each([500, 404, '4040', '4000'])('rethrows non-auth errors untouched (%s)', async (code) => {
    const error = new Oystehr.OystehrSdkError({ message: 'boom', code: code as unknown as number });
    vi.mocked(userMe).mockRejectedValue(error);

    await expect(getUser('user-token', secrets)).rejects.toBe(error);
  });
});

describe('getCaller', () => {
  const jwt = (sub: string): string =>
    `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify({ sub })).toString(
      'base64url'
    )}.sig`;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns an anonymous caller when there is no token', async () => {
    await expect(getCaller(undefined, secrets)).resolves.toEqual({});
    expect(userMe).not.toHaveBeenCalled();
  });

  it('resolves an M2M token without calling userMe', async () => {
    await expect(getCaller(jwt('client-123@clients'), secrets)).resolves.toMatchObject({
      m2m: { id: 'client-123', isValid: expect.any(Function) },
    });
    expect(userMe).not.toHaveBeenCalled();
  });

  it('resolves a user token through userMe', async () => {
    const user = buildUser([staffRole]);
    vi.mocked(userMe).mockResolvedValue(user);
    const token = jwt('auth0|user-1');

    await expect(getCaller(token, secrets)).resolves.toEqual({ user });
    expect(userMe).toHaveBeenCalledWith(token, secrets);
  });

  describe('m2m.isValid', () => {
    const m2mToken = jwt('client-123@clients');
    const isValid = async (): Promise<boolean> => (await getCaller(m2mToken, secrets)).m2m!.isValid();

    it('is true when Oystehr resolves the same client for the token, scoped to the project', async () => {
      m2mMe.mockResolvedValue({ id: 'm2m-1', clientId: 'client-123' });

      await expect(isValid()).resolves.toBe(true);
      expect(createClinicalOystehrClient).toHaveBeenCalledWith(m2mToken, secrets, { projectId: 'project-1' });
    });

    it('is false when Oystehr resolves a different client', async () => {
      m2mMe.mockResolvedValue({ id: 'm2m-2', clientId: 'other-client' });

      await expect(isValid()).resolves.toBe(false);
    });

    it.each([401, '4011', '4031'])('is false when Oystehr rejects the token with %s', async (code) => {
      m2mMe.mockRejectedValue(new Oystehr.OystehrSdkError({ message: 'deny', code: code as unknown as number }));

      await expect(isValid()).resolves.toBe(false);
    });

    it('rethrows non-auth errors', async () => {
      const error = new Oystehr.OystehrSdkError({ message: 'boom', code: 500 });
      m2mMe.mockRejectedValue(error);

      await expect(isValid()).rejects.toBe(error);
    });
  });
});
