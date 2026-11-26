import type Oystehr from '@oystehr/sdk';
import { User } from '@oystehr/sdk';
import { Practitioner } from 'fhir/r4b';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fullestPractitionerRefForUser,
  practitionerRefForUser,
  userPractitionerRef,
} from '../../src/shared/practitioners';

const buildUser = (profile: string): User => ({
  id: 'user-id',
  name: 'jordan@example.com',
  phoneNumber: null,
  authenticationMethod: 'email',
  email: 'jordan@example.com',
  profile,
  roles: [],
});

const practitioner: Practitioner = {
  resourceType: 'Practitioner',
  id: 'prac-1',
  name: [{ given: ['Jordan'], family: 'Rivera', suffix: ['MD'] }],
};

describe('practitioner references for an already-resolved user', () => {
  const get = vi.fn();
  const oystehr = { fhir: { get } } as unknown as Oystehr;

  beforeEach(() => {
    vi.clearAllMocks();
    get.mockResolvedValue(practitioner);
  });

  it('fullestPractitionerRefForUser names the user with credentials, like "Created by"', async () => {
    expect(await fullestPractitionerRefForUser(buildUser('Practitioner/prac-1'), oystehr)).toEqual({
      reference: 'Practitioner/prac-1',
      display: 'Jordan Rivera, MD',
    });
  });

  it('practitionerRefForUser still names the user by first and last name only', async () => {
    expect(await practitionerRefForUser(buildUser('Practitioner/prac-1'), oystehr)).toEqual({
      reference: 'Practitioner/prac-1',
      display: 'Jordan Rivera',
    });
  });

  it('fullestPractitionerRefForUser falls back to the user name without a Practitioner profile or on a failed read', async () => {
    expect(await fullestPractitionerRefForUser(buildUser('Device/d-1'), oystehr)).toEqual({
      reference: 'Device/d-1',
      display: 'jordan@example.com',
    });
    expect(get).not.toHaveBeenCalled();

    get.mockRejectedValueOnce(new Error('FHIR down'));
    expect(await fullestPractitionerRefForUser(buildUser('Practitioner/prac-1'), oystehr)).toEqual({
      reference: 'Practitioner/prac-1',
      display: 'jordan@example.com',
    });
  });

  it('userPractitionerRef names the user like resolveCallerPractitionerRef and refuses a user without a Practitioner', async () => {
    expect(await userPractitionerRef(buildUser('Practitioner/prac-1'), oystehr)).toEqual({
      reference: 'Practitioner/prac-1',
      display: 'Jordan Rivera, MD',
    });
    await expect(userPractitionerRef(buildUser('Device/d-1'), oystehr)).rejects.toThrow(
      "Can't receive practitioner resource id attached to current user"
    );
  });
});
