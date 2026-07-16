import Oystehr from '@oystehr/sdk';
import { Claim, Provenance, ProvenanceAgent } from 'fhir/r4b';
import { AR_STAGE, CLAIM_PROVENANCE_ACTIVITY_CODES, CLAIM_STATUS_TAG_SYSTEMS } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/submit-billing-claim';

const secrets = null;
const agent: ProvenanceAgent = { who: { reference: 'Practitioner/test-user' } };

const makeClaim = (id: string, arStage?: string): Claim =>
  ({
    resourceType: 'Claim',
    id,
    meta: {
      versionId: 'v1',
      tag: arStage
        ? [
            {
              system: CLAIM_STATUS_TAG_SYSTEMS.arStage,
              code: arStage,
            },
          ]
        : [],
    },
  }) as Claim;

const makeOystehr = (
  claims: Claim[],
  submitImpl?: () => Promise<unknown>
): {
  oystehr: Oystehr;
  transaction: ReturnType<typeof vi.fn>;
  submitClaim: ReturnType<typeof vi.fn>;
} => {
  const byId = new Map(claims.map((c) => [c.id!, c]));
  const search = vi.fn().mockImplementation(
    ({
      params,
    }: {
      params: {
        name: string;
        value: string;
      }[];
    }) => {
      const id = params.find((p) => p.name === '_id')?.value;
      const claim = id ? byId.get(id) : undefined;
      return Promise.resolve({
        unbundle: () => (claim ? [claim] : []),
      });
    }
  );
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  const submitClaim = vi.fn().mockImplementation(
    submitImpl ??
      (() =>
        Promise.resolve({
          resourceType: 'ClaimResponse',
        }))
  );
  return {
    oystehr: {
      fhir: {
        search,
        transaction,
      },
      rcm: {
        submitClaim,
      },
    } as unknown as Oystehr,
    transaction,
    submitClaim,
  };
};

// Every request posted across all transactions, flattened. A submission commits two transactions:
// the submission Provenance, then the status change (a JSON-Patch Binary plus its own Provenance).
const allRequests = (transaction: ReturnType<typeof vi.fn>): { resource?: { resourceType?: string } }[] =>
  transaction.mock.calls.flatMap((call) => call[0].requests);

// Pull the patched /meta/tag array out of the status-change Binary's base64-encoded operations.
const patchedTags = (transaction: ReturnType<typeof vi.fn>): { system: string; code: string }[] => {
  const binary = allRequests(transaction).find((r) => r.resource?.resourceType === 'Binary') as {
    resource: { data: string };
  };
  const ops = JSON.parse(Buffer.from(binary.resource.data, 'base64').toString('utf-8'));
  return ops[0].value;
};

const submissionProvenances = (transaction: ReturnType<typeof vi.fn>): Provenance[] =>
  allRequests(transaction)
    .map((r) => r.resource as Provenance | undefined)
    .filter(
      (r): r is Provenance =>
        r?.resourceType === 'Provenance' && r.activity?.coding?.[0]?.code === CLAIM_PROVENANCE_ACTIVITY_CODES.submit
    );

