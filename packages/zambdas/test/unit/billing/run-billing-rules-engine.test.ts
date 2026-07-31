import Oystehr from '@oystehr/sdk';
import { Bundle, Claim, Task } from 'fhir/r4b';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { RULES_ENGINE_FHIR, RULES_ENGINE_TASK_SYSTEM } from '../../../src/billing/rules-engine/constants';
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
  it("creates each claim's engine kickoff Task in a single transaction and returns per-claim results", async () => {
    const { oystehr, transaction } = makeOystehr(echoCreatedTasks);

    const response = await performEffect(oystehr, [
      { claimId: 'claim-1', engine: 'claim-submission' },
      { claimId: 'claim-2', engine: 'non-insurance-payer-pre-invoice' },
    ]);

    expect(response).toEqual({
      results: [
        { claimId: 'claim-1', engine: 'claim-submission', taskId: 'task-1' },
        { claimId: 'claim-2', engine: 'non-insurance-payer-pre-invoice', taskId: 'task-2' },
      ],
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    const { requests } = transaction.mock.calls[0][0];
    expect(requests).toHaveLength(2);
    expect(requests.map((r: { method: string; url: string }) => [r.method, r.url])).toEqual([
      ['POST', '/Task'],
      ['POST', '/Task'],
    ]);
    expect(requests[0].resource.status).toBe('requested');
    expect(requests[0].resource.focus?.reference).toBe('Claim/claim-1');
    expect(requests[0].resource.code?.coding).toEqual([
      { system: RULES_ENGINE_TASK_SYSTEM, code: RULES_ENGINE_FHIR['claim-submission'].taskCode },
    ]);
    expect(requests[1].resource.focus?.reference).toBe('Claim/claim-2');
    expect(requests[1].resource.code?.coding).toEqual([
      { system: RULES_ENGINE_TASK_SYSTEM, code: RULES_ENGINE_FHIR['non-insurance-payer-pre-invoice'].taskCode },
    ]);
  });

  it('throws when the transaction returns fewer tasks than claims', async () => {
    const { oystehr } = makeOystehr(() =>
      Promise.resolve({ resourceType: 'Bundle', type: 'transaction-response', entry: [] })
    );

    await expect(performEffect(oystehr, [{ claimId: 'claim-1', engine: 'claim-submission' }])).rejects.toThrow();
  });
});

describe('run-billing-rules-engine - complexValidation', () => {
  const makeClaim = (id: string, arStage?: string): Claim =>
    ({
      resourceType: 'Claim',
      id,
      meta: { tag: arStage ? [{ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: arStage }] : [] },
    }) as Claim;

  const makeSearchOystehr = (claims: Claim[]): { oystehr: Oystehr; search: ReturnType<typeof vi.fn> } => {
    const search = vi.fn().mockResolvedValue({ unbundle: () => claims });
    return { oystehr: { fhir: { search } } as unknown as Oystehr, search };
  };

  it('resolves each claim to its engine with a single search ORing the ids', async () => {
    const { oystehr, search } = makeSearchOystehr([
      makeClaim('claim-1', AR_STAGE.insurancePayer),
      makeClaim('claim-2', AR_STAGE.nonInsurancePayer),
    ]);

    const kickoffs = await complexValidation(oystehr, { claimIds: ['claim-1', 'claim-2'], secrets: null });

    expect(kickoffs).toEqual([
      { claimId: 'claim-1', engine: 'claim-submission' },
      { claimId: 'claim-2', engine: 'non-insurance-payer-pre-invoice' },
    ]);
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
    const { oystehr } = makeSearchOystehr([makeClaim('claim-1', AR_STAGE.insurancePayer)]);

    await expect(
      complexValidation(oystehr, { claimIds: ['claim-1', 'claim-2', 'claim-3'], secrets: null })
    ).rejects.toMatchObject({ message: 'Claim(s) not found: claim-2, claim-3' });
  });

  it('names the claims no engine applies to', async () => {
    const { oystehr } = makeSearchOystehr([makeClaim('claim-1', AR_STAGE.insurancePayer), makeClaim('claim-2')]);

    await expect(complexValidation(oystehr, { claimIds: ['claim-1', 'claim-2'], secrets: null })).rejects.toMatchObject(
      {
        message:
          'No rules engine applies to claim(s): claim-2. ' +
          'Set an AR Stage first — Patient AR claims must also be self-pay (no coverage).',
      }
    );
  });
});
