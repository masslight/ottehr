import Oystehr from '@oystehr/sdk';
import { Bundle, Claim, Task } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import {
  PRESUBMISSION_RULES_TASK_CODE,
  PRESUBMISSION_RULES_TASK_SYSTEM,
} from '../../../src/billing/rules-engine/constants';
import { complexValidation, performEffect } from '../../../src/billing/run-billing-rules-engine';

const makeOystehr = (
  transactionImpl: (args: { requests: { resource: Task }[] }) => Promise<Bundle<Task>>
): { oystehr: Oystehr; transaction: ReturnType<typeof vi.fn> } => {
  const transaction = vi.fn().mockImplementation(transactionImpl);
  return { oystehr: { fhir: { transaction } } as unknown as Oystehr, transaction };
};

const echoCreatedTasks = ({ requests }: { requests: { resource: Task }[] }): Promise<Bundle<Task>> =>
  Promise.resolve({
    resourceType: 'Bundle',
    type: 'transaction-response',
    entry: requests.map((request, i) => ({ resource: { ...request.resource, id: `task-${i + 1}` } })),
  });

describe('run-billing-rules-engine - performEffect', () => {
  it('creates one kickoff Task per claim in a single transaction and returns the task ids', async () => {
    const { oystehr, transaction } = makeOystehr(echoCreatedTasks);

    const response = await performEffect(oystehr, { claimIds: ['claim-1', 'claim-2'], secrets: null });

    expect(response).toEqual({ taskIds: ['task-1', 'task-2'] });
    expect(transaction).toHaveBeenCalledTimes(1);
    const { requests } = transaction.mock.calls[0][0];
    expect(requests).toHaveLength(2);
    for (const [i, request] of requests.entries()) {
      expect(request.method).toBe('POST');
      expect(request.url).toBe('/Task');
      expect(request.resource.status).toBe('requested');
      expect(request.resource.focus?.reference).toBe(`Claim/claim-${i + 1}`);
      expect(request.resource.code?.coding).toEqual([
        { system: PRESUBMISSION_RULES_TASK_SYSTEM, code: PRESUBMISSION_RULES_TASK_CODE },
      ]);
    }
  });

  it('throws when the transaction returns fewer tasks than claims', async () => {
    const { oystehr } = makeOystehr(() =>
      Promise.resolve({ resourceType: 'Bundle', type: 'transaction-response', entry: [] })
    );

    await expect(performEffect(oystehr, { claimIds: ['claim-1'], secrets: null })).rejects.toThrow();
  });
});

describe('run-billing-rules-engine - complexValidation', () => {
  const makeSearchOystehr = (existingIds: string[]): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
    const search = vi.fn().mockResolvedValue({
      unbundle: () => existingIds.map((id) => ({ resourceType: 'Claim', id }) as Claim),
    });
    return { oystehr: { fhir: { search } } as unknown as Oystehr, search };
  };

  it('confirms all claims exist with a single search ORing the ids', async () => {
    const { oystehr, search } = makeSearchOystehr(['claim-1', 'claim-2']);

    const claims = await complexValidation(oystehr, { claimIds: ['claim-1', 'claim-2'], secrets: null });

    expect(claims.map((c) => c.id)).toEqual(['claim-1', 'claim-2']);
    expect(search).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledWith({
      resourceType: 'Claim',
      params: [
        { name: '_id', value: 'claim-1,claim-2' },
        { name: '_count', value: '2' },
      ],
    });
  });

  it('names the missing claims when some ids do not resolve', async () => {
    const { oystehr } = makeSearchOystehr(['claim-1']);

    await expect(
      complexValidation(oystehr, { claimIds: ['claim-1', 'claim-2', 'claim-3'], secrets: null })
    ).rejects.toMatchObject({ message: 'Claim(s) not found: claim-2, claim-3' });
  });
});
