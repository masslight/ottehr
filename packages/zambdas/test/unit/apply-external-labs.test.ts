import { Encounter, List, Location, Procedure, ServiceRequest } from 'fhir/r4b';
import { chartDataTagSystem, CPT_CODE_SYSTEM } from 'utils/lib/fhir/constants';
import { locationIsEnabledForLabs } from 'utils/lib/helpers/labs/helpers';
import {
  FHIR_IDC10_VALUESET_SYSTEM,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  PSC_HOLD_CONFIG,
  STATIC_COMPENDIUM_LAB_GUID,
} from 'utils/lib/types/data/labs/labs.constants';
import {
  LabPaymentMethod,
  OrderableItemCptCode,
  OrderableItemSearchResult,
} from 'utils/lib/types/data/labs/labs.types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  collectExternalLabCptProcedures,
  findExternalLabPlans,
  getOrderingLocationFromEncounter,
  isExternalLabPlanServiceRequest,
  matchOrderableItemForPlan,
  parseExternalLabPlan,
} from '../../src/ehr/apply-template/apply-external-labs';
import { getOrderableItems } from '../../src/ehr/lab/shared/orderable-items';
import { TemplateEncounterResource } from '../../src/ehr/shared/template-helpers';

vi.mock('../../src/ehr/lab/shared/orderable-items', () => ({
  getOrderableItems: vi.fn(),
}));

vi.mock('utils/lib/ottehr-config/value-sets', async (importActual) => {
  const actual = await importActual<typeof import('utils/lib/ottehr-config/value-sets')>();
  return {
    ...actual,
    VALUE_SETS: {
      ...actual.VALUE_SETS,
      externalLabCptCodesToAddPerEncounter: [
        { value: '99001', label: 'Handling and/or conveyance of specimen for transfer to a laboratory' },
      ],
    },
  };
});

const EXTERNAL_LAB_PLAN_TAG = chartDataTagSystem('external-lab-template-plan');
const LAB_GUID = 'lab-guid-1';

const makePlan = (id: string, overrides: Partial<ServiceRequest> = {}): ServiceRequest => ({
  resourceType: 'ServiceRequest',
  id,
  status: 'active',
  intent: 'plan',
  subject: { reference: '#stub-patient' },
  code: {
    coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: '7788', display: 'CBC With Differential' }],
    text: 'CBC With Differential',
  },
  performer: [
    {
      identifier: { system: OYSTEHR_LAB_GUID_SYSTEM, value: LAB_GUID },
      display: 'Quest Diagnostics',
    },
  ],
  meta: { tag: [{ system: EXTERNAL_LAB_PLAN_TAG, code: 'external-lab-template-plan' }] },
  ...overrides,
});

const makeOrderableItem = (
  itemCode: string,
  labGuid = LAB_GUID,
  labName = 'Quest Diagnostics',
  cptCodes: OrderableItemCptCode[] = []
): OrderableItemSearchResult =>
  ({
    item: { itemCode, itemName: `Test ${itemCode}`, cptCodes },
    lab: { labGuid, labName, labType: 'reference', compendiumVersion: '1' },
  }) as unknown as OrderableItemSearchResult;

describe('isExternalLabPlanServiceRequest / findExternalLabPlans', () => {
  test('identifies a tagged plan-intent SR as an external lab plan', () => {
    expect(isExternalLabPlanServiceRequest(makePlan('plan-1'))).toBe(true);
  });

  test('rejects an order-intent SR even when tagged', () => {
    expect(isExternalLabPlanServiceRequest(makePlan('plan-1', { intent: 'order' }))).toBe(false);
  });

  test('rejects a plan SR without the external lab plan tag (e.g. in-house lab plan)', () => {
    const plan = makePlan('plan-1', {
      meta: { tag: [{ system: chartDataTagSystem('in-house-lab-template-plan'), code: 'in-house-lab-template-plan' }] },
    });
    expect(isExternalLabPlanServiceRequest(plan)).toBe(false);
  });

  test('findExternalLabPlans returns only external lab plans from List.contained', () => {
    const externalPlan = makePlan('plan-ext');
    const inHousePlan = makePlan('plan-ih', {
      meta: { tag: [{ system: chartDataTagSystem('in-house-lab-template-plan'), code: 'in-house-lab-template-plan' }] },
    });
    const templateList: List = {
      resourceType: 'List',
      status: 'current',
      mode: 'working',
      contained: [externalPlan, inHousePlan],
    };
    const plans = findExternalLabPlans(templateList);
    expect(plans).toHaveLength(1);
    expect(plans[0].id).toBe('plan-ext');
  });
});

