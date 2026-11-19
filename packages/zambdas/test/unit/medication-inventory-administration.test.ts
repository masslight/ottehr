import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { Encounter, Medication, MedicationAdministration, Observation } from 'fhir/r4b';
import { getMedicationName } from 'utils/lib/fhir/medication-administration';
import {
  INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM,
  makeInventoryLot,
  makeInventoryStockEntry,
  makeMedicationInventoryExtension,
  parseInventoryLot,
  parseInventoryStockEntry,
  planAdministrationStockChanges,
  sortInventoryLotsForPicking,
  stockTakenForDose,
  withLotOnHand,
} from 'utils/lib/fhir/medication-inventory';
import { CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import { InHouseMedicationInventory, InventoryStockEntry } from 'utils/lib/types/api/config/in-house-medications';
import {
  IN_HOUSE_CONTAINED_MEDICATION_ID,
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  MEDICATION_CATALOG_ID_IDENTIFIER_SYSTEM,
  MEDICATION_DISPENSABLE_DRUG_ID,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_ORDER_INVENTORY_LOT_IDENTIFIER_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect as getInventoryPerformEffect } from '../../src/ehr/configuration/in-house-medications/get-medication-inventory/index';
import { syncInventoryForOrder } from '../../src/ehr/create-update-medication-order/helpers';
import { administrationStockChanged, reconcileAdministrationStock } from '../../src/shared/medication-inventory';

vi.mock('@sentry/node-core/light', () => ({ captureException: vi.fn() }));

vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({
  getAllFhirSearchPages: vi.fn(async (params: any, oystehr: any) => oystehr.fhir.search(params).unbundle()),
}));

const singleUseVial: InHouseMedicationInventory = {
  countedAs: 'vial',
  eachContains: { amount: 4, unit: 'mg', in: { amount: 2, unit: 'ml' } },
  use: 'single-use',
  reorderLevels: [],
};
const singleUse500mgVial: InHouseMedicationInventory = {
  ...singleUseVial,
  eachContains: { amount: 500, unit: 'mg' },
};
const multiUseBottle: InHouseMedicationInventory = {
  countedAs: 'bottle',
  eachContains: { amount: 50, unit: 'mg', in: { amount: 10, unit: 'ml' } },
  use: 'multi-use',
  reorderLevels: [],
};
const multiUseTube: InHouseMedicationInventory = {
  countedAs: 'tube',
  eachContains: { amount: 30, unit: 'g' },
  use: 'multi-use',
  reorderLevels: [],
};

const DRUG_NAME = 'Ondansetron HCl Injection Solution 4 MG/2ML';

const makeCatalog = (
  inventory: InHouseMedicationInventory | undefined,
  name = DRUG_NAME
): Medication & { id: string } => ({
  resourceType: 'Medication',
  id: 'med-catalog',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name },
  ],
  status: 'active',
  code: {
    coding: [
      { system: CODE_SYSTEM_NDC, code: '0409-1234-01' },
      { system: MEDICATION_DISPENSABLE_DRUG_ID, code: '12345' },
    ],
  },
  ...(inventory ? { extension: [makeMedicationInventoryExtension(inventory)] } : {}),
});

const makeLot = (id: string, lotNumber: string, onHand: number, expirationDate = '2027-03-31'): Medication => ({
  ...withLotOnHand(
    makeInventoryLot(makeCatalog(singleUseVial), {
      locationId: 'loc-a',
      lotNumber,
      expirationDate,
      ndc: '72572-0160-25',
      manufacturer: 'Civica',
      unit: 'vial',
    }),
    onHand
  ),
  id,
  meta: { versionId: '1' },
});

const makeOrder = ({
  status = 'completed',
  name = DRUG_NAME,
  lotNumber = 'A123',
  expirationDate = '2027-03-31',
  dose = 2,
  units = 'mg',
  catalogId,
  inventoryLotId,
}: {
  status?: MedicationAdministration['status'];
  name?: string;
  lotNumber?: string;
  expirationDate?: string;
  dose?: number;
  units?: string;
  catalogId?: string;
  inventoryLotId?: string;
} = {}): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id: 'ma-1',
  status,
  subject: { reference: 'Patient/p-1' },
  context: { reference: 'Encounter/enc-1' },
  medicationReference: { reference: `#${IN_HOUSE_CONTAINED_MEDICATION_ID}` },
  contained: [
    {
      resourceType: 'Medication',
      id: IN_HOUSE_CONTAINED_MEDICATION_ID,
      identifier: [
        { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: name },
        ...(catalogId ? [{ system: MEDICATION_CATALOG_ID_IDENTIFIER_SYSTEM, value: catalogId }] : []),
        ...(inventoryLotId
          ? [{ system: MEDICATION_ORDER_INVENTORY_LOT_IDENTIFIER_SYSTEM, value: inventoryLotId }]
          : []),
      ],
      batch: { lotNumber, expirationDate },
    },
  ],
  dosage: { dose: { value: dose, unit: units, system: MEDICATION_ADMINISTRATION_UNITS_SYSTEM } },
});

