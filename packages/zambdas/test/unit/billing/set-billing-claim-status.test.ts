import Oystehr from '@oystehr/sdk';
import { Claim, ProvenanceAgent, Task } from 'fhir/r4b';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { RULES_ENGINE_FHIR } from '../../../src/billing/rules-engine/constants';
import { performEffect } from '../../../src/billing/set-billing-claim-status';

// kickOffRulesEngine resolves the ENVIRONMENT secret before enqueueing; 'local' also short-circuits
// error reporting.
const secrets = { ENVIRONMENT: 'local' };
const agent: ProvenanceAgent = { who: { reference: 'Practitioner/test-user' } };

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
  const create = vi.fn().mockImplementation(async (resource: Task) => ({ ...resource, id: 'task-1' }));
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

describe('set-billing-claim-status rules-engine kickoff on AR stage entry', () => {
  const kickoffTaskCode = (create: ReturnType<typeof vi.fn>): string | undefined =>
    create.mock.calls.find(([r]) => r.resourceType === 'Task')?.[0]?.code?.coding?.[0]?.code;

  it('kicks off the non-insurance pre-invoice engine when a claim enters Non-insurance Payer AR', async () => {
    const { oystehr, create } = makeOystehr(makeClaim());
    await performEffect(
      oystehr,
      { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.nonInsurancePayer, secrets },
      agent
    );
    expect(kickoffTaskCode(create)).toBe(RULES_ENGINE_FHIR['non-insurance-payer-pre-invoice'].taskCode);
  });

  it('kicks off the patient pre-invoice engine when a self-pay claim enters Patient AR', async () => {
    const { oystehr, create } = makeOystehr(makeClaim());
    await performEffect(oystehr, { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.patient, secrets }, agent);
    expect(kickoffTaskCode(create)).toBe(RULES_ENGINE_FHIR['patient-ar-pre-invoice'].taskCode);
  });

  it('does not kick off the patient engine when the claim entering Patient AR has coverage', async () => {
    const claim = makeClaim();
    claim.insurance = [{ sequence: 1, focal: true, coverage: { reference: 'Coverage/cov-1' } }];
    const { oystehr, create } = makeOystehr(claim);
    await performEffect(oystehr, { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.patient, secrets }, agent);
    expect(create).not.toHaveBeenCalled();
  });

  it('never auto-submits: entering Insurance Payer AR does not kick off the claim submission engine', async () => {
    const { oystehr, create } = makeOystehr(makeClaim());
    await performEffect(
      oystehr,
      { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.insurancePayer, secrets },
      agent
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('does not re-kick the engine when the AR stage is unchanged', async () => {
    const claim = makeClaim([{ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.nonInsurancePayer }]);
    const { oystehr, create } = makeOystehr(claim);
    await performEffect(
      oystehr,
      { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.nonInsurancePayer, secrets },
      agent
    );
    expect(create).not.toHaveBeenCalled();
  });

  it('does not kick off an engine for a non-arStage status change', async () => {
    const claim = makeClaim([{ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.nonInsurancePayer }]);
    const { oystehr, create } = makeOystehr(claim);
    await performEffect(
      oystehr,
      { claimId: 'claim-1', field: 'nonInsuranceArStatus', value: 'ready-to-invoice', secrets },
      agent
    );
    expect(create).not.toHaveBeenCalled();
  });
});
