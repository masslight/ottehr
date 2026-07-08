import Oystehr from '@oystehr/sdk';
import { Claim, ProvenanceAgent } from 'fhir/r4b';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils';
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

// The status change commits as a transaction: a JSON-Patch Binary against the claim plus a
// Provenance. Pull the patched /meta/tag array out of the Binary's base64-encoded operations.
const patchedTags = (transaction: ReturnType<typeof vi.fn>): { system: string; code: string }[] => {
  const binary = transaction.mock.calls[0][0].requests.find(
    (r: { resource?: { resourceType?: string } }) => r.resource?.resourceType === 'Binary'
  );
  const ops = JSON.parse(Buffer.from(binary.resource.data, 'base64').toString('utf-8'));
  return ops[0].value;
};

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
