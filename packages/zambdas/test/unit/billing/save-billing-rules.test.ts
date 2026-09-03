import Oystehr from '@oystehr/sdk';
import { Basic, Bundle, List, Organization, Resource } from 'fhir/r4b';
import { DEFAULT_RULES_ENGINE, RulesEngineType } from 'utils/lib/types/data/billing/rules-engine.constants';
import { BillingRuleInput } from 'utils/lib/types/data/billing/rules-engine.schemas';
import {
  AUTO_ACCIDENT_TAG_NAME,
  HOLD_TAG_NAME,
  SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
  SECONDARY_SUBMISSION_TAG_NAME,
  SYSTEM_MANAGED_TAGS,
} from 'utils/lib/types/data/billing/system-tags';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RULES_ENGINE_FHIR, RULES_ENGINE_TAG_SYSTEM } from '../../../src/billing/rules-engine/constants';
import { complexValidation, performEffect } from '../../../src/billing/save-billing-rules';
import { SaveBillingRulesParams } from '../../../src/billing/save-billing-rules/validateRequestParameters';
import { BILLING_WORKING_COPY_TAG, PROVIDER_ROLE_TAG, TAG_IS_SYSTEM_TAG_URL } from '../../../src/billing/shared';

const search = vi.fn();
const create = vi.fn();
const update = vi.fn();
const batch = vi.fn();
const oystehr = { fhir: { search, create, update, batch } } as unknown as Oystehr;

const rule = (name: string, id?: string): BillingRuleInput => ({
  ...(id ? { id } : {}),
  name,
  description: '',
  enabled: true,
  conditional: { branches: [{ condition: { type: 'all' }, outcome: { type: 'noop' } }] },
});

const params = (
  rules: BillingRuleInput[],
  expectedVersionId?: string,
  engine: RulesEngineType = DEFAULT_RULES_ENGINE
): SaveBillingRulesParams => ({ engine, rules, expectedVersionId, secrets: null }) as SaveBillingRulesParams;