const encounter: Encounter = {
  resourceType: 'Encounter',
  id: 'enc-1',
  status: 'in-progress',
  class: { code: 'AMB' },
  location: [{ location: { reference: 'Location/loc-a' } }],
};

const ledgerEntry = (
  id: string,
  input: Partial<Parameters<typeof makeInventoryStockEntry>[0]> & { quantity: number },
  waste?: number
): Observation => ({
  ...makeInventoryStockEntry({
    lotReference: 'Medication/lot-1',
    locationId: 'loc-a',
    type: 'administered',
    unit: 'vial',
    effectiveDateTime: '2026-10-30T15:10:00Z',
    medicationAdministrationId: 'ma-1',
    ...(waste !== undefined
      ? { reason: 'partial-dose-waste', components: [{ code: 'waste-amount', value: waste, unit: 'mg' }] }
      : {}),
    ...input,
  }),
  id,
});

const parsed = (observation: Observation): InventoryStockEntry => {
  const entry = parseInventoryStockEntry(observation);
  if (!entry) throw new Error('fixture does not parse');
  return entry;
};

type MockOystehr = Oystehr & {
  fhir: { get: ReturnType<typeof vi.fn>; search: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
};

const searchedTokens = (value: string): { system?: string; code: string }[] =>
  value.split(/(?<!\\),/).map((alternative) => {
    const separator = alternative.search(/(?<!\\)\|/);
    return separator < 0
      ? { code: alternative.replace(/\\([,$])/g, '$1') }
      : {
          system: alternative.slice(0, separator),
          code: alternative.slice(separator + 1).replace(/\\([,$|])/g, '$1'),
        };
  });

const makeMockOystehr = ({
  catalog = makeCatalog(singleUseVial),
  lots = [makeLot('lot-1', 'A123', 25)],
  ledger = [] as Observation[],
}: { catalog?: Medication; lots?: Medication[]; ledger?: Observation[] } = {}): MockOystehr => {
  const paramValue = (params: { name: string; value: string }[], name: string): string | undefined =>
    params.find((param) => param.name === name)?.value;
  const search = vi.fn().mockImplementation(({ resourceType, params }: any) => ({
    unbundle: () => {
      if (resourceType === 'Medication') {
        const identifier = paramValue(params, 'identifier') ?? '';
        if (identifier.startsWith(`${MEDICATION_IDENTIFIER_NAME_SYSTEM}|`)) {
          return searchedTokens(identifier).some(
            ({ system, code }) => system === MEDICATION_IDENTIFIER_NAME_SYSTEM && code === getMedicationName(catalog)
          )
            ? [catalog]
            : [];
        }
        const lotNumber = paramValue(params, 'lot-number');
        return lots.filter(
          (lot) =>
            lot.identifier?.some(
              (idn) => idn.system === INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM && idn.value === catalog.id
            ) &&
            (!lotNumber || searchedTokens(lotNumber).some(({ code }) => code === lot.batch?.lotNumber))
        );
      }
      const partOf = paramValue(params, 'part-of');
      if (partOf) return ledger.filter((entry) => entry.partOf?.[0]?.reference === partOf);
      const subject = paramValue(params, 'subject');
      return ledger.filter((entry) => entry.subject?.reference === subject);
    },
  }));
  const get = vi.fn().mockImplementation(({ resourceType, id }: { resourceType: string; id: string }) => {
    if (resourceType === 'Encounter') return encounter;
    if (resourceType === 'Medication') {
      const found = id === catalog.id ? catalog : lots.find((lot) => lot.id === id);
      if (!found) throw new Error(`no Medication/${id}`);
      return found;
    }
    throw new Error(`unexpected get ${resourceType}/${id}`);
  });
  const transaction = vi.fn().mockImplementation(({ requests }: { requests: { resource: any }[] }) => ({
    resourceType: 'Bundle',
    entry: requests.map((request, index) => ({
      resource: { ...request.resource, id: request.resource.id ?? `created-${index}` },
    })),
  }));
  return { fhir: { get, search, transaction } } as unknown as MockOystehr;
};

const postedEntries = (oystehr: MockOystehr): Observation[] =>
  oystehr.fhir.transaction.mock.calls.flatMap(([{ requests }]: any) =>
    requests.filter((r: any) => r.method === 'POST' && r.url === '/Observation').map((r: any) => r.resource)
  );

describe('stockTakenForDose', () => {
  it('takes one vial for a full single-use dose with no waste', () => {
    expect(stockTakenForDose(singleUseVial, 4, 'mg')).toEqual({ items: 1 });
  });

  it('takes one vial for a partial dose and records the leftover as waste', () => {
    expect(stockTakenForDose(singleUseVial, 2, 'mg')).toEqual({ items: 1, waste: { amount: 2, unit: 'mg' } });
  });

  it('rounds up over several vials', () => {
    expect(stockTakenForDose(singleUseVial, 6, 'mg')).toEqual({ items: 2, waste: { amount: 2, unit: 'mg' } });
  });

  it('converts between mass units: 1 g of a 500 mg vial is 2 vials', () => {
    expect(stockTakenForDose(singleUse500mgVial, 1, 'g')).toEqual({ items: 2 });
  });

  it('uses the "in" volume when the dose is in ml', () => {
    expect(stockTakenForDose(singleUseVial, 2, 'ml')).toEqual({ items: 1 });
    expect(stockTakenForDose(singleUseVial, 1, 'ml')).toEqual({ items: 1, waste: { amount: 1, unit: 'ml' } });
    expect(stockTakenForDose(singleUseVial, 3, 'cc')).toEqual({ items: 2, waste: { amount: 1, unit: 'cc' } });
  });

  it('takes one item when a single-use dose unit cannot be related to the container', () => {
    expect(stockTakenForDose(singleUseVial, 1, 'unit')).toEqual({ items: 1 });
  });

  it('takes nothing from a multi-use drug or for a zero dose', () => {
    expect(stockTakenForDose(multiUseBottle, 2, 'ml')).toBeUndefined();
    expect(stockTakenForDose(multiUseTube, 1, 'application')).toBeUndefined();
    expect(stockTakenForDose(singleUseVial, 0, 'mg')).toBeUndefined();
  });
});

describe('planAdministrationStockChanges', () => {
  const administeredA = parsed(ledgerEntry('e-1', { quantity: -1 }, 2));

  it('takes the dose off the lot on a fresh administration, with the waste on the same entry', () => {
    expect(planAdministrationStockChanges({ lotId: 'lot-1', items: 1, waste: { amount: 2, unit: 'mg' } }, [])).toEqual([
      { lotId: 'lot-1', type: 'administered', quantity: -1, waste: { amount: 2, unit: 'mg' } },
    ]);
  });

  it('writes nothing when the ledger already matches (a re-save)', () => {
    expect(
      planAdministrationStockChanges({ lotId: 'lot-1', items: 1, waste: { amount: 2, unit: 'mg' } }, [administeredA])
    ).toEqual([]);
  });

  it('puts the lot back on delete or when the status is no longer administered, marking the order deleted', () => {
    expect(planAdministrationStockChanges(undefined, [administeredA])).toEqual([
      {
        lotId: 'lot-1',
        type: 'administration-reversed',
        quantity: 1,
        waste: { amount: -2, unit: 'mg' },
        reversesEntryId: 'e-1',
        administrationDeleted: true,
      },
    ]);
  });

  it('moves one vial back from the old lot and takes one from the new lot on a lot change', () => {
    expect(
      planAdministrationStockChanges({ lotId: 'lot-2', items: 1, waste: { amount: 2, unit: 'mg' } }, [administeredA])
    ).toEqual([
      {
        lotId: 'lot-1',
        type: 'administration-reversed',
        quantity: 1,
        waste: { amount: -2, unit: 'mg' },
        reversesEntryId: 'e-1',
      },
      { lotId: 'lot-2', type: 'administered', quantity: -1, waste: { amount: 2, unit: 'mg' } },
    ]);
  });

  it('adjusts by the difference on a dose change, as a change and not a delete', () => {
    const [reversal] = planAdministrationStockChanges({ lotId: 'lot-1', items: 1 }, [administeredA]);
    expect(reversal).toEqual({
      lotId: 'lot-1',
      type: 'administration-reversed',
      quantity: 0,
      waste: { amount: -2, unit: 'mg' },
      reversesEntryId: 'e-1',
    });
    expect(reversal.administrationDeleted).toBeUndefined();
    expect(
      planAdministrationStockChanges({ lotId: 'lot-1', items: 2, waste: { amount: 2, unit: 'mg' } }, [administeredA])
    ).toEqual([{ lotId: 'lot-1', type: 'administered', quantity: -1 }]);
  });

  it('nets out earlier reversals so a re-administration takes the lot again', () => {
    const reversed = parsed(
      ledgerEntry('e-2', { type: 'administration-reversed', quantity: 1, reversesEntryId: 'e-1' }, -2)
    );
    expect(
      planAdministrationStockChanges({ lotId: 'lot-1', items: 1, waste: { amount: 2, unit: 'mg' } }, [
        administeredA,
        reversed,
      ])
    ).toEqual([{ lotId: 'lot-1', type: 'administered', quantity: -1, waste: { amount: 2, unit: 'mg' } }]);
  });
});

describe('reconcileAdministrationStock', () => {
  it('writes an administered entry linked to the order, performed by the caller, with the waste', async () => {
    const oystehr = makeMockOystehr();
    await reconcileAdministrationStock(
      oystehr,
      makeOrder({ dose: 2, inventoryLotId: 'lot-1' }),
      'Practitioner/nurse-1'
    );

    const [entry] = postedEntries(oystehr);
    expect(postedEntries(oystehr)).toHaveLength(1);
    expect(entry.partOf).toEqual([{ reference: 'MedicationAdministration/ma-1' }]);
    expect(entry.performer).toEqual([{ reference: 'Practitioner/nurse-1' }]);
    expect(entry.subject).toEqual({ reference: 'Medication/lot-1' });
    expect(entry.focus).toEqual([{ reference: 'Location/loc-a' }]);
    expect(entry.valueQuantity).toEqual({ value: -1, unit: 'vial' });
    expect(entry.code?.coding?.map((c) => c.code)).toEqual(['administered', 'partial-dose-waste']);
    expect(entry.component?.[0]?.valueQuantity).toEqual({ value: 2, unit: 'mg' });
    expect(entry.encounter).toBeUndefined();
    const lotUpdate = oystehr.fhir.transaction.mock.calls[0][0].requests[1];
    expect(lotUpdate.method).toBe('PUT');
    expect(lotUpdate.url).toBe('/Medication/lot-1');
  });

  it('finds the catalog drug by the id on the order copy, and by name for orders saved before it was recorded', async () => {
    const byId = makeMockOystehr();
    await reconcileAdministrationStock(
      byId,
      makeOrder({ catalogId: 'med-catalog', inventoryLotId: 'lot-1' }),
      'Practitioner/nurse-1'
    );
    expect(postedEntries(byId)).toHaveLength(1);
    expect(byId.fhir.get).toHaveBeenCalledWith({ resourceType: 'Medication', id: 'med-catalog' });
    const nameSearches = (oystehr: MockOystehr): number =>
      oystehr.fhir.search.mock.calls.filter(([call]: any) =>
        call.params.some((p: any) => String(p.value).startsWith(`${MEDICATION_IDENTIFIER_NAME_SYSTEM}|`))
      ).length;
    expect(nameSearches(byId)).toBe(0);

    const byName = makeMockOystehr();
    await reconcileAdministrationStock(byName, makeOrder({ inventoryLotId: 'lot-1' }), 'Practitioner/nurse-1');
    expect(postedEntries(byName)).toHaveLength(1);
    expect(nameSearches(byName)).toBe(1);
  });

  it('finds the catalog drug by a name with a comma and leaves its dose on the lot when the order is re-saved', async () => {
    const name = 'Ondansetron HCl Injection Solution, 4 MG/2ML';
    const oystehr = makeMockOystehr({
      catalog: makeCatalog(singleUseVial, name),
      ledger: [ledgerEntry('e-1', { quantity: -1 }, 2)],
    });

    await reconcileAdministrationStock(oystehr, makeOrder({ name, inventoryLotId: 'lot-1' }), 'Practitioner/nurse-1');

    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it.each(['A,123', 'A|123', 'A$123', 'A\\123'])(
    'finds lot %s and leaves its dose on it when the order is re-saved',
    async (lotNumber) => {
      const oystehr = makeMockOystehr({
        lots: [makeLot('lot-1', lotNumber, 24)],
        ledger: [ledgerEntry('e-1', { quantity: -1 }, 2)],
      });

      await reconcileAdministrationStock(
        oystehr,
        makeOrder({ lotNumber, inventoryLotId: 'lot-1' }),
        'Practitioner/nurse-1'
      );

      expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
    }
  );

  it('does nothing for a typed lot that is not in inventory at the visit location', async () => {
    const oystehr = makeMockOystehr();
    await reconcileAdministrationStock(oystehr, makeOrder({ lotNumber: 'SAMPLE-1' }), 'Practitioner/nurse-1');
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('does nothing for a drug without inventory setup', async () => {
    const oystehr = makeMockOystehr({ catalog: makeCatalog(undefined) });
    await reconcileAdministrationStock(oystehr, makeOrder({ inventoryLotId: 'lot-1' }), 'Practitioner/nurse-1');
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('does nothing for a multi-use drug', async () => {
    const tube = makeMockOystehr({ catalog: makeCatalog(multiUseTube) });
    await reconcileAdministrationStock(
      tube,
      makeOrder({ dose: 1, units: 'application', inventoryLotId: 'lot-1' }),
      'Practitioner/nurse-1'
    );
    const bottle = makeMockOystehr({ catalog: makeCatalog(multiUseBottle) });
    await reconcileAdministrationStock(
      bottle,
      makeOrder({ dose: 2, units: 'ml', inventoryLotId: 'lot-1' }),
      'Practitioner/nurse-1'
    );
    expect(tube.fhir.transaction).not.toHaveBeenCalled();
    expect(bottle.fhir.transaction).not.toHaveBeenCalled();
  });

  it('takes from the selected lot when the number is on hand twice, and from none when the number was typed', async () => {
    const lots = [makeLot('lot-1', 'A123', 24, '2027-03-31'), makeLot('lot-1b', 'A123', 9, '2028-01-01')];
    const selected = makeMockOystehr({ lots });
    await reconcileAdministrationStock(
      selected,
      makeOrder({ expirationDate: '2028-01-01T00:00:00.000-04:00', inventoryLotId: 'lot-1b' }),
      'Practitioner/nurse-1'
    );
    expect(postedEntries(selected)[0]?.subject).toEqual({ reference: 'Medication/lot-1b' });

    const typed = makeMockOystehr({ lots });
    await reconcileAdministrationStock(typed, makeOrder({ expirationDate: '2028-01-01' }), 'Practitioner/nurse-1');
    expect(typed.fhir.transaction).not.toHaveBeenCalled();
  });

  it.each([
    ['zero', 0],
    ['negative', -2],
  ])('takes nothing for a typed lot number whose lot has %s on hand and is not suggested', async (_label, onHand) => {
    const oystehr = makeMockOystehr({ lots: [makeLot('lot-1', 'A123', onHand)] });
    const { lots } = await getInventoryPerformEffect(oystehr, { medicationId: 'med-catalog', locationId: 'loc-a' });
    expect(lots).toEqual([]);

    await reconcileAdministrationStock(oystehr, makeOrder({ lotNumber: 'A123' }), 'Practitioner/nurse-1');

    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('takes the dose from a selected lot that another administration emptied first, leaving it below zero', async () => {
    const oystehr = makeMockOystehr({
      lots: [makeLot('lot-1', 'A123', 0)],
      ledger: [
        ledgerEntry('e-received', { type: 'received', quantity: 1, medicationAdministrationId: undefined }),
        ledgerEntry('e-other-order', { quantity: -1, medicationAdministrationId: 'ma-2' }),
      ],
    });

    await reconcileAdministrationStock(oystehr, makeOrder({ inventoryLotId: 'lot-1' }), 'Practitioner/nurse-1');

    const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
    expect(postedEntries(oystehr).map((e) => [e.subject?.reference, e.valueQuantity?.value])).toEqual([
      ['Medication/lot-1', -1],
    ]);
    expect(parseInventoryLot(requests[1].resource)?.onHand).toBe(-1);
  });

  it('puts the stock back on a selected lot that has reached zero when the order is deleted', async () => {
    const oystehr = makeMockOystehr({
      lots: [makeLot('lot-1', 'A123', 0)],
      ledger: [
        ledgerEntry('e-received', { type: 'received', quantity: 1, medicationAdministrationId: undefined }),
        ledgerEntry('e-1', { quantity: -1 }, 2),
      ],
    });

    await reconcileAdministrationStock(
      oystehr,
      makeOrder({ status: 'stopped', inventoryLotId: 'lot-1' }),
      'Practitioner/nurse-1'
    );

    const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
    expect(
      postedEntries(oystehr).map((e) => [e.subject?.reference, e.valueQuantity?.value, e.code?.coding?.[0]?.code])
    ).toEqual([['Medication/lot-1', 1, 'administration-reversed']]);
    expect(parseInventoryLot(requests[1].resource)).toMatchObject({ onHand: 1, status: 'active' });
  });

  it('does nothing while the order is pending or not administered', async () => {
    const oystehr = makeMockOystehr();
    await reconcileAdministrationStock(
      oystehr,
      makeOrder({ status: 'in-progress', inventoryLotId: 'lot-1' }),
      'Practitioner/nurse-1'
    );
    await reconcileAdministrationStock(
      oystehr,
      makeOrder({ status: 'not-done', inventoryLotId: 'lot-1' }),
      'Practitioner/nurse-1'
    );
    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it('puts the stock back when the order is deleted, deriving from the earlier entry', async () => {
    const oystehr = makeMockOystehr({ ledger: [ledgerEntry('e-1', { quantity: -1 }, 2)] });
    await reconcileAdministrationStock(oystehr, makeOrder({ status: 'stopped' }), 'Practitioner/nurse-1');

    const [entry] = postedEntries(oystehr);
    expect(postedEntries(oystehr)).toHaveLength(1);
    expect(entry.code?.coding?.map((c) => c.code)).toEqual(['administration-reversed', 'partial-dose-waste']);
    expect(entry.valueQuantity).toEqual({ value: 1, unit: 'vial' });
    expect(entry.derivedFrom).toEqual([{ reference: 'Observation/e-1' }]);
    expect(entry.component?.[0]?.valueQuantity).toEqual({ value: -2, unit: 'mg' });
    expect(parseInventoryStockEntry({ ...entry, id: 'x' })).toMatchObject({ administrationDeleted: true });
  });

  it('moves the vial between lots when the lot on the order changes', async () => {
    const oystehr = makeMockOystehr({
      lots: [makeLot('lot-1', 'A123', 24), makeLot('lot-2', 'B456', 10)],
      ledger: [ledgerEntry('e-1', { quantity: -1 }, 2)],
    });
    await reconcileAdministrationStock(
      oystehr,
      makeOrder({ lotNumber: 'B456', inventoryLotId: 'lot-2' }),
      'Practitioner/nurse-1'
    );

    const entries = postedEntries(oystehr);
    expect(entries.map((e) => [e.subject?.reference, e.valueQuantity?.value, e.code?.coding?.[0]?.code])).toEqual([
      ['Medication/lot-1', 1, 'administration-reversed'],
      ['Medication/lot-2', -1, 'administered'],
    ]);
  });

  it('writes nothing more when a concurrent save of the same order took the dose and the lot write conflicted', async () => {
    const ledger: Observation[] = [];
    const oystehr = makeMockOystehr({ ledger });
    oystehr.fhir.transaction.mockImplementationOnce(() => {
      ledger.push(ledgerEntry('e-other-save', { quantity: -1 }, 2));
      throw Object.assign(new Error('412 Precondition Failed'), { code: 412 });
    });

    await reconcileAdministrationStock(oystehr, makeOrder({ inventoryLotId: 'lot-1' }), 'Practitioner/nurse-1');

    expect(oystehr.fhir.transaction).toHaveBeenCalledTimes(1);
  });

  it('writes nothing when a concurrent save of the same order took the dose after this save read the order entries', async () => {
    const ledger: Observation[] = [];
    const oystehr = makeMockOystehr({ ledger });
    oystehr.fhir.get.mockImplementationOnce(() => {
      ledger.push(ledgerEntry('e-other-save', { quantity: -1 }, 2));
      return encounter;
    });

    await reconcileAdministrationStock(oystehr, makeOrder({ inventoryLotId: 'lot-1' }), 'Practitioner/nurse-1');

    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
  });

  it("still takes the dose when the lot's ledger holds another order's administration", async () => {
    const oystehr = makeMockOystehr({
      lots: [makeLot('lot-1', 'A123', 9)],
      ledger: [
        ledgerEntry('e-received', { type: 'received', quantity: 10, medicationAdministrationId: undefined }),
        ledgerEntry('e-other-order', { quantity: -1, medicationAdministrationId: 'ma-2' }),
      ],
    });

    await reconcileAdministrationStock(
      oystehr,
      makeOrder({ dose: 4, inventoryLotId: 'lot-1' }),
      'Practitioner/nurse-1'
    );

    const { requests } = oystehr.fhir.transaction.mock.calls[0][0];
    expect(postedEntries(oystehr).map((e) => [e.partOf?.[0]?.reference, e.valueQuantity?.value])).toEqual([
      ['MedicationAdministration/ma-1', -1],
    ]);
    expect(parseInventoryLot(requests[1].resource)?.onHand).toBe(8);
  });
});

describe('syncInventoryForOrder', () => {
  beforeEach(() => vi.mocked(captureException).mockClear());

  it('reports an inventory failure and resolves, so the administration still saves', async () => {
    const oystehr = makeMockOystehr();
    oystehr.fhir.get.mockRejectedValue(new Error('FHIR is down'));
    await expect(syncInventoryForOrder(oystehr, 'ma-1', 'nurse-1', makeOrder())).resolves.toBeUndefined();
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('reconciles the order it re-reads', async () => {
    const oystehr = makeMockOystehr();
    const order = makeOrder({ inventoryLotId: 'lot-1' });
    oystehr.fhir.get.mockImplementation(({ resourceType, id }: { resourceType: string; id: string }) => {
      if (resourceType === 'MedicationAdministration') return order;
      if (resourceType === 'Encounter') return encounter;
      return id === 'med-catalog' ? makeCatalog(singleUseVial) : makeLot('lot-1', 'A123', 25);
    });
    await syncInventoryForOrder(oystehr, 'ma-1', 'nurse-1', makeOrder({ status: 'in-progress' }));
    expect(postedEntries(oystehr)[0]?.performer).toEqual([{ reference: 'Practitioner/nurse-1' }]);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('puts the vial back and takes nothing when a selected lot is replaced by a typed lot number', async () => {
    const lots = [makeLot('lot-1', 'A123', 24), makeLot('lot-2', 'B456', 0)];
    const oystehr = makeMockOystehr({ lots, ledger: [ledgerEntry('e-1', { quantity: -1 }, 2)] });
    oystehr.fhir.get.mockImplementation(({ resourceType, id }: { resourceType: string; id: string }) => {
      if (resourceType === 'MedicationAdministration') return makeOrder({ lotNumber: 'B456' });
      if (resourceType === 'Encounter') return encounter;
      return id === 'med-catalog' ? makeCatalog(singleUseVial) : lots.find((lot) => lot.id === id);
    });

    await syncInventoryForOrder(oystehr, 'ma-1', 'nurse-1', makeOrder({ inventoryLotId: 'lot-1' }));

    expect(
      postedEntries(oystehr).map((e) => [e.subject?.reference, e.valueQuantity?.value, e.code?.coding?.[0]?.code])
    ).toEqual([['Medication/lot-1', 1, 'administration-reversed']]);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('puts the vial back and takes nothing when the selected lot is cleared and its number is typed again', async () => {
    const lots = [makeLot('lot-1', 'A123', 0)];
    const ledger = [
      ledgerEntry('e-received', { type: 'received', quantity: 1, medicationAdministrationId: undefined }),
      ledgerEntry('e-1', { quantity: -1 }, 2),
    ];
    const oystehr = makeMockOystehr({ lots, ledger });
    oystehr.fhir.get.mockImplementation(({ resourceType, id }: { resourceType: string; id: string }) => {
      if (resourceType === 'MedicationAdministration') return makeOrder();
      if (resourceType === 'Encounter') return encounter;
      return id === 'med-catalog' ? makeCatalog(singleUseVial) : lots.find((lot) => lot.id === id);
    });

    await syncInventoryForOrder(oystehr, 'ma-1', 'nurse-1', makeOrder({ inventoryLotId: 'lot-1' }));

    expect(
      postedEntries(oystehr).map((e) => [e.subject?.reference, e.valueQuantity?.value, e.code?.coding?.[0]?.code])
    ).toEqual([['Medication/lot-1', 1, 'administration-reversed']]);
    expect(captureException).not.toHaveBeenCalled();
  });

  it('takes nothing when a pending order with a typed lot number is administered', async () => {
    const oystehr = makeMockOystehr();
    oystehr.fhir.get.mockImplementation(({ resourceType, id }: { resourceType: string; id: string }) => {
      if (resourceType === 'MedicationAdministration') return makeOrder();
      if (resourceType === 'Encounter') return encounter;
      return id === 'med-catalog' ? makeCatalog(singleUseVial) : makeLot('lot-1', 'A123', 25);
    });

    await syncInventoryForOrder(oystehr, 'ma-1', 'nurse-1', makeOrder({ status: 'in-progress' }));

    expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it.each<[string, InHouseMedicationInventory | undefined, Observation[], number]>([
    ['tracking was turned off', undefined, [ledgerEntry('e-1', { quantity: -1 }, 2)], 2],
    [
      'each-contains changed from 4 mg to 1 mg',
      { ...singleUseVial, eachContains: { amount: 1, unit: 'mg' } },
      [ledgerEntry('e-1', { quantity: -2 }, 2)],
      6,
    ],
    ['tracking was turned on after it was given', singleUseVial, [], 2],
  ])(
    'leaves stock alone when an administered order is re-saved without a stock change after %s',
    async (_label, inventory, ledger, dose) => {
      const oystehr = makeMockOystehr({ catalog: makeCatalog(inventory), ledger });
      const before = makeOrder({ dose });
      oystehr.fhir.get.mockImplementation(({ resourceType, id }: { resourceType: string; id: string }) => {
        if (resourceType === 'MedicationAdministration') return { ...before, note: [{ text: 'Charted late' }] };
        if (resourceType === 'Encounter') return encounter;
        return id === 'med-catalog' ? makeCatalog(inventory) : makeLot('lot-1', 'A123', 25);
      });

      await syncInventoryForOrder(oystehr, 'ma-1', 'nurse-1', before);

      expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
      expect(captureException).not.toHaveBeenCalled();
    }
  );
});

describe('administrationStockChanged', () => {
  it('treats a switch to another catalog drug with the same name, lot and expiration as a stock change', () => {
    expect(
      administrationStockChanged(makeOrder({ catalogId: 'med-catalog' }), makeOrder({ catalogId: 'med-other' }))
    ).toBe(true);
  });

  it('treats selecting the inventory lot whose number was typed as a stock change', () => {
    expect(administrationStockChanged(makeOrder(), makeOrder({ inventoryLotId: 'lot-1' }))).toBe(true);
  });
});

describe('get-medication-inventory with a location', () => {
  it('returns the lots on hand at the location, soonest expiration first, and none for an untracked drug', async () => {
    const oystehr = makeMockOystehr({
      lots: [
        makeLot('lot-1', 'HK3302', 18, '2027-06-30'),
        makeLot('lot-2', 'C24117', 4, '2026-11-15'),
        makeLot('lot-3', 'USED', 0),
      ],
    });
    const response = await getInventoryPerformEffect(oystehr, { medicationId: 'med-catalog', locationId: 'loc-a' });
    expect(response.lots?.map((lot) => lot.lotNumber)).toEqual(['C24117', 'HK3302']);
    expect(response.lastReceivedLot).toBeUndefined();

    const untracked = makeMockOystehr({ catalog: makeCatalog(undefined) });
    expect(await getInventoryPerformEffect(untracked, { medicationId: 'med-catalog', locationId: 'loc-a' })).toEqual(
      {}
    );
  });

  it('sorts expired lots last for picking, and by lot number within a date', () => {
    const lots = [
      { lotNumber: 'B', expirationDate: '2027-06-30' },
      { lotNumber: 'X', expirationDate: '2026-09-30' },
      { lotNumber: 'A', expirationDate: '2027-06-30' },
      { lotNumber: 'C', expirationDate: '2026-11-15' },
    ];
    expect(sortInventoryLotsForPicking(lots, '2026-10-30').map(({ lot, expired }) => [lot.lotNumber, expired])).toEqual(
      [
        ['C', false],
        ['A', false],
        ['B', false],
        ['X', true],
      ]
    );
  });
});

describe('syncInventoryForOrder after the lot expiration was corrected', () => {
  beforeEach(() => vi.mocked(captureException).mockClear());

  const correctedLot = makeLot('lot-1', 'A123', 24, '2027-04-30');
  const sameNumberLot = makeLot('lot-1b', 'A123', 9, '2028-01-01');
  const given = ledgerEntry('e-1', { quantity: -1 }, 2);
  const givenBeforeCorrection = makeOrder({ dose: 2, expirationDate: '2027-03-31' });

  const resave = async (
    after: MedicationAdministration,
    lots = [correctedLot, sameNumberLot]
  ): Promise<MockOystehr> => {
    const oystehr = makeMockOystehr({ lots, ledger: [given] });
    oystehr.fhir.get.mockImplementation(({ resourceType, id }: { resourceType: string; id: string }) => {
      if (resourceType === 'MedicationAdministration') return after;
      if (resourceType === 'Encounter') return encounter;
      return id === 'med-catalog' ? makeCatalog(singleUseVial) : lots.find((lot) => lot.id === id);
    });
    await syncInventoryForOrder(oystehr, 'ma-1', 'nurse-1', givenBeforeCorrection);
    return oystehr;
  };

  it('takes the extra vial from the lot the dose came from when only the dose changes', async () => {
    const oystehr = await resave(makeOrder({ dose: 6, expirationDate: '2027-03-31' }));
    expect(
      postedEntries(oystehr).map((e) => [e.subject?.reference, e.valueQuantity?.value, e.code?.coding?.[0]?.code])
    ).toEqual([['Medication/lot-1', -1, 'administered']]);
  });

  it('keeps charging that lot when another lot with the number has the old expiration', async () => {
    const oldExpirationLot = makeLot('lot-2', 'A123', 9, '2027-03-31');
    const oystehr = await resave(makeOrder({ dose: 6, expirationDate: '2027-03-31' }), [
      correctedLot,
      oldExpirationLot,
    ]);
    expect(
      postedEntries(oystehr).map((e) => [e.subject?.reference, e.valueQuantity?.value, e.code?.coding?.[0]?.code])
    ).toEqual([['Medication/lot-1', -1, 'administered']]);
  });

  it.each([
    ['a date no lot has, when one lot has the number', '2029-01-01', [correctedLot]],
    ["the lot's corrected date, when another lot has the number", '2027-04-30', [correctedLot, sameNumberLot]],
  ])(
    'leaves the vial off the lot when staff change only the expiration on the order to %s',
    async (_label, expirationDate, lots) => {
      const oystehr = await resave(makeOrder({ dose: 2, expirationDate }), lots);
      expect(oystehr.fhir.transaction).not.toHaveBeenCalled();
      expect(captureException).not.toHaveBeenCalled();
    }
  );

  it.each([
    ['an expiration no lot has', makeOrder({ dose: 2, expirationDate: '2029-01-01' })],
    ['a lot number that is not in inventory', makeOrder({ dose: 2, lotNumber: 'SAMPLE-1' })],
  ])('puts the vial back when staff change the order to %s', async (_label, after) => {
    const oystehr = await resave(after);
    const [entry] = postedEntries(oystehr);
    expect(postedEntries(oystehr)).toHaveLength(1);
    expect(entry.subject).toEqual({ reference: 'Medication/lot-1' });
    expect(parseInventoryStockEntry({ ...entry, id: 'x' })).toMatchObject({
      type: 'administration-reversed',
      quantity: 1,
      administrationDeleted: true,
    });
  });
});
