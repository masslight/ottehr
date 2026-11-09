import { User } from '@oystehr/sdk';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { practitionerRefForBillingUser } from '../../../src/billing/clinical-practitioners';
import { OystehrMock } from '../../helpers/oystehr-mock';

const PRACTITIONER_ID = '0f6c1d8e-3a2b-4c5d-9e8f-7a6b5c4d3e2f';
const user = { id: 'user-1', profile: `Practitioner/${PRACTITIONER_ID}`, name: 'ada@example.com' } as User;

const execute = vi.fn();
const oystehr = { zambda: { execute }, fhir: { get: vi.fn(), search: vi.fn() } } as unknown as OystehrMock;

beforeEach(() => {
  vi.clearAllMocks();
  execute.mockResolvedValue({ output: { names: { [PRACTITIONER_ID]: 'Ada Lovelace' } } });
});

describe('practitionerRefForBillingUser', () => {
  it("names the caller from the EHR's get-practitioner-names zambda, never clinical FHIR", async () => {
    const ref = await practitionerRefForBillingUser(user, oystehr);

    expect(ref).toEqual({ reference: user.profile, display: 'Ada Lovelace' });
    expect(execute).toHaveBeenCalledWith({ id: 'get-practitioner-names', practitionerIds: [PRACTITIONER_ID] });
    expect(oystehr.fhir.get).not.toHaveBeenCalled();
    expect(oystehr.fhir.search).not.toHaveBeenCalled();
  });

  it('falls back to the user name when the Practitioner has no name', async () => {
    execute.mockResolvedValue({ output: { names: {} } });

    expect(await practitionerRefForBillingUser(user, oystehr)).toEqual({
      reference: user.profile,
      display: 'ada@example.com',
    });
  });

  it('falls back to the user name when the lookup fails', async () => {
    execute.mockRejectedValue(new Error('zambda down'));

    expect(await practitionerRefForBillingUser(user, oystehr)).toEqual({
      reference: user.profile,
      display: 'ada@example.com',
    });
  });

  it('skips the lookup for a caller with no Practitioner profile', async () => {
    const ref = await practitionerRefForBillingUser({ ...user, profile: 'Device/d-1' } as User, oystehr);

    expect(ref).toEqual({ reference: 'Device/d-1', display: 'ada@example.com' });
    expect(execute).not.toHaveBeenCalled();
  });
});
