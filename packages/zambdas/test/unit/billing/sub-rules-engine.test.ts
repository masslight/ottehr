import Oystehr from '@oystehr/sdk';
import {
  Account,
  ChargeItemDefinition,
  Claim,
  Coverage,
  Organization,
  Patient,
  ProvenanceAgent,
  RelatedPerson,
} from 'fhir/r4b';
import { ACCOUNT_TYPE_CODE_SYSTEM, CPT_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { getPayerUrl } from 'utils/lib/helpers/helpers';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { BillingInsuranceType } from 'utils/lib/types/data/billing/billing.schemas';
import {
  CLAIM_PROVENANCE_CHANGE_REF_URL,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  ClaimFieldChange,
  ClaimHistoryRuleRef,
} from 'utils/lib/types/data/billing/claim-history';
import {
  AR_STAGE,
  claimStatusValuesToTags,
  withArStageInitialization,
} from 'utils/lib/types/data/billing/claim-status';
import { BillingRule } from 'utils/lib/types/data/billing/rules-engine.schemas';
import { HOLD_TAG_NAME } from 'utils/lib/types/data/billing/system-tags';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RulesEngineClaimModel, writeField } from '../../../src/billing/rules-engine/claim-model';
import { rulesToList } from '../../../src/billing/rules-engine/serialization';
import {
  BILLING_WORKING_COPY_TAG,
  CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM,
  CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
  PROVIDER_ROLE_TAG,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../../../src/billing/shared';
import {
  complexValidation,
  ensureClaimHeld,
  performEffect,
  persistModel,
  RuleFailureError,
  snapshotModel,
} from '../../../src/subscriptions/task/sub-rules-engine';

const AGENT: ProvenanceAgent = { who: { reference: 'Device/rules-engine-device' } };

const workingCopyTag = { system: BILLING_WORKING_COPY_TAG.system, code: BILLING_WORKING_COPY_TAG.code };

function makeOystehrMock(): {
  oystehr: Oystehr;
  search: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  submitClaimRcm: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn().mockResolvedValue({ unbundle: () => [] });
  const transaction = vi.fn().mockResolvedValue({ entry: [] });
  const submitClaimRcm = vi.fn().mockResolvedValue({});
  const oystehr = { fhir: { search, transaction }, rcm: { submitClaim: submitClaimRcm } } as unknown as Oystehr;
  return { oystehr, search, transaction, submitClaimRcm };
}

function makeModel(arStage: string = AR_STAGE.insurancePayer): RulesEngineClaimModel {
  return {
    claim: {
      resourceType: 'Claim',
      id: 'claim-1',
      status: 'draft',
      use: 'claim',
      type: { coding: [] },
      patient: { reference: 'Patient/p1' },
      created: '2026-01-01',
      provider: {},
      priority: { coding: [] },
      insurance: [],
      meta: { versionId: '1', tag: claimStatusValuesToTags(withArStageInitialization({ arStage })) },
    } as Claim,
    patient: {
      resourceType: 'Patient',
      id: 'patient-1',
      meta: { versionId: '1', tag: [workingCopyTag] },
      name: [{ given: ['Jane'], family: 'Doe' }],
    },
    coverages: [
      {
        resourceType: 'Coverage',
        id: 'coverage-1',
        meta: { versionId: '1', tag: [workingCopyTag] },
        status: 'active',
        beneficiary: { reference: 'Patient/patient-1' },
        payor: [{ reference: getPayerUrl('123456') }],
      },
    ],
    subscribers: [],
  };
}

const alwaysRule = (id: string, actions: BillingRule['conditional']['branches'][number]['outcome']): BillingRule => ({
  id,
  name: `Rule ${id}`,
  description: '',
  enabled: true,
  conditional: { branches: [{ condition: { type: 'all' }, outcome: actions }] },
});

const HOLD_TAG = { system: CLAIM_TAG_SYSTEM, code: HOLD_TAG_NAME };

// The stored diff JSON of the Provenance targeting `targetRef` (across all transactions).
const provenanceChanges = (transaction: ReturnType<typeof vi.fn>, targetRef: string): ClaimFieldChange[] => {
  for (const call of transaction.mock.calls) {
    for (const request of call[0].requests) {
      if (request.url !== '/Provenance' || request.resource?.target?.[0]?.reference !== targetRef) continue;
      const diff = (request.resource.extension ?? []).find(
        (e: { url: string }) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL
      );
      if (diff) return JSON.parse(diff.valueString);
    }
  }
  return [];
};

// A finalizer's status change travels as a base64 json-patch Binary; decode it to see the tags written.
const patchedTags = (transaction: ReturnType<typeof vi.fn>): { system: string; code: string }[] => {
  for (const call of transaction.mock.calls) {
    for (const request of call[0].requests) {
      if (request.method === 'PATCH' && request.resource?.resourceType === 'Binary') {
        const ops = JSON.parse(Buffer.from(request.resource.data, 'base64').toString());
        return ops.find((op: { path: string }) => op.path === '/meta/tag')?.value ?? [];
      }
    }
  }
  return [];
};

describe('sub-rules-engine performEffect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('submits the claim when all rules pass and it is in Insurance Payer AR', async () => {
    const { oystehr, search, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer);
    // submitClaim re-fetches the claim to lock the status patch against the latest version.
    search.mockResolvedValue({ unbundle: () => [model.claim] });

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules: [], model, skipRules: false },
      AGENT
    );

    expect(submitClaimRcm).toHaveBeenCalledWith({ claimId: 'claim-1' });
    expect(result.taskStatus).toBe('completed');
    expect(result.statusReason).toContain('submitted');
    // Status change (insuranceArStatus -> submitted) commits with its Provenance.
    expect(transaction).toHaveBeenCalled();
  });

  it('submits the claim when skipping rules and it is in Insurance Payer AR', async () => {
    const { oystehr, search, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer);
    // submitClaim re-fetches the claim to lock the status patch against the latest version.
    search.mockResolvedValue({ unbundle: () => [model.claim] });

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules: [], model, skipRules: true },
      AGENT
    );

    expect(submitClaimRcm).toHaveBeenCalledWith({ claimId: 'claim-1' });
    expect(result.taskStatus).toBe('completed');
    expect(result.statusReason).toContain('submitted');
    // Status change (insuranceArStatus -> submitted) commits with its Provenance.
    expect(transaction).toHaveBeenCalled();
  });

  it('fails and holds the claim instead of submitting when rules changed a shared (non-working-copy) resource', async () => {
    const { oystehr, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer);
    // Legacy/imported claim graph: the patient is a shared resource, not a per-claim working copy.
    model.patient!.meta = { versionId: '1' };
    const rules = [
      alwaysRule('r1', {
        type: 'actions',
        actions: [{ type: 'setField', field: 'patient.lastName', value: 'Corrected' }],
      }),
    ];

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules, model, skipRules: false },
      AGENT
    );

    // persistModel skips the shared-resource write; completing would submit the claim as if the
    // change had applied, so the run must fail and hold instead.
    expect(result.taskStatus).toBe('failed');
    expect(result.statusReason).toContain('Patient/patient-1');
    expect(result.statusReason).toContain('held');
    expect(submitClaimRcm).not.toHaveBeenCalled();
    const requests = transaction.mock.calls.flatMap((call) => call[0].requests);
    const claimPut = requests.find(
      (r: { method: string; url: string }) => r.method === 'PUT' && r.url === 'Claim/claim-1'
    );
    expect(claimPut.resource.meta.tag).toContainEqual(HOLD_TAG);
    expect(requests.some((r: { url: string }) => r.url.startsWith('Patient/'))).toBe(false);
  });

  it('lifts the Hold tag when a previously held claim passes and submits', async () => {
    const { oystehr, search, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer);
    model.claim.meta!.tag = [...(model.claim.meta?.tag ?? []), HOLD_TAG];
    search.mockResolvedValue({ unbundle: () => [model.claim] });

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules: [], model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('completed');
    expect(submitClaimRcm).toHaveBeenCalled();
    const tags = patchedTags(transaction);
    expect(tags).toContainEqual(
      expect.objectContaining({ system: expect.stringContaining('insurance-ar-status'), code: 'submitted' })
    );
    expect(tags).not.toContainEqual(HOLD_TAG);
  });

  it('completes without submitting when the claim is not in Insurance Payer AR', async () => {
    const { oystehr, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.patient);

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules: [], model, skipRules: false },
      AGENT
    );

    expect(submitClaimRcm).not.toHaveBeenCalled();
    expect(result.taskStatus).toBe('completed');
    expect(result.statusReason).toContain('not submitted');
  });

  it('fails the task and persists the Hold tag when a rule holds the claim', async () => {
    const { oystehr, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer);
    const rule = alwaysRule('hold', { type: 'actions', actions: [{ type: 'applyTag', tag: HOLD_TAG_NAME }] });

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules: [rule], model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('failed');
    expect(result.statusReason).toContain('Held by rule "Rule hold"');
    expect(submitClaimRcm).not.toHaveBeenCalled();
    // The changed claim (now carrying the Hold tag) is written with optimistic locking + Provenance.
    const requests = transaction.mock.calls[0][0].requests;
    const claimPut = requests.find(
      (r: { method: string; url: string }) => r.method === 'PUT' && r.url === 'Claim/claim-1'
    );
    expect(claimPut.ifMatch).toBe('W/"1"');
    expect(claimPut.resource.meta.tag).toContainEqual({ system: CLAIM_TAG_SYSTEM, code: HOLD_TAG_NAME });
    expect(requests.some((r: { url: string }) => r.url === '/Provenance')).toBe(true);
    // The history record attributes the Hold to the rule that applied it.
    expect(provenanceChanges(transaction, 'Claim/claim-1').find((c) => c.field === 'tags')?.rule).toEqual({
      id: 'hold',
      name: 'Rule hold',
      engine: 'claim-submission',
    });
  });

  it('attributes each change to the rule that made it, per resource, last writer winning', async () => {
    const { oystehr, search, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer);
    search.mockResolvedValue({ unbundle: () => [model.claim] }); // submitClaim's re-fetch
    const rules = [
      alwaysRule('r1', { type: 'actions', actions: [{ type: 'applyTag', tag: 'VIP' }] }),
      alwaysRule('r2', {
        type: 'actions',
        actions: [{ type: 'setField', field: 'patient.lastName', value: 'Smith' }],
      }),
      alwaysRule('r3', { type: 'actions', actions: [{ type: 'applyTag', tag: 'Reviewed' }] }),
    ];

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules, model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('completed');
    expect(submitClaimRcm).toHaveBeenCalled();
    const ruleRef = (id: string): ClaimHistoryRuleRef => ({ id, name: `Rule ${id}`, engine: 'claim-submission' });
    // The claim's combined tags change (VIP + Reviewed) spans r1 and r3; the last writer is recorded.
    const claimChanges = provenanceChanges(transaction, 'Claim/claim-1');
    expect(claimChanges.find((c) => c.field === 'tags')?.rule).toEqual(ruleRef('r3'));
    // The patient's name change belongs to r2 alone.
    const patientChanges = provenanceChanges(transaction, 'Patient/patient-1');
    expect(patientChanges).toEqual([
      { field: 'name', label: 'Name', previousValue: 'Doe, Jane', newValue: 'Smith, Jane', rule: ruleRef('r2') },
    ]);
  });

  it('holds the claim and fails the task when a rule action cannot be applied', async () => {
    const { oystehr, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer); // no rendering provider on the model
    const rule = alwaysRule('bad', {
      type: 'actions',
      actions: [{ type: 'setField', field: 'renderingProvider.npi', value: '5555555555' }],
    });

    await expect(
      async () =>
        await performEffect(
          oystehr,
          { engine: 'claim-submission', claimId: 'claim-1', rules: [rule], model, skipRules: false },
          AGENT
        )
    ).rejects.toMatchInlineSnapshot(
      `[Error: Rule "Rule bad" failed: could not set "renderingProvider.npi" — the field is unknown or read-only, the value is invalid, or the target is missing from this claim. The claim was held for review.]`
    );

    expect(submitClaimRcm).not.toHaveBeenCalled();
    const requests = transaction.mock.calls[0][0].requests;
    const claimPut = requests.find(
      (r: { method: string; url: string }) => r.method === 'PUT' && r.url === 'Claim/claim-1'
    );
    expect(claimPut.resource.meta.tag).toContainEqual({ system: CLAIM_TAG_SYSTEM, code: HOLD_TAG_NAME });
  });

  it('attributes the failure Hold to the failing rule and throws a RuleFailureError carrying it', async () => {
    const { oystehr, transaction } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer); // no rendering provider → the setField fails
    const rule = alwaysRule('bad', {
      type: 'actions',
      actions: [{ type: 'setField', field: 'renderingProvider.npi', value: '5555555555' }],
    });

    let thrown: unknown;
    try {
      await performEffect(
        oystehr,
        { engine: 'claim-submission', claimId: 'claim-1', rules: [rule], model, skipRules: false },
        AGENT
      );
    } catch (error) {
      thrown = error;
    }

    const expectedRule: ClaimHistoryRuleRef = { id: 'bad', name: 'Rule bad', engine: 'claim-submission' };
    expect(thrown).toBeInstanceOf(RuleFailureError);
    expect((thrown as RuleFailureError).rule).toEqual(expectedRule);
    // The persisted Hold's history record names the failing rule.
    expect(provenanceChanges(transaction, 'Claim/claim-1').find((c) => c.field === 'tags')?.rule).toEqual(expectedRule);
  });

  it("does not blame a rule for the engine's own unwritable-changes Hold", async () => {
    const { oystehr, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer);
    model.patient!.meta = { versionId: '1' }; // shared patient → its change is unwritable
    const rules = [
      alwaysRule('tagger', { type: 'actions', actions: [{ type: 'applyTag', tag: 'VIP' }] }),
      alwaysRule('shared', {
        type: 'actions',
        actions: [{ type: 'setField', field: 'patient.lastName', value: 'Corrected' }],
      }),
    ];

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules, model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('failed');
    expect(submitClaimRcm).not.toHaveBeenCalled();
    // The combined tags change (VIP + the engine's Hold) carries no rule — the Hold is the
    // engine's, and attributing it to "Rule tagger" would send the biller to the wrong rule.
    const tagsChange = provenanceChanges(transaction, 'Claim/claim-1').find((c) => c.field === 'tags');
    expect(tagsChange?.newValue).toContain(HOLD_TAG_NAME);
    expect(tagsChange?.rule).toBeUndefined();
  });
});

