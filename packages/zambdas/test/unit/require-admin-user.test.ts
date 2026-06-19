import Oystehr, { Role, User } from '@oystehr/sdk';
import { NOT_AUTHORIZED, RoleType, Secrets, SecretsKeys, userMe } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUser, requireAdminUser, requireUserWithRole } from '../../src/shared';

vi.mock('utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('utils')>();
  return {
    ...actual,
    userMe: vi.fn(),
  };
});

const secrets: Secrets = {
  [SecretsKeys.FHIR_API]: 'http://fhir',
  [SecretsKeys.PROJECT_API]: 'http://project',
  [SecretsKeys.ENVIRONMENT]: 'local',
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
    vi.mocked(userMe).mockResolvedValue(buildUser([role]));

    await expect(requireUserWithRole('user-token', secrets, allowedRoles)).resolves.toBeUndefined();
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

  it.each([401, 403])('throws NOT_AUTHORIZED when userMe throws an OystehrSdkError %i', async (code) => {
    vi.mocked(userMe).mockRejectedValue(new Oystehr.OystehrSdkError({ message: 'explicit deny', code }));

    await expect(getUser('user-token', secrets)).rejects.toEqual(NOT_AUTHORIZED);
  });

  it('rethrows non-auth errors untouched', async () => {
    const error = new Oystehr.OystehrSdkError({ message: 'boom', code: 500 });
    vi.mocked(userMe).mockRejectedValue(error);

    await expect(getUser('user-token', secrets)).rejects.toBe(error);
  });
});