describe('parseExternalLabPlan', () => {
  test('parses the full ordering payload off a plan', () => {
    const plan = makePlan('plan-1', {
      reasonCode: [
        {
          coding: [{ system: FHIR_IDC10_VALUESET_SYSTEM, code: 'J02.9', display: 'Acute pharyngitis' }],
          text: 'Acute pharyngitis',
        },
      ],
      note: [{ text: 'fasting required' }],
      orderDetail: [
        {
          coding: [{ system: PSC_HOLD_CONFIG.system, code: PSC_HOLD_CONFIG.code, display: PSC_HOLD_CONFIG.display }],
          text: PSC_HOLD_CONFIG.display,
        },
      ],
    });

    const parsed = parseExternalLabPlan(plan);
    expect(parsed).toEqual({
      planId: 'plan-1',
      labGuid: LAB_GUID,
      labName: 'Quest Diagnostics',
      itemCode: '7788',
      testName: 'CBC With Differential',
      dx: [{ code: 'J02.9', display: 'Acute pharyngitis', isPrimary: false }],
      note: 'fasting required',
      psc: true,
    });
  });

  test('a sparse plan parses with optional fields empty', () => {
    const parsed = parseExternalLabPlan(makePlan('plan-min'));
    expect(parsed).toMatchObject({
      dx: [],
      note: undefined,
      psc: false,
    });
  });

  test('returns null when the plan has no lab guid', () => {
    const plan = makePlan('plan-no-lab', { performer: [{ display: 'Some Lab' }] });
    expect(parseExternalLabPlan(plan)).toBeNull();
  });

  test('returns null when the plan has no orderable item code', () => {
    const plan = makePlan('plan-no-code', {
      code: { coding: [{ system: 'http://loinc.org', code: '1234-5' }] },
    });
    expect(parseExternalLabPlan(plan)).toBeNull();
  });

  test('joins multiple notes with blank lines', () => {
    const plan = makePlan('plan-notes', { note: [{ text: 'note one' }, { text: 'note two' }] });
    expect(parseExternalLabPlan(plan)?.note).toBe('note one\n\nnote two');
  });
});

describe('matchOrderableItemForPlan', () => {
  test('matches by item code and lab guid', () => {
    const items = [makeOrderableItem('1111'), makeOrderableItem('7788')];
    const match = matchOrderableItemForPlan(
      { labGuid: LAB_GUID, labName: 'Quest Diagnostics', itemCode: '7788' },
      items
    );
    expect(match?.item.itemCode).toBe('7788');
  });

  test('returns undefined when the test is no longer in the compendium', () => {
    const items = [makeOrderableItem('1111')];
    expect(
      matchOrderableItemForPlan({ labGuid: LAB_GUID, labName: 'Quest Diagnostics', itemCode: '7788' }, items)
    ).toBeUndefined();
  });

  test('returns undefined when the lab guid differs', () => {
    const items = [makeOrderableItem('7788', 'other-lab-guid')];
    expect(
      matchOrderableItemForPlan({ labGuid: LAB_GUID, labName: 'Quest Diagnostics', itemCode: '7788' }, items)
    ).toBeUndefined();
  });

  test('restores the plan lab name onto static-compendium matches', () => {
    // Generic/static-compendium labs share one labGuid and the orderable item
    // search reports the generic lab name; the saved lab name disambiguates
    // which lab Organization the order targets.
    const items = [makeOrderableItem('7788', STATIC_COMPENDIUM_LAB_GUID, 'Generic Lab')];
    const match = matchOrderableItemForPlan(
      { labGuid: STATIC_COMPENDIUM_LAB_GUID, labName: 'Sunrise Labs', itemCode: '7788' },
      items
    );
    expect(match?.lab.labName).toBe('Sunrise Labs');
  });

  test('does not rewrite the lab name for non-static labs', () => {
    const items = [makeOrderableItem('7788')];
    const match = matchOrderableItemForPlan(
      { labGuid: LAB_GUID, labName: 'Stale Saved Name', itemCode: '7788' },
      items
    );
    expect(match?.lab.labName).toBe('Quest Diagnostics');
  });
});

