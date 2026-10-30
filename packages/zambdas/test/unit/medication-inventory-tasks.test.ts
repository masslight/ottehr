import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { Location, Medication, Task } from 'fhir/r4b';
import { makeInventoryLot, makeMedicationInventoryExtension, withLotOnHand } from 'utils/lib/fhir/medication-inventory';
import { InHouseMedicationInventory, InventoryLot } from 'utils/lib/types/api/config/in-house-medications';
import {
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_IDENTIFIER_NAME_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from 'utils/lib/types/api/medication-administration.constants';
import { INVENTORY_TASK } from 'utils/lib/types/data/tasks/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { performEffect as expirationCron } from '../../src/cron/inventory-expiration-tasks/index';
import { writeInventoryStockEntry } from '../../src/shared/medication-inventory';
import {
  createStockLevelTasksAfterWrite,
  detectStockCrossings,
  formatStockQuantity,
  inventoryTaskWording,
  selectExpirationEvents,
} from '../../src/shared/medication-inventory-tasks';
import { getTaskLocation } from '../../src/shared/tasks';

vi.mock('@sentry/node-core/light', () => ({ captureException: vi.fn() }));
vi.mock('utils/lib/fhir/getAllFhirSearchPages', () => ({
  getAllFhirSearchPages: vi.fn(async (params: any, oystehr: any) => oystehr.fhir.search(params).unbundle()),
}));

const inventory: InHouseMedicationInventory = {
  countedAs: 'vial',
  eachContains: { amount: 30, unit: 'mg', in: { amount: 1, unit: 'ml' } },
  use: 'single-use',
  reorderLevels: [{ locationId: 'loc-a', level: 8 }],
};

const catalog: Medication & { id: string } = {
  resourceType: 'Medication',
  id: 'med-ketorolac',
  identifier: [
    { system: MEDICATION_TYPE_SYSTEM, value: INVENTORY_MEDICATION_TYPE_CODE },
    { system: MEDICATION_IDENTIFIER_NAME_SYSTEM, value: 'Ketorolac 30 mg/ml' },
  ],
  status: 'active',
  extension: [makeMedicationInventoryExtension(inventory)],
};

const clinic: Location = { resourceType: 'Location', id: 'loc-a', name: 'Main Street Clinic' };

const lotInput = { locationId: 'loc-a', lotNumber: 'A123', expirationDate: '2027-03-31', ndc: '1-2-3', unit: 'vial' };
const lotWith = (onHand: number, id = 'lot-1', lotNumber = 'A123', expirationDate = '2027-03-31'): Medication => ({
  ...withLotOnHand(makeInventoryLot(catalog, { ...lotInput, lotNumber, expirationDate }), onHand),
  id,
  meta: { versionId: '1' },
});

type MockOystehr = Oystehr & { fhir: Record<'get' | 'search' | 'transaction' | 'create', ReturnType<typeof vi.fn>> };

/** Lots come back from Medication searches; the catalog and clinic from gets; creates echo the task with an id. */
const makeMockOystehr = ({ lots = [] as Medication[], ledger = [] as unknown[] } = {}): MockOystehr =>
  ({
    fhir: {
      get: vi.fn(async ({ resourceType }: { resourceType: string }) =>
        resourceType === 'Location' ? clinic : catalog
      ),
      search: vi.fn(({ resourceType, params }: { resourceType: string; params: { name: string }[] }) => ({
        unbundle: () => {
          if (resourceType === 'Location') return [clinic];
          if (resourceType !== 'Medication') return ledger;
          return params.some((param) => param.name === '_id') ? [catalog] : lots;
        },
      })),
      transaction: vi.fn(({ requests }: { requests: { resource: any }[] }) => ({
        entry: requests.map((request, index) => ({
          resource: { ...request.resource, id: request.resource.id ?? `created-${index}` },
        })),
      })),
      create: vi.fn(async (task: Task) => ({ ...task, id: 'task-1' })),
    },
  }) as unknown as MockOystehr;

const createdTask = (oystehr: MockOystehr, call = 0): Task => oystehr.fhir.create.mock.calls[call][0];
const createOptions = (oystehr: MockOystehr, call = 0): { ifNoneExist: { name: string; value: string }[] } =>
  oystehr.fhir.create.mock.calls[call][1];
const inputValue = (task: Task, code: string): string | undefined =>
  task.input?.find((input) => input.type?.coding?.[0]?.code === code)?.valueString;

beforeEach(() => vi.mocked(captureException).mockClear());

// ─── crossing detection ───────────────────────────────────────────────────────

describe('detectStockCrossings', () => {
  it('fires reorder when the total falls from at or above the level to below it', () => {
    expect(detectStockCrossings({ before: 8, after: 7, reorderLevel: 8 })).toEqual(['reorder']);
    expect(detectStockCrossings({ before: 25, after: 5, reorderLevel: 8 })).toEqual(['reorder']);
  });

  it('does not fire again while already below, nor at exactly the level, nor on the way up', () => {
    expect(detectStockCrossings({ before: 5, after: 4, reorderLevel: 8 })).toEqual([]);
    expect(detectStockCrossings({ before: 9, after: 8, reorderLevel: 8 })).toEqual([]);
    expect(detectStockCrossings({ before: 4, after: 30, reorderLevel: 8 })).toEqual([]);
    expect(detectStockCrossings({ before: 0, after: 5, reorderLevel: 8 })).toEqual([]);
  });

  it('fires below-zero once when the total goes negative, with or without a reorder level', () => {
    expect(detectStockCrossings({ before: 0, after: -2 })).toEqual(['below-zero']);
    expect(detectStockCrossings({ before: -2, after: -3, reorderLevel: 8 })).toEqual([]);
    // a reorder level of 0 is "reorder when below zero", so that write is both events
    expect(detectStockCrossings({ before: 1, after: -1, reorderLevel: 0 })).toEqual(['reorder', 'below-zero']);
  });

  it('can fire both on one write', () => {
    expect(detectStockCrossings({ before: 10, after: -1, reorderLevel: 8 })).toEqual(['reorder', 'below-zero']);
  });
});

// ─── wording ──────────────────────────────────────────────────────────────────

describe('inventoryTaskWording', () => {
  const base = { drugName: 'Ketorolac 30 mg/ml', clinicName: 'Main Street Clinic', unit: 'vial' };

  it('words the four events as on the mockup', () => {
    expect(inventoryTaskWording({ code: 'reorder', ...base, onHand: 5, reorderLevel: 8 })).toEqual({
      title: 'Reorder Ketorolac 30 mg/ml',
      details: 'Main Street Clinic is at 5 vials; reorder level is 8.',
    });
    expect(inventoryTaskWording({ code: 'below-zero', ...base, onHand: -2 })).toEqual({
      title: 'Reconcile Ketorolac 30 mg/ml: below zero',
      details: 'Main Street Clinic shows −2 vials. Count the shelf.',
    });
    const lot = { lotNumber: 'C24117', expirationDate: '2026-11-15', onHand: 4 };
    expect(inventoryTaskWording({ code: 'expiring', ...base, ...lot })).toEqual({
      title: 'Ketorolac 30 mg/ml lot C24117 expires 11/15/2026',
      details: 'Main Street Clinic has 4 vials left in this lot.',
    });
    expect(
      inventoryTaskWording({ code: 'expired', ...base, lotNumber: 'B88120', expirationDate: '2026-09-30', onHand: 2 })
    ).toEqual({
      title: 'Remove expired lot B88120 (Ketorolac 30 mg/ml)',
      details: 'Expired 09/30/2026 with 2 vials left. Done by adjusting the lot out in Inventory.',
    });
  });

  it('uses the singular for one item and the raw unit when it is not a counted-as code', () => {
    expect(formatStockQuantity(1, 'vial')).toBe('1 vial');
    expect(formatStockQuantity(0, 'tube')).toBe('0 tubes');
    expect(formatStockQuantity(12.5, 'ml')).toBe('12.5 ml');
  });
});

// ─── expiring / expired selection ─────────────────────────────────────────────

describe('selectExpirationEvents', () => {
  const lot = (expirationDate: string, onHand: number, id = expirationDate): InventoryLot => ({
    id,
    catalogMedicationId: catalog.id,
    locationId: 'loc-a',
    lotNumber: `L-${id}`,
    expirationDate,
    onHand,
    unit: 'vial',
    status: 'active',
  });

  it('picks expired lots and lots within 30 days, and only those with stock', () => {
    const events = selectExpirationEvents(
      [lot('2026-10-29', 2), lot('2026-10-30', 1), lot('2026-11-29', 4), lot('2026-11-30', 3), lot('2026-11-01', 0)],
      '2026-10-30'
    );
    expect(events.map((event) => [event.lot.expirationDate, event.code])).toEqual([
      ['2026-10-29', 'expired'],
      ['2026-10-30', 'expiring'],
      ['2026-11-29', 'expiring'],
    ]);
  });
});

// ─── reorder / below-zero after a stock write ─────────────────────────────────

describe('createStockLevelTasksAfterWrite', () => {
  it('creates a reorder task at the clinic when the drug total crosses below the reorder level', async () => {
    // lot-1 now holds 3 (just wrote -4), lot-2 holds 2 → clinic total 5, was 9
    const oystehr = makeMockOystehr({ lots: [lotWith(3), lotWith(2, 'lot-2', 'B456')] });
    await createStockLevelTasksAfterWrite(oystehr, lotWith(3), -4);

    expect(oystehr.fhir.create).toHaveBeenCalledTimes(1);
    const task = createdTask(oystehr);
    expect(task.description).toBe('Reorder Ketorolac 30 mg/ml');
    expect(inputValue(task, INVENTORY_TASK.input.details)).toBe(
      'Main Street Clinic is at 5 vials; reorder level is 8.'
    );
    expect(inputValue(task, INVENTORY_TASK.input.medicationId)).toBe('med-ketorolac');
    expect(task.groupIdentifier?.value).toBe(INVENTORY_TASK.category);
    expect(task.code?.coding?.[0]).toEqual({ system: INVENTORY_TASK.system, code: 'reorder' });
    expect(getTaskLocation(task)).toEqual({ id: 'loc-a', name: 'Main Street Clinic' });
    expect(task.meta?.tag).toContainEqual({ code: 'task' });
    expect(task.identifier).toEqual([{ system: INVENTORY_TASK.identitySystem, value: 'reorder|med-ketorolac|loc-a' }]);
    expect(createOptions(oystehr).ifNoneExist).toEqual([
      { name: 'identifier', value: `${INVENTORY_TASK.identitySystem}|reorder|med-ketorolac|loc-a` },
      { name: 'status', value: 'ready,in-progress' },
    ]);
  });

  it('creates nothing when the drug was already below the level', async () => {
    const oystehr = makeMockOystehr({ lots: [lotWith(3)] });
    await createStockLevelTasksAfterWrite(oystehr, lotWith(3), -1);
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
  });

  it('creates a below-zero task when the drug total goes negative', async () => {
    const oystehr = makeMockOystehr({ lots: [lotWith(-2)] });
    await createStockLevelTasksAfterWrite(oystehr, lotWith(-2), -3);

    expect(oystehr.fhir.create).toHaveBeenCalledTimes(1);
    const task = createdTask(oystehr);
    expect(task.description).toBe('Reconcile Ketorolac 30 mg/ml: below zero');
    expect(inputValue(task, INVENTORY_TASK.input.details)).toBe('Main Street Clinic shows −2 vials. Count the shelf.');
    expect(task.identifier?.[0]?.value).toBe('below-zero|med-ketorolac|loc-a');
  });

  it('never throws: a task failure is logged and captured', async () => {
    const oystehr = makeMockOystehr({ lots: [lotWith(3), lotWith(2, 'lot-2', 'B456')] });
    oystehr.fhir.create.mockRejectedValue(new Error('FHIR down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(createStockLevelTasksAfterWrite(oystehr, lotWith(3), -4)).resolves.toBeUndefined();
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});

describe('writeInventoryStockEntry task hook', () => {
  it('still returns the written entry when the stock-level check fails', async () => {
    const oystehr = makeMockOystehr({ lots: [lotWith(3)] });
    oystehr.fhir.search.mockImplementation(({ resourceType }: { resourceType: string }) => {
      if (resourceType === 'Medication') throw new Error('search failed');
      return { unbundle: () => [] };
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const written = await writeInventoryStockEntry(oystehr, lotWith(7), {
      locationId: 'loc-a',
      type: 'adjustment',
      reason: 'broken-container',
      quantity: -4,
      unit: 'vial',
      effectiveDateTime: '2026-10-30T14:02:00Z',
    });
    expect(oystehr.fhir.transaction).toHaveBeenCalledTimes(1);
    expect(written.entry.valueQuantity?.value).toBe(-4);
    expect(oystehr.fhir.create).not.toHaveBeenCalled();
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('runs the reorder check against the lot the transaction returned', async () => {
    const oystehr = makeMockOystehr({ lots: [] });
    await writeInventoryStockEntry(oystehr, lotWith(10), {
      locationId: 'loc-a',
      type: 'administered',
      quantity: -3,
      unit: 'vial',
      effectiveDateTime: '2026-10-30T14:02:00Z',
    });
    // ledger is empty in this mock, so the written lot's on hand is -3: both crossings from a "before" of 0
    expect(oystehr.fhir.create).toHaveBeenCalledTimes(1);
    expect(createdTask(oystehr).identifier?.[0]?.value).toBe('below-zero|med-ketorolac|loc-a');
  });
});

// ─── daily expiration cron ────────────────────────────────────────────────────

describe('inventory-expiration-tasks cron', () => {
  it('creates an expiring task and an expired task, each once per lot', async () => {
    const oystehr = makeMockOystehr({
      lots: [lotWith(4, 'lot-c', 'C24117', '2026-11-15'), lotWith(2, 'lot-b', 'B88120', '2026-09-30')],
    });
    const summary = await expirationCron(oystehr, '2026-10-30');

    expect(summary).toEqual({ expiring: 1, expired: 1 });
    expect(oystehr.fhir.search.mock.calls[0][0].params).toContainEqual({
      name: 'expiration-date',
      value: 'le2026-11-29',
    });
    expect(oystehr.fhir.create).toHaveBeenCalledTimes(2);

    const expiring = createdTask(oystehr, 0);
    expect(expiring.description).toBe('Ketorolac 30 mg/ml lot C24117 expires 11/15/2026');
    expect(inputValue(expiring, INVENTORY_TASK.input.details)).toBe('Main Street Clinic has 4 vials left in this lot.');
    expect(inputValue(expiring, INVENTORY_TASK.input.lotId)).toBe('lot-c');
    expect(expiring.identifier?.[0]?.value).toBe('expiring|lot-c');
    expect(createOptions(oystehr, 0).ifNoneExist).toEqual([
      { name: 'identifier', value: `${INVENTORY_TASK.identitySystem}|expiring|lot-c` },
    ]);

    const expired = createdTask(oystehr, 1);
    expect(expired.description).toBe('Remove expired lot B88120 (Ketorolac 30 mg/ml)');
    expect(inputValue(expired, INVENTORY_TASK.input.details)).toBe(
      'Expired 09/30/2026 with 2 vials left. Done by adjusting the lot out in Inventory.'
    );
    expect(expired.identifier?.[0]?.value).toBe('expired|lot-b');
    expect(getTaskLocation(expired)).toEqual({ id: 'loc-a', name: 'Main Street Clinic' });
  });

  it('skips lots without stock and keeps going when one task fails', async () => {
    const oystehr = makeMockOystehr({
      lots: [
        lotWith(0, 'lot-empty', 'E1', '2026-11-01'),
        lotWith(1, 'lot-x', 'X1', '2026-11-02'),
        lotWith(1, 'lot-y', 'Y1', '2026-11-03'),
      ],
    });
    oystehr.fhir.create.mockRejectedValueOnce(new Error('FHIR down'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const summary = await expirationCron(oystehr, '2026-10-30');
    expect(summary).toEqual({ expiring: 1, expired: 0 });
    expect(oystehr.fhir.create).toHaveBeenCalledTimes(2);
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
