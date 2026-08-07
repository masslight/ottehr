import { User } from '@oystehr/sdk';
import { Secrets, SecretsKeys, userMe } from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMyPractitionerId } from '../src/shared';

// userMe is a canonical suite-wide mock (vitest.unit-mocks.setup.ts); each test installs its behavior.

const secrets: Secrets = {
  [SecretsKeys.FHIR_API]: 'http://fhir',
  [SecretsKeys.PROJECT_API]: 'http://project',
  [SecretsKeys.ENVIRONMENT]: 'local',
};

const buildUser = (profile: string): User => ({
  id: 'user-id',
  name: 'Test User',
  phoneNumber: null,
  authenticationMethod: 'email',
  email: 'test@ottehr.com',
  profile,
  roles: [],
});

describe('getMyPractitionerId — user-token path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the Practitioner id and forwards token + secrets to userMe', async () => {
    vi.mocked(userMe).mockResolvedValue(buildUser('Practitioner/abc-123'));

    const result = await getMyPractitionerId('user-token-xyz', secrets);

    expect(userMe).toHaveBeenCalledWith('user-token-xyz', secrets);
    expect(result).toBe('abc-123');
  });

  it('throws when the User profile is not a Practitioner reference', async () => {
    vi.mocked(userMe).mockResolvedValue(buildUser('Patient/foo'));

    await expect(getMyPractitionerId('user-token', secrets)).rejects.toThrow(
      "Can't receive practitioner resource id attached to current user"
    );
  });
});