describe('getOrderingLocationFromEncounter / locationIsEnabledForLabs', () => {
  const makeLocation = (id: string, overrides: Partial<Location> = {}): Location => ({
    resourceType: 'Location',
    id,
    name: `Office ${id}`,
    ...overrides,
  });

  const makeEncounter = (locationIds: string[]): Encounter => ({
    resourceType: 'Encounter',
    id: 'enc-1',
    status: 'in-progress',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
    location: locationIds.map((id) => ({ location: { reference: `Location/${id}` } })),
  });

  test('resolves the encounter-referenced Location from the bundle', () => {
    const resources: TemplateEncounterResource[] = [makeLocation('loc-other'), makeLocation('loc-1')];
    const location = getOrderingLocationFromEncounter(makeEncounter(['loc-1']), resources);
    expect(location?.id).toBe('loc-1');
  });

  test('falls back to the first bundle Location when the encounter carries no location reference', () => {
    const resources: TemplateEncounterResource[] = [makeLocation('loc-only')];
    const location = getOrderingLocationFromEncounter(makeEncounter([]), resources);
    expect(location?.id).toBe('loc-only');
  });

  test('returns undefined when the bundle has no Locations', () => {
    expect(getOrderingLocationFromEncounter(makeEncounter(['loc-1']), [])).toBeUndefined();
  });

  test('a location with a lab account number identifier is lab-enabled', () => {
    const location = makeLocation('loc-1', {
      identifier: [
        { system: LAB_ACCOUNT_NUMBER_SYSTEM, value: 'ACCT-1', assigner: { reference: 'Organization/lab-org-1' } },
      ],
    });
    expect(locationIsEnabledForLabs(location)).toBe(true);
  });

  test('a location without lab account identifiers is not lab-enabled', () => {
    expect(locationIsEnabledForLabs(makeLocation('loc-1'))).toBe(false);
    expect(
      locationIsEnabledForLabs(
        makeLocation('loc-2', { identifier: [{ system: 'http://some-other-system.com', value: 'X' }] })
      )
    ).toBe(false);
  });

  test('a lab account identifier without an assigner does not count', () => {
    const location = makeLocation('loc-1', {
      identifier: [{ system: LAB_ACCOUNT_NUMBER_SYSTEM, value: 'ACCT-1' }],
    });
    expect(locationIsEnabledForLabs(location)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// collectExternalLabCptProcedures
// ---------------------------------------------------------------------------

const makeEncounterWithSubject = (): Encounter => ({
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'in-progress',
  class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB' },
  subject: { reference: 'Patient/pat-1' },
});

const makeTemplateListWithPlan = (plan: ServiceRequest): List => ({
  resourceType: 'List',
  status: 'current',
  mode: 'working',
  contained: [plan],
});

// Matches VALUE_SETS.externalLabCptCodesToAddPerEncounter[0].value in
// packages/utils/lib/ottehr-config/value-sets/index.ts
const PER_ENCOUNTER_CPT_CODE = '99001';

const makeExistingPerEncounterCptProcedure = (): Procedure => ({
  resourceType: 'Procedure',
  id: 'existing-per-encounter-cpt',
  subject: { reference: 'Patient/pat-1' },
  encounter: { reference: 'Encounter/enc-1' },
  status: 'completed',
  meta: { tag: [{ system: chartDataTagSystem('cpt-code'), code: 'cpt-code' }] },
  code: {
    coding: [
      {
        system: CPT_CODE_SYSTEM,
        code: PER_ENCOUNTER_CPT_CODE,
        display: 'Handling and/or conveyance of specimen for transfer to a laboratory',
      },
    ],
  },
});

const codesOnProcedures = (procedures: Procedure[]): (string | undefined)[] =>
  procedures.flatMap((p) => p.code?.coding ?? []).map((c) => c.code);

describe('collectExternalLabCptProcedures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('returns empty when action is skip', async () => {
    const plan = makePlan('plan-1');
    const result = await collectExternalLabCptProcedures(
      makeTemplateListWithPlan(plan),
      makeEncounterWithSubject(),
      [],
      'skip',
      'mock-token',
      LabPaymentMethod.ClientBill
    );
    expect(result.procedures).toHaveLength(0);
    expect(result.cptCodesToSkip.size).toBe(0);
    expect(getOrderableItems).not.toHaveBeenCalled();
  });

  test('returns empty when the template has no external lab plans', async () => {
    const emptyList: List = { resourceType: 'List', status: 'current', mode: 'working', contained: [] };
    const result = await collectExternalLabCptProcedures(
      emptyList,
      makeEncounterWithSubject(),
      [],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );
    expect(result.procedures).toHaveLength(0);
    expect(result.cptCodesToSkip.size).toBe(0);
  });

  test('builds one Procedure per CPT code on the matched item', async () => {
    vi.mocked(getOrderableItems).mockResolvedValueOnce([
      makeOrderableItem('7788', LAB_GUID, 'Quest Diagnostics', [
        { cptCode: '36415', serviceUnitsCount: 1 },
        { cptCode: '80053', serviceUnitsCount: null },
      ]),
    ]);

    const plan = makePlan('plan-1');
    // Pre-seed the per-encounter code as already on the chart so this test can
    // stay focused on the test-specific CPT codes — the per-encounter behavior
    // has its own dedicated tests below.
    const result = await collectExternalLabCptProcedures(
      makeTemplateListWithPlan(plan),
      makeEncounterWithSubject(),
      [makeExistingPerEncounterCptProcedure()],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );

    expect(result.procedures).toHaveLength(2);
    const codes = codesOnProcedures(result.procedures);
    expect(codes).toContain('36415');
    expect(codes).toContain('80053');
  });

  test('Procedure resources have the correct shape (subject, encounter, status, meta tag, CPT system)', async () => {
    vi.mocked(getOrderableItems).mockResolvedValueOnce([
      makeOrderableItem('7788', LAB_GUID, 'Quest Diagnostics', [{ cptCode: '36415', serviceUnitsCount: 1 }]),
    ]);

    const encounter = makeEncounterWithSubject();
    const result = await collectExternalLabCptProcedures(
      makeTemplateListWithPlan(makePlan('plan-1')),
      encounter,
      [makeExistingPerEncounterCptProcedure()],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );

    const proc = result.procedures[0] as Procedure;
    expect(proc.resourceType).toBe('Procedure');
    expect(proc.subject).toEqual(encounter.subject);
    expect(proc.encounter?.reference).toBe(`Encounter/${encounter.id}`);
    expect(proc.status).toBe('completed');
    expect(proc.meta?.tag?.some((t) => t.system === chartDataTagSystem('cpt-code'))).toBe(true);
    expect(proc.code?.coding?.[0]?.system).toBe(CPT_CODE_SYSTEM);
    expect(proc.code?.coding?.[0]?.code).toBe('36415');
  });

  test('cptCodesToSkip contains every code contributed (unique)', async () => {
    vi.mocked(getOrderableItems).mockResolvedValueOnce([
      makeOrderableItem('7788', LAB_GUID, 'Quest Diagnostics', [
        { cptCode: '36415', serviceUnitsCount: 1 },
        { cptCode: '80053', serviceUnitsCount: null },
      ]),
    ]);

    const result = await collectExternalLabCptProcedures(
      makeTemplateListWithPlan(makePlan('plan-1')),
      makeEncounterWithSubject(),
      [makeExistingPerEncounterCptProcedure()],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );

    expect(result.cptCodesToSkip).toContain('36415');
    expect(result.cptCodesToSkip).toContain('80053');
  });

  test('n plans with the same CPT code produce n Procedures (no dedup across plans)', async () => {
    // Both plans share a lab guid so they go in one fetch call returning two items.
    vi.mocked(getOrderableItems).mockResolvedValueOnce([
      makeOrderableItem('7788', LAB_GUID, 'Quest Diagnostics', [{ cptCode: '36415', serviceUnitsCount: 1 }]),
      makeOrderableItem('9999', LAB_GUID, 'Quest Diagnostics', [{ cptCode: '36415', serviceUnitsCount: 1 }]),
    ]);

    const planA = makePlan('plan-a');
    const planB = makePlan('plan-b', {
      code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: '9999', display: 'Other Test' }] },
    });
    const templateList: List = {
      resourceType: 'List',
      status: 'current',
      mode: 'working',
      contained: [planA, planB],
    };

    const result = await collectExternalLabCptProcedures(
      templateList,
      makeEncounterWithSubject(),
      [makeExistingPerEncounterCptProcedure()],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );

    // Two plans each contribute CPT 36415 → two Procedure resources
    const procedures = result.procedures.filter((p) => p.code?.coding?.some((c) => c.code === '36415'));
    expect(procedures).toHaveLength(2);
    // But the skip set is deduplicated
    expect(result.cptCodesToSkip.size).toBe(1);
  });

  test('gracefully skips a plan whose lab fetch failed', async () => {
    vi.mocked(getOrderableItems).mockRejectedValueOnce(new Error('network error'));

    const result = await collectExternalLabCptProcedures(
      makeTemplateListWithPlan(makePlan('plan-1')),
      makeEncounterWithSubject(),
      [],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );

    expect(result.procedures).toHaveLength(0);
    expect(result.cptCodesToSkip.size).toBe(0);
  });

  test('gracefully skips a plan whose test is no longer in the compendium', async () => {
    // Returns items for a different code — plan's 7788 won't match.
    vi.mocked(getOrderableItems).mockResolvedValueOnce([
      makeOrderableItem('OTHER', LAB_GUID, 'Quest Diagnostics', [{ cptCode: '36415', serviceUnitsCount: 1 }]),
    ]);

    const result = await collectExternalLabCptProcedures(
      makeTemplateListWithPlan(makePlan('plan-1')),
      makeEncounterWithSubject(),
      [],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );

    expect(result.procedures).toHaveLength(0);
  });

  test('returns parsedPlans so callers can skip re-parsing', async () => {
    vi.mocked(getOrderableItems).mockResolvedValueOnce([
      makeOrderableItem('7788', LAB_GUID, 'Quest Diagnostics', [{ cptCode: '36415', serviceUnitsCount: 1 }]),
    ]);

    const plan = makePlan('plan-1');
    const result = await collectExternalLabCptProcedures(
      makeTemplateListWithPlan(plan),
      makeEncounterWithSubject(),
      [],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );

    expect(result.parsedPlans).toHaveLength(1);
    expect(result.parsedPlans[0].planId).toBe('plan-1');
    expect(result.parsedPlans[0].labGuid).toBe(LAB_GUID);
    expect(result.parsedPlans[0].itemCode).toBe('7788');
  });

  test('returns itemsByLabGuid so callers can skip re-fetching the compendium', async () => {
    const fetchedItem = makeOrderableItem('7788', LAB_GUID, 'Quest Diagnostics', [
      { cptCode: '36415', serviceUnitsCount: 1 },
    ]);
    vi.mocked(getOrderableItems).mockResolvedValueOnce([fetchedItem]);

    const result = await collectExternalLabCptProcedures(
      makeTemplateListWithPlan(makePlan('plan-1')),
      makeEncounterWithSubject(),
      [],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );

    expect(result.itemsByLabGuid.size).toBe(1);
    const items = result.itemsByLabGuid.get(LAB_GUID);
    expect(Array.isArray(items)).toBe(true);
    expect((items as OrderableItemSearchResult[])[0].item.itemCode).toBe('7788');
  });

  test('returns empty parsedPlans and itemsByLabGuid when action is skip', async () => {
    const result = await collectExternalLabCptProcedures(
      makeTemplateListWithPlan(makePlan('plan-1')),
      makeEncounterWithSubject(),
      [],
      'skip',
      'mock-token',
      LabPaymentMethod.ClientBill
    );
    expect(result.parsedPlans).toHaveLength(0);
    expect(result.itemsByLabGuid.size).toBe(0);
  });

  test('returns empty warnings when all plans parse successfully', async () => {
    vi.mocked(getOrderableItems).mockResolvedValueOnce([
      makeOrderableItem('7788', LAB_GUID, 'Quest Diagnostics', [{ cptCode: '36415', serviceUnitsCount: 1 }]),
    ]);
    const result = await collectExternalLabCptProcedures(
      makeTemplateListWithPlan(makePlan('plan-1')),
      makeEncounterWithSubject(),
      [],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );
    expect(result.warnings).toHaveLength(0);
  });

  test('returns a warning for each malformed plan instead of silently dropping it', async () => {
    const malformedPlan = makePlan('bad-plan', { performer: [] }); // no lab guid → parseExternalLabPlan returns null
    const goodPlan = makePlan('good-plan');
    vi.mocked(getOrderableItems).mockResolvedValueOnce([
      makeOrderableItem('7788', LAB_GUID, 'Quest Diagnostics', [{ cptCode: '36415', serviceUnitsCount: 1 }]),
    ]);
    const list: List = {
      resourceType: 'List',
      status: 'current',
      mode: 'working',
      contained: [malformedPlan, goodPlan],
    };
    const result = await collectExternalLabCptProcedures(
      list,
      makeEncounterWithSubject(),
      [],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].section).toBe('externalLabs');
    expect(result.warnings[0].message).toMatch(/CBC With Differential/);
    // The valid plan still processed
    expect(result.parsedPlans).toHaveLength(1);
    expect(result.parsedPlans[0].planId).toBe('good-plan');
  });

  test('returns warnings (no fetch) when all plans are malformed', async () => {
    const malformedPlan = makePlan('bad-plan', { performer: [] });
    const list: List = {
      resourceType: 'List',
      status: 'current',
      mode: 'working',
      contained: [malformedPlan],
    };
    const result = await collectExternalLabCptProcedures(
      list,
      makeEncounterWithSubject(),
      [],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );
    expect(result.warnings).toHaveLength(1);
    expect(result.parsedPlans).toHaveLength(0);
    expect(getOrderableItems).not.toHaveBeenCalled();
  });

  test('returns empty warnings when action is skip', async () => {
    const result = await collectExternalLabCptProcedures(
      makeTemplateListWithPlan(makePlan('plan-1')),
      makeEncounterWithSubject(),
      [],
      'skip',
      'mock-token',
      LabPaymentMethod.ClientBill
    );
    expect(result.warnings).toHaveLength(0);
  });

  test('returns no test-specific CPT procedures when payment method is not client bill, but still adds the per-encounter code', async () => {
    for (const paymentMethod of [
      LabPaymentMethod.Insurance,
      LabPaymentMethod.SelfPay,
      LabPaymentMethod.WorkersComp,
      undefined,
    ]) {
      vi.mocked(getOrderableItems).mockResolvedValueOnce([
        makeOrderableItem('7788', LAB_GUID, 'Quest Diagnostics', [{ cptCode: '36415', serviceUnitsCount: 1 }]),
      ]);
      const result = await collectExternalLabCptProcedures(
        makeTemplateListWithPlan(makePlan('plan-1')),
        makeEncounterWithSubject(),
        [],
        'append',
        'mock-token',
        paymentMethod
      );
      const codes = codesOnProcedures(result.procedures);
      // Test-specific CPT codes only apply to client bill orders.
      expect(codes).not.toContain('36415');
      expect(result.cptCodesToSkip).not.toContain('36415');
      // The per-encounter code is added regardless of payment method for non-PSC orders.
      expect(codes).toContain(PER_ENCOUNTER_CPT_CODE);
      // parsedPlans and itemsByLabGuid are still populated — callers (applyExternalLabPlans) still need them
      expect(result.parsedPlans).toHaveLength(1);
    }
  });

  test('returns test-specific CPT procedures plus the per-encounter code when payment method is client bill', async () => {
    vi.mocked(getOrderableItems).mockResolvedValueOnce([
      makeOrderableItem('7788', LAB_GUID, 'Quest Diagnostics', [{ cptCode: '36415', serviceUnitsCount: 1 }]),
    ]);
    const result = await collectExternalLabCptProcedures(
      makeTemplateListWithPlan(makePlan('plan-1')),
      makeEncounterWithSubject(),
      [],
      'append',
      'mock-token',
      LabPaymentMethod.ClientBill
    );
    const codes = codesOnProcedures(result.procedures);
    expect(codes).toContain('36415');
    expect(codes).toContain(PER_ENCOUNTER_CPT_CODE);
    expect(result.cptCodesToSkip).toContain('36415');
  });

  describe('per-encounter CPT code (e.g. 99001)', () => {
    test('adds the per-encounter code once when a matched plan is non-PSC', async () => {
      vi.mocked(getOrderableItems).mockResolvedValueOnce([makeOrderableItem('7788')]);
      const result = await collectExternalLabCptProcedures(
        makeTemplateListWithPlan(makePlan('plan-1')), // default plan has no PSC orderDetail → psc: false
        makeEncounterWithSubject(),
        [],
        'append',
        'mock-token',
        LabPaymentMethod.Insurance
      );
      const perEncounterProcedures = result.procedures.filter(
        (p) => p.code?.coding?.some((c) => c.code === PER_ENCOUNTER_CPT_CODE)
      );
      expect(perEncounterProcedures).toHaveLength(1);
      expect(result.cptCodesToSkip).toContain(PER_ENCOUNTER_CPT_CODE);
    });

    test('does not add the per-encounter code when the only matched plan is a PSC order', async () => {
      vi.mocked(getOrderableItems).mockResolvedValueOnce([makeOrderableItem('7788')]);
      const pscPlan = makePlan('plan-1', {
        orderDetail: [
          {
            coding: [{ system: PSC_HOLD_CONFIG.system, code: PSC_HOLD_CONFIG.code, display: PSC_HOLD_CONFIG.display }],
            text: PSC_HOLD_CONFIG.display,
          },
        ],
      });
      const result = await collectExternalLabCptProcedures(
        makeTemplateListWithPlan(pscPlan),
        makeEncounterWithSubject(),
        [],
        'append',
        'mock-token',
        LabPaymentMethod.Insurance
      );
      const perEncounterProcedures = result.procedures.filter(
        (p) => p.code?.coding?.some((c) => c.code === PER_ENCOUNTER_CPT_CODE)
      );
      expect(perEncounterProcedures).toHaveLength(0);
      expect(result.cptCodesToSkip).not.toContain(PER_ENCOUNTER_CPT_CODE);
    });

    test('does not re-add the per-encounter code when it is already on the chart', async () => {
      vi.mocked(getOrderableItems).mockResolvedValueOnce([makeOrderableItem('7788')]);
      const result = await collectExternalLabCptProcedures(
        makeTemplateListWithPlan(makePlan('plan-1')),
        makeEncounterWithSubject(),
        [makeExistingPerEncounterCptProcedure()],
        'append',
        'mock-token',
        LabPaymentMethod.Insurance
      );
      const perEncounterProcedures = result.procedures.filter(
        (p) => p.code?.coding?.some((c) => c.code === PER_ENCOUNTER_CPT_CODE)
      );
      expect(perEncounterProcedures).toHaveLength(0);
    });

    test('adds the per-encounter code only once across multiple non-PSC matched plans', async () => {
      vi.mocked(getOrderableItems).mockResolvedValueOnce([makeOrderableItem('7788'), makeOrderableItem('9999')]);
      const planA = makePlan('plan-a');
      const planB = makePlan('plan-b', {
        code: { coding: [{ system: OYSTEHR_LAB_OI_CODE_SYSTEM, code: '9999', display: 'Other Test' }] },
      });
      const templateList: List = {
        resourceType: 'List',
        status: 'current',
        mode: 'working',
        contained: [planA, planB],
      };
      const result = await collectExternalLabCptProcedures(
        templateList,
        makeEncounterWithSubject(),
        [],
        'append',
        'mock-token',
        LabPaymentMethod.Insurance
      );
      const perEncounterProcedures = result.procedures.filter(
        (p) => p.code?.coding?.some((c) => c.code === PER_ENCOUNTER_CPT_CODE)
      );
      expect(perEncounterProcedures).toHaveLength(1);
    });

    test('does not add the per-encounter code for a plan that never matches a live orderable item', async () => {
      vi.mocked(getOrderableItems).mockResolvedValueOnce([
        makeOrderableItem('OTHER', LAB_GUID, 'Quest Diagnostics', [{ cptCode: '36415', serviceUnitsCount: 1 }]),
      ]);
      const result = await collectExternalLabCptProcedures(
        makeTemplateListWithPlan(makePlan('plan-1')),
        makeEncounterWithSubject(),
        [],
        'append',
        'mock-token',
        LabPaymentMethod.Insurance
      );
      expect(result.procedures).toHaveLength(0);
    });
  });
});
