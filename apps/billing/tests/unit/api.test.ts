import Oystehr from '@oystehr/sdk';
import { INVALID_INPUT_ERROR } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import {
  createBillingPatient,
  deleteBillingTag,
  searchBillingPatients,
  searchBillingProviders,
  tagBillingClaim,
} from '../../src/api/api';

function mockClient(output: unknown): { client: Oystehr; execute: ReturnType<typeof vi.fn> } {
  const execute = vi.fn().mockResolvedValue({ output });
  return {
    client: { zambda: { execute } } as unknown as Oystehr,
    execute,
  };
}

describe('billing api wrappers', () => {
  it('sends the zambda id plus params and returns the unwrapped output', async () => {
    const { client, execute } = mockClient({ patients: [{ id: 'p1' }], total: 1, offset: 0, pageSize: 25 });

    const res = await searchBillingPatients(client, { name: 'doe', pageSize: 25 });

    expect(execute).toHaveBeenCalledWith({ id: 'search-billing-patients', name: 'doe', pageSize: 25 });
    expect(res).toEqual({ patients: [{ id: 'p1' }], total: 1, offset: 0, pageSize: 25 });
  });

  it('forwards discriminating params like providerType', async () => {
    const { client, execute } = mockClient({ providers: [], total: 0, offset: 0, pageSize: 25 });

    await searchBillingProviders(client, { providerType: 'billing' });

    expect(execute).toHaveBeenCalledWith({ id: 'search-billing-providers', providerType: 'billing' });
  });

  it('returns the created resource id', async () => {
    const { client } = mockClient({ id: 'new-patient' });

    expect(await createBillingPatient(client, { firstName: 'A', lastName: 'B' })).toEqual({ id: 'new-patient' });
  });

  it('passes mutation params through', async () => {
    const { client, execute } = mockClient({ ok: true });

    await tagBillingClaim(client, { claimId: 'c1', action: 'add', tagName: 'urgent' });

    expect(execute).toHaveBeenCalledWith({ id: 'tag-billing-claim', claimId: 'c1', action: 'add', tagName: 'urgent' });
  });

  it('rethrows a well-formed APIError as-is', async () => {
    const execute = vi.fn().mockRejectedValue(INVALID_INPUT_ERROR('bad input'));
    const client = { zambda: { execute } } as unknown as Oystehr;

    await expect(deleteBillingTag(client, { tagId: 't1' })).rejects.toMatchObject({ message: 'bad input' });
  });

  it('normalizes a non-APIError into the internal error', async () => {
    const execute = vi.fn().mockRejectedValue(new Error('socket hang up'));
    const client = { zambda: { execute } } as unknown as Oystehr;

    await expect(deleteBillingTag(client, { tagId: 't1' })).rejects.toMatchObject({
      message: 'Internal Service Error',
    });
  });
});