describe('submit-billing-claim performEffect', () => {
  it('submits an Insurance Payer AR claim and sets its insurance AR status to submitted', async () => {
    const { oystehr, transaction, submitClaim } = makeOystehr([makeClaim('c1', AR_STAGE.insurancePayer)]);

    const response = await performEffect(
      oystehr,
      {
        claimIds: ['c1'],
        secrets,
      },
      agent
    );

    expect(submitClaim).toHaveBeenCalledWith({ claimId: 'c1' });
    expect(response.results).toEqual([
      {
        claimId: 'c1',
        status: 'submitted',
      },
    ]);
    expect(patchedTags(transaction)).toContainEqual({
      system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus,
      code: 'submitted',
    });
  });

  it('records a submission Provenance attributing the acting user', async () => {
    const { oystehr, transaction } = makeOystehr([makeClaim('c1', AR_STAGE.insurancePayer)]);

    await performEffect(
      oystehr,
      {
        claimIds: ['c1'],
        secrets,
      },
      agent
    );

    const provenances = submissionProvenances(transaction);
    expect(provenances).toHaveLength(1);
    expect(provenances[0].target).toEqual([{ reference: 'Claim/c1' }]);
    expect(provenances[0].agent).toEqual([agent]);
  });

  it('rejects a claim that is not in Insurance Payer AR without calling the payer', async () => {
    const { oystehr, transaction, submitClaim } = makeOystehr([makeClaim('c2', AR_STAGE.patient)]);

    const response = await performEffect(
      oystehr,
      {
        claimIds: ['c2'],
        secrets,
      },
      agent
    );

    expect(response.results).toEqual([
      {
        claimId: 'c2',
        status: 'error',
        error: 'Claim is not in Insurance Payer AR',
      },
    ]);
    expect(submitClaim).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects a claim with no AR Stage set', async () => {
    const { oystehr, submitClaim } = makeOystehr([makeClaim('c3')]);

    const response = await performEffect(
      oystehr,
      {
        claimIds: ['c3'],
        secrets,
      },
      agent
    );

    expect(response.results[0].status).toBe('error');
    expect(submitClaim).not.toHaveBeenCalled();
  });

  it('reports the error and does not set the status when the payer submission fails', async () => {
    const { oystehr, transaction } = makeOystehr([makeClaim('c4', AR_STAGE.insurancePayer)], () =>
      Promise.reject(new Error('payer rejected'))
    );

    const response = await performEffect(
      oystehr,
      {
        claimIds: ['c4'],
        secrets,
      },
      agent
    );

    expect(response.results).toEqual([
      {
        claimId: 'c4',
        status: 'error',
        error: 'payer rejected',
      },
    ]);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('still reports submitted when recording the status fails after a successful submission', async () => {
    const { oystehr, submitClaim, transaction } = makeOystehr([makeClaim('c5', AR_STAGE.insurancePayer)]);
    transaction.mockRejectedValue(new Error('version conflict'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await performEffect(
      oystehr,
      {
        claimIds: ['c5'],
        secrets,
      },
      agent
    );

    expect(submitClaim).toHaveBeenCalledWith({ claimId: 'c5' });
    expect(response.results).toEqual([
      {
        claimId: 'c5',
        status: 'submitted',
      },
    ]);
    errorSpy.mockRestore();
  });

  it('still records the submission Provenance when the status write fails', async () => {
    const { oystehr, transaction } = makeOystehr([makeClaim('c6', AR_STAGE.insurancePayer)]);
    // Fail only the status-change transaction (the one carrying the JSON-Patch Binary).
    transaction.mockImplementation(({ requests }: { requests: { resource?: { resourceType?: string } }[] }) =>
      requests.some((r) => r.resource?.resourceType === 'Binary')
        ? Promise.reject(new Error('version conflict'))
        : Promise.resolve({ entry: [] })
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await performEffect(
      oystehr,
      {
        claimIds: ['c6'],
        secrets,
      },
      agent
    );

    expect(response.results).toEqual([{ claimId: 'c6', status: 'submitted' }]);
    expect(submissionProvenances(transaction)).toHaveLength(1);
    errorSpy.mockRestore();
  });

  it('still sets the status and reports submitted when the submission Provenance write fails', async () => {
    const { oystehr, transaction } = makeOystehr([makeClaim('c7', AR_STAGE.insurancePayer)]);
    transaction.mockRejectedValueOnce(new Error('provenance write failed'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await performEffect(
      oystehr,
      {
        claimIds: ['c7'],
        secrets,
      },
      agent
    );

    expect(response.results).toEqual([{ claimId: 'c7', status: 'submitted' }]);
    expect(patchedTags(transaction)).toContainEqual({
      system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus,
      code: 'submitted',
    });
    errorSpy.mockRestore();
  });

  it('processes each claim independently and returns a per-claim result', async () => {
    const { oystehr, submitClaim } = makeOystehr([
      makeClaim('ok', AR_STAGE.insurancePayer),
      makeClaim('bad', AR_STAGE.patient),
    ]);

    const response = await performEffect(
      oystehr,
      {
        claimIds: ['ok', 'bad'],
        secrets,
      },
      agent
    );

    expect(response.results).toEqual([
      {
        claimId: 'ok',
        status: 'submitted',
      },
      {
        claimId: 'bad',
        status: 'error',
        error: 'Claim is not in Insurance Payer AR',
      },
    ]);
    expect(submitClaim).toHaveBeenCalledTimes(1);
    expect(submitClaim).toHaveBeenCalledWith({ claimId: 'ok' });
  });
});
