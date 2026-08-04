import Oystehr from '@oystehr/sdk';
import { ChargeItemDefinition, Claim, Organization, ProvenanceAgent } from 'fhir/r4b';
import {
  AR_STAGE,
  BillingRule,
  CLAIM_PROVENANCE_CHANGE_REF_URL,
  CLAIM_PROVENANCE_DIFF_EXTENSION_URL,
  CLAIM_TAG_SYSTEM,
  claimStatusValuesToTags,
  CPT_CODE_SYSTEM,
  getPayerUrl,
  HOLD_TAG_NAME,
  withArStageInitialization,
} from 'utils';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RulesEngineClaimModel, writeField } from '../../../src/billing/rules-engine/claim-model';
import { rulesToList } from '../../../src/billing/rules-engine/serialization';
import {
  BILLING_WORKING_COPY_TAG,
  CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM,
  CHARGE_ITEM_DEFINITION_TYPE_SYSTEM,
  PROVIDER_ROLE_TAG,
} from '../../../src/billing/shared';
import {
  complexValidation,
  ensureClaimHeld,
  performEffect,
  persistModel,
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
      { engine: 'claim-submission', claimId: 'claim-1', rules: [], model },
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
      { engine: 'claim-submission', claimId: 'claim-1', rules, model },
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
      { engine: 'claim-submission', claimId: 'claim-1', rules: [], model },
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
      { engine: 'claim-submission', claimId: 'claim-1', rules: [], model },
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
      { engine: 'claim-submission', claimId: 'claim-1', rules: [rule], model },
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
  });

  it('holds the claim and fails the task when a rule action cannot be applied', async () => {
    const { oystehr, transaction, submitClaimRcm } = makeOystehrMock();
    const model = makeModel(AR_STAGE.insurancePayer); // no rendering provider on the model
    const rule = alwaysRule('bad', {
      type: 'actions',
      actions: [{ type: 'setField', field: 'renderingProvider.npi', value: '5555555555' }],
    });

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules: [rule], model },
      AGENT
    );

    expect(result.taskStatus).toBe('failed');
    expect(result.statusReason).toContain('Rule "Rule bad" failed');
    expect(result.statusReason).toContain('held for review');
    expect(submitClaimRcm).not.toHaveBeenCalled();
    const requests = transaction.mock.calls[0][0].requests;
    const claimPut = requests.find(
      (r: { method: string; url: string }) => r.method === 'PUT' && r.url === 'Claim/claim-1'
    );
    expect(claimPut.resource.meta.tag).toContainEqual({ system: CLAIM_TAG_SYSTEM, code: HOLD_TAG_NAME });
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
      { engine: 'non-insurance-payer-pre-invoice', claimId: 'claim-1', rules: [], model },
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
      { engine: 'non-insurance-payer-pre-invoice', claimId: 'claim-1', rules: [], model },
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
      { engine: 'non-insurance-payer-pre-invoice', claimId: 'claim-1', rules: [], model },
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
      { engine: 'patient-ar-pre-invoice', claimId: 'claim-1', rules: [], model },
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
      { engine: 'patient-ar-pre-invoice', claimId: 'claim-1', rules: [], model },
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
      { engine: 'non-insurance-payer-pre-invoice', claimId: 'claim-1', rules: [rule], model },
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

    const validated = await complexValidation(oystehr, 'claim-submission', 'claim-1', 'test');

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

    const validated = await complexValidation(oystehr, 'claim-submission', 'claim-1', 'test');

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
      { engine: 'claim-submission', claimId: 'claim-1', rules: [priceRule], model },
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

  it('holds the claim instead of submitting when no charge master applies', async () => {
    const { oystehr, transaction, submitClaimRcm } = makeOystehrMock();
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

    const result = await performEffect(
      oystehr,
      { engine: 'claim-submission', claimId: 'claim-1', rules: [priceRule], model },
      AGENT
    );

    expect(result.taskStatus).toBe('failed');
    expect(result.statusReason).toContain('Rule "Rule price" failed');
    expect(submitClaimRcm).not.toHaveBeenCalled();
    const requests = transaction.mock.calls[0][0].requests;
    const claimPut = requests.find(
      (r: { method: string; url: string }) => r.method === 'PUT' && r.url === 'Claim/claim-1'
    );
    expect(claimPut.resource.meta.tag).toContainEqual(HOLD_TAG);
    // The failed pricing changed nothing else on the claim.
    expect(claimPut.resource.item[0].net).toEqual({ value: 5, currency: 'USD' });
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
