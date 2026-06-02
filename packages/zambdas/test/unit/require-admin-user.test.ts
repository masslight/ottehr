import { Role, User } from '@oystehr/sdk';
import { NOT_AUTHORIZED, RoleType, Secrets, SecretsKeys, userMe } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireAdminUser } from '../../src/shared';

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
