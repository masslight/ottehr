import Oystehr from '@oystehr/sdk';
import { Claim, ProvenanceAgent } from 'fhir/r4b';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS, CLAIM_TAG_SYSTEM, HOLD_TAG_NAME } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/set-billing-claim-status';

const secrets = null;
const agent: ProvenanceAgent = { who: { reference: 'Practitioner/test-user' } };

const HOLD_TAG = { system: CLAIM_TAG_SYSTEM, code: HOLD_TAG_NAME };

const makeClaim = (tag: { system: string; code: string }[] = []): Claim =>
  ({ resourceType: 'Claim', id: 'claim-1', meta: { versionId: 'v1', tag } }) as Claim;

const makeOystehr = (
  claim: Claim
): {
  oystehr: Oystehr;
  transaction: ReturnType<typeof vi.fn>;
  search: ReturnType<typeof vi.fn>;
  create: ReturnType<typeof vi.fn>;
} => {
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  const search = vi.fn().mockResolvedValue({ unbundle: () => [claim] });
  const create = vi.fn();
  return { oystehr: { fhir: { search, transaction, create } } as unknown as Oystehr, transaction, search, create };
};

// The status change now commits as a transaction: a JSON-Patch Binary against the claim plus a
// Provenance. Pull the patched /meta/tag array out of the Binary's base64-encoded operations.
const patchBinaryRequest = (transaction: ReturnType<typeof vi.fn>): any =>
  transaction.mock.calls[0][0].requests.find((r: any) => r.resource?.resourceType === 'Binary');

const patchedTags = (transaction: ReturnType<typeof vi.fn>): { system: string; code: string }[] => {
  const ops = JSON.parse(Buffer.from(patchBinaryRequest(transaction).resource.data, 'base64').toString('utf-8'));
  return ops[0].value;
};