describe('save-billing-rules performEffect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Echo the written List back (as the server would), stamping a versionId.
    create.mockImplementation(async (resource: List | Basic) => ({ ...resource, meta: { versionId: '1' } }));
    update.mockImplementation(async (resource: List) => ({ ...resource, meta: { versionId: '2' } }));
    // ensureSystemManagedTags' tag lookup: no tags exist yet.
    search.mockResolvedValue({ unbundle: () => [] });
  });

  it('assigns server-side ids to rules that arrive without one', async () => {
    const response = await performEffect(
      oystehr,
      params([rule('New rule'), rule('Existing', 'rule-1')]),
      undefined,
      'test'
    );

    expect(response.rules).toHaveLength(2);
    const [created, existing] = response.rules;
    expect(created.id).toBeTruthy();
    expect(created.id).not.toBe('rule-1');
    expect(existing.id).toBe('rule-1');
    // The ids are baked into the stored List (contained Basics + entry references).
    const savedList = create.mock.calls.find(([r]) => r.resourceType === 'List')?.[0] as List;
    expect(savedList.entry?.map((e) => e.item?.reference)).toEqual([`#${created.id}`, '#rule-1']);
  });

  it('creates the List and seeds every system-managed tag when no rules List exists yet', async () => {
    const response = await performEffect(oystehr, params([rule('First rule')]), undefined, 'test');

    expect(update).not.toHaveBeenCalled();
    const createdTypes = create.mock.calls.map(([r]) => r.resourceType);
    expect(createdTypes).toContain('List');
    const seededTags = create.mock.calls.map(([r]) => r).filter((r): r is Basic => r.resourceType === 'Basic');
    expect(seededTags.map((tag) => tag.code?.text)).toEqual(SYSTEM_MANAGED_TAGS.map((def) => def.name));
    seededTags.forEach((tag) => {
      expect(tag.extension).toContainEqual({ url: TAG_IS_SYSTEM_TAG_URL, valueBoolean: true });
    });
    expect(response.versionId).toBe('1');
  });

  it('seeds only the system-managed tags that are missing', async () => {
    search.mockResolvedValue({ unbundle: () => [{ resourceType: 'Basic', code: { text: HOLD_TAG_NAME } }] });

    await performEffect(oystehr, params([rule('First rule')]), undefined, 'test');

    const seededTags = create.mock.calls.map(([r]) => r).filter((r): r is Basic => r.resourceType === 'Basic');
    expect(seededTags.map((tag) => tag.code?.text)).toEqual([
      AUTO_ACCIDENT_TAG_NAME,
      SECONDARY_SUBMISSION_TAG_NAME,
      SECONDARY_SUBMISSION_CROSSOVER_TAG_NAME,
    ]);
  });

  it('does not re-seed system-managed tags that already exist', async () => {
    search.mockResolvedValue({
      unbundle: () => SYSTEM_MANAGED_TAGS.map((def) => ({ resourceType: 'Basic', code: { text: def.name } })),
    });

    await performEffect(oystehr, params([rule('First rule')]), undefined, 'test');

    expect(create.mock.calls.map(([r]) => r.resourceType)).toEqual(['List']);
  });

  it('updates the existing List with optimistic locking from expectedVersionId', async () => {
    const existing: List = { resourceType: 'List', id: 'list-1', status: 'current', mode: 'working' };

    const response = await performEffect(oystehr, params([rule('Renamed', 'rule-1')], 'v41'), existing, 'test');

    expect(create).not.toHaveBeenCalled();
    const [written, options] = update.mock.calls[0];
    expect(written.id).toBe('list-1');
    expect(options).toEqual({ optimisticLockingVersionId: 'v41' });
    expect(response.versionId).toBe('2');
    expect(response.rules.map((r) => r.name)).toEqual(['Renamed']);
  });

  it("stores each engine's rules in a List tagged with that engine's code", async () => {
    await performEffect(
      oystehr,
      params([rule('NI rule')], undefined, 'non-insurance-payer-pre-invoice'),
      undefined,
      'test'
    );

    const savedList = create.mock.calls.find(([r]) => r.resourceType === 'List')?.[0] as List;
    expect(savedList.meta?.tag).toContainEqual({
      system: RULES_ENGINE_TAG_SYSTEM,
      code: RULES_ENGINE_FHIR['non-insurance-payer-pre-invoice'].listCode,
    });
    expect(savedList.title).toBe(RULES_ENGINE_FHIR['non-insurance-payer-pre-invoice'].listTitle);
  });
});

describe('save-billing-rules complexValidation (applied tags must exist)', () => {
  const tagRule = (name: string, tag: string): BillingRuleInput => ({
    name,
    description: '',
    enabled: true,
    conditional: {
      branches: [{ condition: { type: 'all' }, outcome: { type: 'actions', actions: [{ type: 'applyTag', tag }] } }],
    },
  });

  const tagBasic = (name: string): Basic => ({
    resourceType: 'Basic',
    code: { text: name, coding: [{ system: 'https://fhir.ottehr.com/billing/tag', code: 'tag' }] },
  });

  const mockSearches = (tags: Basic[]): void => {
    search.mockImplementation(async ({ resourceType }: { resourceType: string }) => ({
      unbundle: () => (resourceType === 'Basic' ? tags : []),
    }));
  };

  beforeEach(() => vi.clearAllMocks());

  it('passes when every applied tag is defined in the tags feature', async () => {
    mockSearches([tagBasic('VIP')]);
    await expect(complexValidation(oystehr, params([tagRule('Tag it', 'VIP')]))).resolves.toBeUndefined();
    expect(search.mock.calls.filter(([q]) => q.resourceType === 'Basic')).toHaveLength(1);
  });

  it('rejects an unknown tag, naming the rule and the tag', async () => {
    mockSearches([tagBasic('VIP')]);
    await expect(complexValidation(oystehr, params([tagRule('Bad rule', 'Nope')]))).rejects.toThrow(
      /rule "Bad rule" applies unknown tag "Nope"/
    );
  });

  it('always allows system-managed tags, without even searching for tag definitions', async () => {
    mockSearches([]);
    await expect(
      complexValidation(
        oystehr,
        params([tagRule('Hold it', HOLD_TAG_NAME), tagRule('Mark accident', AUTO_ACCIDENT_TAG_NAME)])
      )
    ).resolves.toBeUndefined();
    expect(search.mock.calls.filter(([q]) => q.resourceType === 'Basic')).toHaveLength(0);
  });

  it('runs at most one tag search for many rules', async () => {
    mockSearches([tagBasic('VIP'), tagBasic('Audit')]);
    await expect(
      complexValidation(oystehr, params([tagRule('A', 'VIP'), tagRule('B', 'Audit'), tagRule('C', 'VIP')]))
    ).resolves.toBeUndefined();
    expect(search.mock.calls.filter(([q]) => q.resourceType === 'Basic')).toHaveLength(1);
  });
});

