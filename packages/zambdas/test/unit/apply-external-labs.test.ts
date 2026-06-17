import { Encounter, List, Location, ServiceRequest } from 'fhir/r4b';
import {
  chartDataTagSystem,
  FHIR_IDC10_VALUESET_SYSTEM,
  LAB_ACCOUNT_NUMBER_SYSTEM,
  locationIsEnabledForLabs,
  OrderableItemSearchResult,
  OYSTEHR_LAB_GUID_SYSTEM,
  OYSTEHR_LAB_OI_CODE_SYSTEM,
  PSC_HOLD_CONFIG,
  STATIC_COMPENDIUM_LAB_GUID,
} from 'utils';
import { describe, expect, test } from 'vitest';
import {
  findExternalLabPlans,
  getOrderingLocationFromEncounter,
  isExternalLabPlanServiceRequest,
  matchOrderableItemForPlan,
  parseExternalLabPlan,
} from '../../src/ehr/apply-template/apply-external-labs';
import { TemplateEncounterResource } from '../../src/ehr/shared/template-helpers';

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
  labName = 'Quest Diagnostics'
): OrderableItemSearchResult =>
  ({
    item: { itemCode, itemName: `Test ${itemCode}` },
    lab: { labGuid, labName, labType: 'reference', compendiumVersion: '1' },
  }) as OrderableItemSearchResult;

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
