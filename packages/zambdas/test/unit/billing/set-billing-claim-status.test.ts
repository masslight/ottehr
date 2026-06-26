import Oystehr from '@oystehr/sdk';
import { Claim } from 'fhir/r4b';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { performEffect } from '../../../src/billing/set-billing-claim-status';

const secrets = null;

const makeClaim = (tag: { system: string; code: string }[] = []): Claim =>
  ({ resourceType: 'Claim', id: 'claim-1', meta: { versionId: 'v1', tag } }) as Claim;

const makeOystehr = (
  claim: Claim
): { oystehr: Oystehr; patch: ReturnType<typeof vi.fn>; search: ReturnType<typeof vi.fn> } => {
  const patch = vi.fn().mockResolvedValue({});
  const search = vi.fn().mockResolvedValue({ unbundle: () => [claim] });
  return { oystehr: { fhir: { search, patch } } as unknown as Oystehr, patch, search };
};

// The handler patches the full /meta/tag array; pull it out of the recorded call.
const patchedTags = (patch: ReturnType<typeof vi.fn>): { system: string; code: string }[] =>
  patch.mock.calls[0][0].operations[0].value;

describe('set-billing-claim-status performEffect', () => {
  it('sets AR Stage and auto-initializes the stage progress status', async () => {
    const { oystehr, patch } = makeOystehr(makeClaim());
    await performEffect(oystehr, { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.insurancePayer, secrets });
    const tags = patchedTags(patch);
    expect(tags).toContainEqual({ system: CLAIM_STATUS_TAG_SYSTEMS.arStage, code: AR_STAGE.insurancePayer });
    expect(tags).toContainEqual({ system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'created' });
  });

  it('does not overwrite an already-set progress status when re-entering an AR Stage', async () => {
    const existing = [{ system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'submitted' }];
    const { oystehr, patch } = makeOystehr(makeClaim(existing));
    await performEffect(oystehr, { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.insurancePayer, secrets });
    const tags = patchedTags(patch);
    expect(tags).toContainEqual({ system: CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus, code: 'submitted' });
    expect(tags.filter((t) => t.system === CLAIM_STATUS_TAG_SYSTEMS.insuranceArStatus)).toHaveLength(1);
  });

  it('replaces only the targeted field and preserves other tags', async () => {
    const existing = [
      { system: 'current-status', code: 'open' },
      { system: CLAIM_STATUS_TAG_SYSTEMS.patientPaidStatus, code: 'unpaid' },
    ];
    const { oystehr, patch } = makeOystehr(makeClaim(existing));
    await performEffect(oystehr, { claimId: 'claim-1', field: 'patientPaidStatus', value: 'fully-paid', secrets });
    const tags = patchedTags(patch);
    expect(tags).toContainEqual({ system: 'current-status', code: 'open' });
    expect(tags).toContainEqual({ system: CLAIM_STATUS_TAG_SYSTEMS.patientPaidStatus, code: 'fully-paid' });
    expect(tags.filter((t) => t.system === CLAIM_STATUS_TAG_SYSTEMS.patientPaidStatus)).toHaveLength(1);
  });

  it('clears a field when the value is null', async () => {
    const existing = [{ system: CLAIM_STATUS_TAG_SYSTEMS.patientPaidStatus, code: 'unpaid' }];
    const { oystehr, patch } = makeOystehr(makeClaim(existing));
    await performEffect(oystehr, { claimId: 'claim-1', field: 'patientPaidStatus', value: null, secrets });
    const tags = patchedTags(patch);
    expect(tags.some((t) => t.system === CLAIM_STATUS_TAG_SYSTEMS.patientPaidStatus)).toBe(false);
  });

  it('throws and does not patch when the value is invalid for the field', async () => {
    const { oystehr, patch, search } = makeOystehr(makeClaim());
    await expect(
      performEffect(oystehr, { claimId: 'claim-1', field: 'arStage', value: 'bogus', secrets })
    ).rejects.toThrow();
    expect(search).toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('passes the optimistic locking version id', async () => {
    const { oystehr, patch } = makeOystehr(makeClaim());
    await performEffect(oystehr, { claimId: 'claim-1', field: 'arStage', value: AR_STAGE.patient, secrets });
    expect(patch.mock.calls[0][1]).toEqual({ optimisticLockingVersionId: 'v1' });
  });
});