describe('set-billing-claim-status performEffect', () => {
  it('sets AR Stage and auto-initializes the stage progress status', async () => {
    const { oystehr, transaction } = makeOystehr(makeClaim());
    await performEffect(
      oystehr,
      { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.insurancePayer, secrets },
      agent
    );
    const tags = patchedTags(transaction);
    expect(tags).toContainEqual({ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer });
    expect(tags).toContainEqual({ system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' });
  });

  it('does not overwrite an already-set progress status when re-entering an AR Stage', async () => {
    const existing = [{ system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'submitted' }];
    const { oystehr, transaction } = makeOystehr(makeClaim(existing));
    await performEffect(
      oystehr,
      { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.insurancePayer, secrets },
      agent
    );
    const tags = patchedTags(transaction);
    expect(tags).toContainEqual({ system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'submitted' });
    expect(tags.filter((t) => t.system === CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus)).toHaveLength(1);
  });

  it('replaces only the targeted field and preserves other tags', async () => {
    const existing = [
      { system: 'current-status', code: 'open' },
      { system: CLAIM_STATUS_TAG_SYSTEMS.patientPaidStatus, code: 'unpaid' },
    ];
    const { oystehr, transaction } = makeOystehr(makeClaim(existing));
    await performEffect(
      oystehr,
      { claimId: 'claim-1', field: 'patientPaidStatus', value: 'fully-paid', secrets },
      agent
    );
    const tags = patchedTags(transaction);
    expect(tags).toContainEqual({ system: 'current-status', code: 'open' });
    expect(tags).toContainEqual({ system: CLAIM_STATUS_TAG_SYSTEMS.patientPaidStatus, code: 'fully-paid' });
    expect(tags.filter((t) => t.system === CLAIM_STATUS_TAG_SYSTEMS.patientPaidStatus)).toHaveLength(1);
  });

  it('clears a field when the value is null', async () => {
    const existing = [{ system: CLAIM_STATUS_TAG_SYSTEMS.patientPaidStatus, code: 'unpaid' }];
    const { oystehr, transaction } = makeOystehr(makeClaim(existing));
    await performEffect(oystehr, { claimId: 'claim-1', field: 'patientPaidStatus', value: null, secrets }, agent);
    const tags = patchedTags(transaction);
    expect(tags.some((t) => t.system === CLAIM_STATUS_TAG_SYSTEMS.patientPaidStatus)).toBe(false);
  });

  it('throws and does not write when the value is invalid for the field', async () => {
    const { oystehr, transaction, search } = makeOystehr(makeClaim());
    await expect(
      performEffect(oystehr, { claimId: 'claim-1', field: 'arStage', value: 'bogus', secrets }, agent)
    ).rejects.toThrow();
    expect(search).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('passes the optimistic locking version id as an ifMatch header', async () => {
    const { oystehr, transaction } = makeOystehr(makeClaim());
    await performEffect(oystehr, { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.patient, secrets }, agent);
    expect(patchBinaryRequest(transaction).ifMatch).toEqual('W/"v1"');
  });
});

describe('set-billing-claim-status holds the claim on AR stage entry', () => {
  it('applies the Hold tag alongside the stage change when a claim enters Non-insurance Payer AR', async () => {
    const { oystehr, transaction, create } = makeOystehr(makeClaim());
    await performEffect(
      oystehr,
      { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.nonInsurancePayer, secrets },
      agent
    );
    const tags = patchedTags(transaction);
    expect(tags).toContainEqual({ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.nonInsurancePayer });
    expect(tags).toContainEqual(HOLD_TAG);
    // One transaction: the Hold tag and the stage change land in the same write + history record.
    expect(transaction).toHaveBeenCalledTimes(1);
    // No rules engine runs on a stage change — the biller triggers it from the claim detail page.
    expect(create).not.toHaveBeenCalled();
  });

  it('holds on entry to every stage, including Insurance Payer AR (never auto-submits)', async () => {
    for (const stage of [AR_STAGE.insurancePayer, AR_STAGE.patient]) {
      const { oystehr, transaction, create } = makeOystehr(makeClaim());
      await performEffect(oystehr, { claimId: 'claim-1', field: 'arStage', value: stage, secrets }, agent);
      expect(patchedTags(transaction)).toContainEqual(HOLD_TAG);
      expect(create).not.toHaveBeenCalled();
    }
  });

  it('does not duplicate the Hold tag when the claim entering a stage is already held', async () => {
    const { oystehr, transaction } = makeOystehr(makeClaim([HOLD_TAG]));
    await performEffect(oystehr, { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.patient, secrets }, agent);
    const holdTags = patchedTags(transaction).filter((t) => t.system === HOLD_TAG.system && t.code === HOLD_TAG.code);
    expect(holdTags).toHaveLength(1);
  });

  it('does not hold when the AR stage is re-set to its current value', async () => {
    const claim = makeClaim([{ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.nonInsurancePayer }]);
    const { oystehr, transaction } = makeOystehr(claim);
    await performEffect(
      oystehr,
      { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.nonInsurancePayer, secrets },
      agent
    );
    expect(patchedTags(transaction)).not.toContainEqual(HOLD_TAG);
  });

  it('does not hold when the AR stage is cleared', async () => {
    const claim = makeClaim([{ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.nonInsurancePayer }]);
    const { oystehr, transaction } = makeOystehr(claim);
    await performEffect(oystehr, { claimId: 'claim-1', field: 'arStage', value: null, secrets }, agent);
    expect(patchedTags(transaction)).not.toContainEqual(HOLD_TAG);
  });

  it('does not hold for a non-arStage status change', async () => {
    const claim = makeClaim([{ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.nonInsurancePayer }]);
    const { oystehr, transaction } = makeOystehr(claim);
    await performEffect(
      oystehr,
      { claimId: 'claim-1', field: 'nonInsuranceArStatus', value: 'ready-to-invoice', secrets },
      agent
    );
    expect(patchedTags(transaction)).not.toContainEqual(HOLD_TAG);
  });
});