describe('pre-invoice engines performEffect', () => {
  beforeEach(() => vi.clearAllMocks());

  it('moves the Non-insurance AR Status to ready-to-invoice when all rules pass', async () => {
    const { oystehr, search, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.nonInsurancePayer);
    // markReadyToInvoice re-fetches the claim to lock the status patch against the latest version.
    search.mockResolvedValue({ unbundle: () => [model.claim] });

    const result = await performEffect(
      oystehr,
      { engine: 'non-insurance-payer-pre-invoice', claimId: 'claim-1', rules: [], model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('completed');
    expect(result.statusReason).toContain('Ready to invoice');
    expect(submitClaimRcm).not.toHaveBeenCalled();
    expect(patchedTags(transaction)).toContainEqual(
      expect.objectContaining({ system: expect.stringContaining('non-insurance-ar-status'), code: 'ready-to-invoice' })
    );
  });

  it('lifts the Hold tag when a previously held claim passes and becomes ready to invoice', async () => {
    const { oystehr, search, transaction } = makeOystehrMock();
    const model = makeModel(AR_STAGE.nonInsurancePayer);
    model.claim.meta!.tag = [...(model.claim.meta?.tag ?? []), HOLD_TAG];
    search.mockResolvedValue({ unbundle: () => [model.claim] });

    const result = await performEffect(
      oystehr,
      { engine: 'non-insurance-payer-pre-invoice', claimId: 'claim-1', rules: [], model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('completed');
    const tags = patchedTags(transaction);
    expect(tags).toContainEqual(
      expect.objectContaining({ system: expect.stringContaining('non-insurance-ar-status'), code: 'ready-to-invoice' })
    );
    expect(tags).not.toContainEqual(HOLD_TAG);
  });

  it('completes without a status change when the claim is no longer in Non-insurance Payer AR', async () => {
    const { oystehr, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer);

    const result = await performEffect(
      oystehr,
      { engine: 'non-insurance-payer-pre-invoice', claimId: 'claim-1', rules: [], model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('completed');
    expect(result.statusReason).toContain('not marked ready to invoice');
    expect(submitClaimRcm).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('moves the Patient AR Status to ready-to-invoice for a self-pay claim', async () => {
    const { oystehr, search, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.patient); // insurance: [] -> self-pay
    search.mockResolvedValue({ unbundle: () => [model.claim] });

    const result = await performEffect(
      oystehr,
      { engine: 'patient-ar-pre-invoice', claimId: 'claim-1', rules: [], model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('completed');
    expect(result.statusReason).toContain('Ready to invoice');
    expect(submitClaimRcm).not.toHaveBeenCalled();
    expect(patchedTags(transaction)).toContainEqual(
      expect.objectContaining({ system: expect.stringContaining('patient-ar-status'), code: 'ready-to-invoice' })
    );
  });

  it('completes without a status change when the Patient AR claim carries insurance coverage', async () => {
    const { oystehr, transaction } = makeOystehrMock();
    const model = makeModel(AR_STAGE.patient);
    model.claim.insurance = [{ sequence: 1, focal: true, coverage: { reference: 'Coverage/coverage-1' } }];

    const result = await performEffect(
      oystehr,
      { engine: 'patient-ar-pre-invoice', claimId: 'claim-1', rules: [], model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('completed');
    expect(result.statusReason).toContain('not self-pay');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('fails the task and holds the claim when a rule holds a pre-invoice run', async () => {
    const { oystehr, search, transaction } = makeOystehrMock();
    const model = makeModel(AR_STAGE.nonInsurancePayer);
    search.mockResolvedValue({ unbundle: () => [model.claim] });
    const rule = alwaysRule('hold', { type: 'actions', actions: [{ type: 'applyTag', tag: HOLD_TAG_NAME }] });

    const result = await performEffect(
      oystehr,
      { engine: 'non-insurance-payer-pre-invoice', claimId: 'claim-1', rules: [rule], model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('failed');
    expect(result.statusReason).toContain('Held by rule "Rule hold"');
    // No status change: only the model write (Hold tag) happened.
    expect(patchedTags(transaction)).toEqual([]);
    const requests = transaction.mock.calls[0][0].requests;
    const claimPut = requests.find(
      (r: { method: string; url: string }) => r.method === 'PUT' && r.url === 'Claim/claim-1'
    );
    expect(claimPut.resource.meta.tag).toContainEqual({ system: CLAIM_TAG_SYSTEM, code: HOLD_TAG_NAME });
  });
});

describe('sub-rules-engine charge master pricing', () => {
  beforeEach(() => vi.clearAllMocks());

  const priceRule = alwaysRule('price', {
    type: 'actions',
    actions: [{ type: 'applyChargeMasterPrices', match: { type: 'all' } }],
  });

  const selfPayChargeMaster: ChargeItemDefinition = {
    resourceType: 'ChargeItemDefinition',
    id: 'cid-self-pay',
    url: 'urn:uuid:charge-master:self-pay',
    title: 'self-pay default',
    status: 'active',
    date: '2025-06-01',
    meta: { tag: [{ system: CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM, code: 'self-pay' }] },
    propertyGroup: [
      {
        priceComponent: [
          {
            type: 'base',
            code: { coding: [{ system: CPT_CODE_SYSTEM, code: '99213' }] },
            amount: { value: 75, currency: 'USD' },
          },
        ],
      },
    ],
  };

  // complexValidation loads rules (List), the claim graph (Claim), and the prefetches; answer each
  // search by resource type.
  const dispatchSearch = (
    search: ReturnType<typeof vi.fn>,
    { rules, claim, chargeMasters }: { rules: BillingRule[]; claim: Claim; chargeMasters: ChargeItemDefinition[] }
  ): void => {
    search.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'List') {
        return Promise.resolve({ unbundle: () => [rulesToList('claim-submission', rules)] });
      }
      if (resourceType === 'Claim') return Promise.resolve({ unbundle: () => [claim] });
      if (resourceType === 'ChargeItemDefinition') return Promise.resolve({ unbundle: () => chargeMasters });
      return Promise.resolve({ unbundle: () => [] });
    });
  };

  const chargeMasterSearchCalls = (search: ReturnType<typeof vi.fn>): { resourceType: string; params: unknown }[] =>
    search.mock.calls.map((call) => call[0]).filter((arg) => arg.resourceType === 'ChargeItemDefinition');

  it('prefetches the default charge masters only when an enabled rule applies charge master prices', async () => {
    const { oystehr, search } = makeOystehrMock();
    dispatchSearch(search, { rules: [priceRule], claim: makeModel().claim, chargeMasters: [selfPayChargeMaster] });

    const validated = await complexValidation(oystehr, 'claim-submission', 'claim-1', 'test', null);

    expect(validated.model.chargeMasters).toEqual([selfPayChargeMaster]);
    const calls = chargeMasterSearchCalls(search);
    expect(calls).toHaveLength(1);
    // The shared charge-master identity filter (same as the charge master screen's list) plus the
    // pricing scoping.
    expect(calls[0].params).toContainEqual({
      name: '_tag',
      value: `${CHARGE_ITEM_DEFINITION_TYPE_SYSTEM}|charge-master`,
    });
    expect(calls[0].params).toContainEqual({
      name: '_tag',
      value: `${CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM}|insurance,${CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM}|self-pay`,
    });
    expect(calls[0].params).toContainEqual({ name: 'status', value: 'active' });
  });

  it('skips the prefetch when no enabled rule uses the action', async () => {
    const { oystehr, search } = makeOystehrMock();
    const tagRule = alwaysRule('tag', { type: 'actions', actions: [{ type: 'applyTag', tag: 'VIP' }] });
    const disabledPriceRule = { ...priceRule, enabled: false };
    dispatchSearch(search, {
      rules: [tagRule, disabledPriceRule],
      claim: makeModel().claim,
      chargeMasters: [selfPayChargeMaster],
    });

    const validated = await complexValidation(oystehr, 'claim-submission', 'claim-1', 'test', null);

    expect(validated.model.chargeMasters).toBeUndefined();
    expect(chargeMasterSearchCalls(search)).toHaveLength(0);
  });

  it('re-prices lines onto the claim PUT; charge masters are read-only and never written', async () => {
    const { oystehr, search, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer); // insurance: [] -> self-pay billing type
    model.claim.item = [
      {
        sequence: 1,
        productOrService: { coding: [{ code: '99213' }] },
        servicedPeriod: { start: '2026-01-05' },
        net: { value: 5, currency: 'USD' },
      },
    ];
    model.claim.total = { value: 5, currency: 'USD' };
    model.chargeMasters = [selfPayChargeMaster];
    search.mockResolvedValue({ unbundle: () => [model.claim] }); // submitClaim's re-fetch

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules: [priceRule], model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('completed');
    expect(submitClaimRcm).toHaveBeenCalledWith({ claimId: 'claim-1' });
    const requests = transaction.mock.calls.flatMap((call) => call[0].requests);
    const claimPut = requests.find(
      (r: { method: string; url: string }) => r.method === 'PUT' && r.url === 'Claim/claim-1'
    );
    expect(claimPut.resource.item[0].net).toEqual({ value: 75, currency: 'USD' });
    expect(claimPut.resource.total).toEqual({ value: 75, currency: 'USD' });
    // The shared ChargeItemDefinitions must never appear in the persistence transactions.
    expect(requests.some((r: { url: string }) => r.url.includes('ChargeItemDefinition'))).toBe(false);
  });

  it('submits with unchanged charges when no charge master applies (the action never holds)', async () => {
    const { oystehr, search, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer);
    model.claim.item = [
      {
        sequence: 1,
        productOrService: { coding: [{ code: '99213' }] },
        servicedPeriod: { start: '2026-01-05' },
        net: { value: 5, currency: 'USD' },
      },
    ];
    model.chargeMasters = []; // nothing designated
    search.mockResolvedValue({ unbundle: () => [model.claim] }); // submitClaim's re-fetch

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules: [priceRule], model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('completed');
    expect(submitClaimRcm).toHaveBeenCalledWith({ claimId: 'claim-1' });
    // The pricing action changed nothing, so no claim write was persisted and the line kept its charges.
    const requests = transaction.mock.calls.flatMap((call) => call[0].requests);
    expect(requests.some((r: { method: string; url: string }) => r.method === 'PUT' && r.url === 'Claim/claim-1')).toBe(
      false
    );
    expect(model.claim.item[0].net).toEqual({ value: 5, currency: 'USD' });
  });
});

describe('sub-rules-engine patient coverage context', () => {
  beforeEach(() => vi.clearAllMocks());

  const coverageRule = alwaysRule('cov', {
    type: 'actions',
    actions: [{ type: 'setField', field: 'insurance.coverageFromPatient', value: 'primary' }],
  });

  // The claim's working-copy patient; the source extension names the reference patient whose
  // coverages and accounts the context is built from.
  const workingPatient = (withSource: boolean): Patient => ({
    resourceType: 'Patient',
    id: 'p1',
    meta: { versionId: '1', tag: [workingCopyTag] },
    name: [{ given: ['Jane'], family: 'Doe' }],
    extension: withSource
      ? [{ url: SOURCE_IDENTIFIER_SYSTEM, valueReference: { reference: 'Patient/src-patient' } }]
      : undefined,
  });

  const srcPrimary: Coverage = {
    resourceType: 'Coverage',
    id: 'cov-src-primary',
    status: 'active',
    beneficiary: { reference: 'Patient/src-patient' },
    subscriber: { reference: 'RelatedPerson/rp-src' },
    subscriberId: 'PRIM-001',
    payor: [{ reference: getPayerUrl('111222') }],
    class: [{ type: { coding: [{ code: 'plan' }] }, value: '111222', name: 'Prime Health' }],
  };
  const srcSecondary: Coverage = {
    resourceType: 'Coverage',
    id: 'cov-src-secondary',
    status: 'active',
    beneficiary: { reference: 'Patient/src-patient' },
    subscriber: { reference: 'Patient/src-patient' },
    subscriberId: 'SEC-002',
    payor: [{ reference: getPayerUrl('333444') }],
  };
  const srcWcCancelled: Coverage = {
    resourceType: 'Coverage',
    id: 'cov-src-wc-cancelled',
    status: 'cancelled',
    beneficiary: { reference: 'Patient/src-patient' },
    subscriber: { reference: 'Patient/src-patient' },
    payor: [{ reference: getPayerUrl('999001') }],
  };
  const srcWcActive: Coverage = {
    resourceType: 'Coverage',
    id: 'cov-src-wc-active',
    status: 'active',
    beneficiary: { reference: 'Patient/src-patient' },
    subscriber: { reference: 'Patient/src-patient' },
    subscriberId: 'WC-789',
    payor: [{ reference: getPayerUrl('999001') }],
  };
  const rpSrc: RelatedPerson = {
    resourceType: 'RelatedPerson',
    id: 'rp-src',
    patient: { reference: 'Patient/src-patient' },
    name: [{ given: ['Sam'], family: 'Guardian' }],
    birthDate: '1975-02-02',
  };
  // PBILLACCT holds primary (priority 1) and secondary (priority 2); WCOMPACCT holds workers comp.
  const accounts: Account[] = [
    {
      resourceType: 'Account',
      id: 'acct-pbill',
      status: 'active',
      type: { coding: [{ system: ACCOUNT_TYPE_CODE_SYSTEM, code: 'PBILLACCT' }] },
      subject: [{ reference: 'Patient/src-patient' }],
      coverage: [
        { coverage: { reference: 'Coverage/cov-src-primary' }, priority: 1 },
        { coverage: { reference: 'Coverage/cov-src-secondary' }, priority: 2 },
      ],
    },
    {
      resourceType: 'Account',
      id: 'acct-wcomp',
      status: 'active',
      type: { coding: [{ system: ACCOUNT_TYPE_CODE_SYSTEM, code: 'WCOMPACCT' }] },
      subject: [{ reference: 'Patient/src-patient' }],
      coverage: [
        { coverage: { reference: 'Coverage/cov-src-wc-cancelled' }, priority: 1 },
        { coverage: { reference: 'Coverage/cov-src-wc-active' }, priority: 1 },
      ],
    },
  ];

  const dispatchContextSearch = (
    search: ReturnType<typeof vi.fn>,
    { rules, claim, patient }: { rules: BillingRule[]; claim: Claim; patient: Patient }
  ): void => {
    search.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'List') {
        return Promise.resolve({ unbundle: () => [rulesToList('claim-submission', rules)] });
      }
      if (resourceType === 'Claim') return Promise.resolve({ unbundle: () => [claim, patient] });
      if (resourceType === 'Coverage') {
        return Promise.resolve({ unbundle: () => [srcWcCancelled, srcPrimary, srcSecondary, srcWcActive] });
      }
      if (resourceType === 'RelatedPerson') return Promise.resolve({ unbundle: () => [rpSrc] });
      if (resourceType === 'Account') return Promise.resolve({ unbundle: () => accounts });
      return Promise.resolve({ unbundle: () => [] });
    });
  };

  const searchedTypes = (search: ReturnType<typeof vi.fn>): string[] =>
    search.mock.calls.map((call) => call[0].resourceType);

  it("builds the context from the reference patient's coverages and accounts, skipping cancelled ones", async () => {
    const { oystehr, search } = makeOystehrMock();
    dispatchContextSearch(search, { rules: [coverageRule], claim: makeModel().claim, patient: workingPatient(true) });

    const validated = await complexValidation(oystehr, 'claim-submission', 'claim-1', 'test', false);

    const context = validated.model.patientCoverageContext!;
    expect(context.byType.primary?.coverage.id).toBe('cov-src-primary');
    expect(context.byType.primary?.subscriber?.id).toBe('rp-src');
    expect(context.byType.secondary?.coverage.id).toBe('cov-src-secondary');
    expect(context.byType.secondary?.subscriber).toBeUndefined();
    // The cancelled workers-comp coverage is skipped; the active one takes the slot.
    expect(context.byType.workersComp?.coverage.id).toBe('cov-src-wc-active');
    expect([...context.typeByCoverageRef.entries()].sort()).toEqual([
      ['Coverage/cov-src-primary', 'primary'],
      ['Coverage/cov-src-secondary', 'secondary'],
      ['Coverage/cov-src-wc-active', 'workersComp'],
    ]);

    // The lookups are scoped to the reference patient and exclude per-claim working copies.
    const coverageCall = search.mock.calls.map((call) => call[0]).find((arg) => arg.resourceType === 'Coverage');
    expect(coverageCall.params).toContainEqual({ name: 'beneficiary', value: 'Patient/src-patient' });
    expect(coverageCall.params).toContainEqual({
      name: '_tag:not',
      value: `${BILLING_WORKING_COPY_TAG.system}|${BILLING_WORKING_COPY_TAG.code}`,
    });
  });

  it('prefetches for a rule that only references the field in a condition', async () => {
    const { oystehr, search } = makeOystehrMock();
    const conditionRule: BillingRule = {
      id: 'cond',
      name: 'Rule cond',
      description: '',
      enabled: true,
      conditional: {
        branches: [
          {
            condition: { type: 'field', field: 'insurance.coverageFromPatient', operator: 'notExists' },
            outcome: { type: 'actions', actions: [{ type: 'applyTag', tag: HOLD_TAG_NAME }] },
          },
        ],
      },
    };
    dispatchContextSearch(search, { rules: [conditionRule], claim: makeModel().claim, patient: workingPatient(true) });

    const validated = await complexValidation(oystehr, 'claim-submission', 'claim-1', 'test', false);

    expect(validated.model.patientCoverageContext).toBeDefined();
    expect(searchedTypes(search)).toContain('Coverage');
  });

  it('skips the prefetch when no enabled rule references the field, or the patient has no source', async () => {
    const { oystehr, search } = makeOystehrMock();
    const tagRule = alwaysRule('tag', { type: 'actions', actions: [{ type: 'applyTag', tag: 'VIP' }] });
    const disabledCoverageRule = { ...coverageRule, enabled: false };
    dispatchContextSearch(search, {
      rules: [tagRule, disabledCoverageRule],
      claim: makeModel().claim,
      patient: workingPatient(true),
    });

    let validated = await complexValidation(oystehr, 'claim-submission', 'claim-1', 'test', false);
    expect(validated.model.patientCoverageContext).toBeUndefined();
    expect(searchedTypes(search)).not.toContain('Coverage');
    expect(searchedTypes(search)).not.toContain('Account');

    // A rule that needs the context but a working-copy patient without a source stamp: the context
    // stays absent (the setField later fails the rule) and no lookups run.
    const second = makeOystehrMock();
    dispatchContextSearch(second.search, {
      rules: [coverageRule],
      claim: makeModel().claim,
      patient: workingPatient(false),
    });
    validated = await complexValidation(second.oystehr, 'claim-submission', 'claim-1', 'test', false);
    expect(validated.model.patientCoverageContext).toBeUndefined();
    expect(searchedTypes(second.search)).not.toContain('Coverage');
  });

  it('attaches the chosen coverage: copies POST with the claim update in one transaction, then submits', async () => {
    const { oystehr, search, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer);
    model.patientCoverageContext = {
      byType: { primary: { coverage: srcPrimary, subscriber: rpSrc } },
      typeByCoverageRef: new Map<string, BillingInsuranceType>([['Coverage/cov-src-primary', 'primary']]),
    };
    search.mockResolvedValue({ unbundle: () => [model.claim] }); // submitClaim's re-fetch

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules: [coverageRule], model, skipRules: false },
      AGENT
    );

    expect(result.taskStatus).toBe('completed');
    expect(submitClaimRcm).toHaveBeenCalledWith({ claimId: 'claim-1' });

    const covUrn = `urn:uuid:${model.coverages[0].id}`;
    const rpUrn = `urn:uuid:${model.subscribers[0].id}`;
    const requests = transaction.mock.calls.flatMap((call) => call[0].requests);

    // The coverage copy: POST with no id under its urn fullUrl, re-pointed at the claim's patient,
    // its subscriber referencing the policy-holder copy POSTed in the same transaction.
    const covPost = requests.find((r: { method: string; url: string }) => r.method === 'POST' && r.url === '/Coverage');
    expect(covPost.fullUrl).toBe(covUrn);
    expect(covPost.resource.id).toBeUndefined();
    expect(covPost.resource.meta.tag).toContainEqual(workingCopyTag);
    expect(covPost.resource.beneficiary).toEqual({ reference: 'Patient/p1' });
    expect(covPost.resource.subscriber).toEqual({ reference: rpUrn });
    const rpPost = requests.find(
      (r: { method: string; url: string }) => r.method === 'POST' && r.url === '/RelatedPerson'
    );
    expect(rpPost.fullUrl).toBe(rpUrn);
    expect(rpPost.resource.id).toBeUndefined();
    expect(rpPost.resource.patient).toEqual({ reference: 'Patient/p1' });

    // The claim points at the copy through the urn, with the payer display; the insurer follows.
    const claimPut = requests.find(
      (r: { method: string; url: string }) => r.method === 'PUT' && r.url === 'Claim/claim-1'
    );
    expect(claimPut.resource.insurance[0]).toEqual({
      sequence: 1,
      focal: true,
      coverage: { reference: covUrn, display: 'Prime Health (111222)' },
    });
    expect(claimPut.resource.insurer).toEqual({ reference: getPayerUrl('111222'), display: 'Prime Health (111222)' });

    // Each copy gets a create-Provenance targeting its urn (rewritten by the server).
    const createProvenances = requests.filter(
      (r: { url: string; resource: { activity?: { coding: { code: string }[] } } }) =>
        r.url === '/Provenance' && r.resource.activity?.coding?.[0]?.code === 'CREATE'
    );
    expect(
      createProvenances
        .map((r: { resource: { target: { reference: string }[] } }) => r.resource.target[0].reference)
        .sort()
    ).toEqual([covUrn, rpUrn].sort());

    // The diff JSONs never record the transient urns (references live in rewritable entities), and
    // the reference patient's originals are never written.
    const diffStrings = requests
      .filter((r: { url: string }) => r.url === '/Provenance')
      .flatMap((r: { resource: { extension?: { url: string; valueString: string }[] } }) =>
        (r.resource.extension ?? []).filter((e) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL)
      )
      .map((e: { valueString: string }) => e.valueString);
    expect(diffStrings.length).toBeGreaterThan(0);
    expect(diffStrings.join('')).not.toContain('urn:uuid');
    expect(
      requests.some(
        (r: { url?: string }) => (r.url ?? '').includes('cov-src-primary') || (r.url ?? '').includes('rp-src')
      )
    ).toBe(false);

    // Every change the rule made — the minted copies and the claim's re-point — is attributed to it.
    const covRuleRef: ClaimHistoryRuleRef = { id: 'cov', name: 'Rule cov', engine: 'claim-submission' };
    const covCreateChanges = provenanceChanges(transaction, covUrn);
    expect(covCreateChanges.length).toBeGreaterThan(0);
    covCreateChanges.forEach((change) => expect(change.rule).toEqual(covRuleRef));
    expect(provenanceChanges(transaction, 'Claim/claim-1').find((c) => c.field === 'coverage')?.rule).toEqual(
      covRuleRef
    );
  });

  it('holds the claim instead of submitting when the patient has no coverage of the chosen type', async () => {
    const { oystehr, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer);
    model.patientCoverageContext = { byType: {}, typeByCoverageRef: new Map() };

    // The rule fails, so the run throws — but the claim is persisted (held) first.
    await expect(
      async () =>
        await performEffect(
          oystehr,
          { engine: 'claim-submission', claimId: 'claim-1', rules: [coverageRule], model, skipRules: false },
          AGENT
        )
    ).rejects.toThrow('Rule "Rule cov" failed');

    expect(submitClaimRcm).not.toHaveBeenCalled();
    const requests = transaction.mock.calls[0][0].requests;
    const claimPut = requests.find(
      (r: { method: string; url: string }) => r.method === 'PUT' && r.url === 'Claim/claim-1'
    );
    expect(claimPut.resource.meta.tag).toContainEqual(HOLD_TAG);
    // The failed attach changed nothing else on the claim.
    expect(claimPut.resource.insurance).toEqual([]);
  });
});

describe('sub-rules-engine persistModel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('writes only resources the rules actually changed', async () => {
    const { oystehr, transaction } = makeOystehrMock();
    const model = makeModel();
    const snapshot = snapshotModel(model);
    model.patient!.name = [{ given: ['Janet'], family: 'Doe' }];

    const written = await persistModel(oystehr, model, snapshot, AGENT);

    expect(written).toBe(1);
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests.filter((r: { method: string }) => r.method === 'PUT')).toHaveLength(1);
    expect(requests[0].url).toBe('Patient/patient-1');
  });

  it('does not write anything (or open a transaction) when nothing changed', async () => {
    const { oystehr, transaction } = makeOystehrMock();
    const model = makeModel();
    const snapshot = snapshotModel(model);

    const written = await persistModel(oystehr, model, snapshot, AGENT);

    expect(written).toBe(0);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('refuses to write a changed resource that is not a working copy', async () => {
    const { oystehr, transaction } = makeOystehrMock();
    const model = makeModel();
    model.patient!.meta = { versionId: '1', tag: [] }; // shared resource, not a working copy
    const snapshot = snapshotModel(model);
    model.patient!.name = [{ given: ['Janet'], family: 'Doe' }];

    const written = await persistModel(oystehr, model, snapshot, AGENT);

    expect(written).toBe(0);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('creates writer-minted working copies and updates the claim in a single transaction', async () => {
    const { oystehr, transaction } = makeOystehrMock();
    const model = makeModel();
    // The claim already carries an old billing-provider working copy that the swap replaces.
    model.billingProvider = {
      resourceType: 'Organization',
      id: 'old-copy-1',
      name: 'Old Billing Group',
      meta: { versionId: '1', tag: [workingCopyTag] },
    };
    model.claim.provider = { reference: 'Organization/old-copy-1', display: 'Old Billing Group' };
    const snapshot = snapshotModel(model);

    const original: Organization = {
      resourceType: 'Organization',
      id: 'org-new',
      name: 'New Billing Group',
      meta: { tag: [{ system: PROVIDER_ROLE_TAG, code: 'billing' }] },
    };
    model.referenceResources = new Map([['Organization/org-new', original]]);
    expect(writeField(model, 'billingProvider.ref', 'Organization/org-new')).toBe(true);
    const localId = model.billingProvider.id!;
    const urn = `urn:uuid:${localId}`;

    const written = await persistModel(oystehr, model, snapshot, AGENT);

    expect(written).toBe(2); // the new copy + the claim
    // One atomic transaction: the copy's POST, its create-Provenance, the claim PUT, and the
    // claim's change-Provenance commit or fail together — no orphaned copies on a partial failure.
    expect(transaction).toHaveBeenCalledTimes(1);
    const requests = transaction.mock.calls[0][0].requests;

    // The copy: POST with no id, a urn fullUrl, the working-copy tag, and a create-Provenance
    // targeting that urn (rewritten by the server inside the transaction).
    const post = requests.find(
      (r: { method: string; url: string }) => r.method === 'POST' && r.url === '/Organization'
    );
    expect(post.fullUrl).toBe(urn);
    expect(post.resource.id).toBeUndefined();
    expect(post.resource.meta.tag).toContainEqual(workingCopyTag);
    const provenances = requests.filter((r: { url: string }) => r.url === '/Provenance');
    const createProvenance = provenances.find(
      (r: { resource: { activity: { coding: { code: string }[] } } }) => r.resource.activity.coding[0].code === 'CREATE'
    );
    expect(createProvenance.resource.target[0].reference).toBe(urn);

    // The claim PUT still references the urn — matching the POST's fullUrl is the contract; the
    // server rewrites it to the created id inside the transaction (the mock cannot emulate that).
    const claimPut = requests.find(
      (r: { method: string; url: string }) => r.method === 'PUT' && r.url === 'Claim/claim-1'
    );
    expect(claimPut.resource.provider).toEqual({ reference: urn, display: 'New Billing Group' });
    expect(
      requests.some((r: { method: string; url: string }) => r.method === 'PUT' && r.url.startsWith('Organization/'))
    ).toBe(false);

    // The claim's change-Provenance: the diff JSON carries no refs (and so no urns) — the urn lives
    // in a Reference-typed entity the server rewrites, tied to its change by the linking extension.
    const changeProvenance = provenances.find(
      (r: { resource: { activity: { coding: { code: string }[] } } }) => r.resource.activity.coding[0].code === 'UPDATE'
    );
    const diffString = changeProvenance.resource.extension.find(
      (e: { url: string }) => e.url === CLAIM_PROVENANCE_DIFF_EXTENSION_URL
    ).valueString;
    expect(diffString).not.toContain('urn:uuid');
    expect(JSON.parse(diffString)).toContainEqual({
      field: 'billingProvider',
      label: 'Billing Provider',
      previousValue: 'Old Billing Group',
      newValue: 'New Billing Group',
    });
    expect(changeProvenance.resource.entity).toContainEqual({
      role: 'derivation',
      what: { reference: urn },
      extension: [{ url: CLAIM_PROVENANCE_CHANGE_REF_URL, valueString: 'billingProvider|new|0' }],
    });
    expect(changeProvenance.resource.entity).toContainEqual({
      role: 'source',
      what: { reference: 'Organization/old-copy-1' },
      extension: [{ url: CLAIM_PROVENANCE_CHANGE_REF_URL, valueString: 'billingProvider|previous|0' }],
    });

    // The model keeps its placeholder id (nothing downstream needs the created id), and the
    // superseded old copy was left untouched (orphaned) — no request writes to it.
    expect(model.billingProvider.id).toBe(localId);
    expect(requests.some((r: { url: string }) => r.url.includes('old-copy-1'))).toBe(false);
  });
});

describe('sub-rules-engine ensureClaimHeld', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies the Hold tag (with Provenance) when the claim is not already held', async () => {
    const { oystehr, search, transaction } = makeOystehrMock();
    const claim = makeModel().claim;
    search.mockResolvedValue({ unbundle: () => [claim] });

    await ensureClaimHeld(oystehr, claim, AGENT);

    expect(transaction).toHaveBeenCalledTimes(1);
    const requests = transaction.mock.calls[0][0].requests;
    expect(requests.some((r: { url: string }) => r.url === '/Provenance')).toBe(true);
  });

  it('is a no-op when the claim already carries the Hold tag', async () => {
    const { oystehr, search, transaction } = makeOystehrMock();
    const claim = makeModel().claim;
    claim.meta!.tag = [...(claim.meta?.tag ?? []), { system: CLAIM_TAG_SYSTEM, code: HOLD_TAG_NAME }];
    search.mockResolvedValue({ unbundle: () => [claim] });

    await ensureClaimHeld(oystehr, claim, AGENT);

    expect(transaction).not.toHaveBeenCalled();
  });
});