describe('save-billing-rules complexValidation (provider/facility refs must exist)', () => {
  const refRule = (name: string, field: string, ref: string): BillingRuleInput => ({
    name,
    description: '',
    enabled: true,
    conditional: {
      branches: [
        {
          condition: { type: 'all' },
          outcome: { type: 'actions', actions: [{ type: 'setField', field, value: ref }] },
        },
      ],
    },
  });

  // The shape getResourcesFromBatchInlineRequests parses: a batch-response of searchset bundles.
  const batchResponse = (resources: Resource[]): Bundle => ({
    resourceType: 'Bundle',
    type: 'batch-response',
    entry: resources.map((resource) => ({
      response: { status: '200', outcome: { resourceType: 'OperationOutcome' as const, id: 'ok', issue: [] } },
      resource: { resourceType: 'Bundle', type: 'searchset', entry: [{ resource }] } as Bundle,
    })),
  });

  const org = (id: string, roles: string[]): Organization => ({
    resourceType: 'Organization',
    id,
    name: `Org ${id}`,
    meta: { tag: roles.map((code) => ({ system: PROVIDER_ROLE_TAG, code })) },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    search.mockResolvedValue({ unbundle: () => [] });
  });

  it('passes when the referenced provider exists with the role the field targets', async () => {
    batch.mockResolvedValue(batchResponse([org('org-1', ['billing'])]));
    await expect(
      complexValidation(oystehr, params([refRule('Swap', 'billingProvider.ref', 'Organization/org-1')]))
    ).resolves.toBeUndefined();
    expect(batch).toHaveBeenCalledTimes(1);
  });

  it('rejects a reference to a resource that does not exist, naming the rule and field', async () => {
    batch.mockResolvedValue(batchResponse([]));
    await expect(
      complexValidation(oystehr, params([refRule('Swap', 'serviceFacility.ref', 'Location/gone')]))
    ).rejects.toThrow(/rule "Swap" sets "serviceFacility\.ref" to Location\/gone — no such resource exists/);
  });

  it('rejects a per-claim working copy — rules must reference the shared resources', async () => {
    const copy = org('copy-1', ['billing']);
    copy.meta!.tag!.push({ system: BILLING_WORKING_COPY_TAG.system, code: BILLING_WORKING_COPY_TAG.code });
    batch.mockResolvedValue(batchResponse([copy]));
    await expect(
      complexValidation(oystehr, params([refRule('Swap', 'billingProvider.ref', 'Organization/copy-1')]))
    ).rejects.toThrow(/working copy/);
  });

  it('rejects a provider that is not tagged with the role the field targets', async () => {
    batch.mockResolvedValue(batchResponse([org('org-1', ['billing'])]));
    await expect(
      complexValidation(oystehr, params([refRule('Swap', 'renderingProvider.ref', 'Organization/org-1')]))
    ).rejects.toThrow(/not tagged as a rendering provider/);
  });

  it('skips the lookup entirely when no rule sets a provider or facility', async () => {
    await expect(complexValidation(oystehr, params([rule('Plain')]))).resolves.toBeUndefined();
    expect(batch).not.toHaveBeenCalled();
  });
});
