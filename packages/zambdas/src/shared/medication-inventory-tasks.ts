import Oystehr from '@oystehr/sdk';
import { captureException } from '@sentry/node-core/light';
import { FhirResource, Location, Medication, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getMedicationName } from 'utils/lib/fhir/medication-administration';
import {
  getMedicationInventoryConfig,
  INVENTORY_LOT_CLINIC_TAG_SYSTEM,
  INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM,
  parseInventoryLot,
} from 'utils/lib/fhir/medication-inventory';
import {
  InventoryLot,
  MEDICATION_COUNTED_AS_LABELS,
  MedicationCountedAs,
} from 'utils/lib/types/api/config/in-house-medications';
import { INVENTORY_TASK } from 'utils/lib/types/data/tasks/types';
import { createTask } from './tasks';

// Inventory tasks (requirement 8): reorder and below-zero are checked right after every stock write
// (`createStockLevelTasksAfterWrite`, called by `writeInventoryStockEntry`); expiring and expired are found
// by the daily inventory-expiration-tasks cron. Each task carries an identity identifier and is created with
// If-None-Exist on it, so a repeat of the same event never piles up a second task.

/** A lot is "expiring" once its expiration date is within this many days. */
export const EXPIRING_WINDOW_DAYS = 30;
const TASK_DATE_FORMAT = 'MM/dd/yyyy';
const MINUS_SIGN = '−';
/** A reorder / below-zero task is skipped while one for the same drug and clinic is still open. */
const OPEN_TASK_STATUSES = 'ready,in-progress';

type InventoryTaskCode = (typeof INVENTORY_TASK.code)[keyof typeof INVENTORY_TASK.code];

/** "5 vials", "1 vial"; a unit that is not a counted-as code (e.g. ml) is shown as is. */
export const formatStockQuantity = (quantity: number, unit: string): string => {
  const labels = MEDICATION_COUNTED_AS_LABELS[unit as MedicationCountedAs];
  if (!labels) return `${quantity} ${unit}`;
  return `${quantity} ${quantity === 1 ? labels.singular.toLowerCase() : labels.plural}`;
};

const formatTaskDate = (isoDate: string): string => DateTime.fromISO(isoDate).toFormat(TASK_DATE_FORMAT);

export type InventoryTaskEvent =
  | { code: 'reorder'; drugName: string; clinicName: string; onHand: number; unit: string; reorderLevel: number }
  | { code: 'below-zero'; drugName: string; clinicName: string; onHand: number; unit: string }
  | {
      code: 'expiring' | 'expired';
      drugName: string;
      clinicName: string;
      lotNumber: string;
      expirationDate: string;
      onHand: number;
      unit: string;
    };

/** The task title and detail sentence for an event, worded as on the Tasks page mockup. */
export const inventoryTaskWording = (event: InventoryTaskEvent): { title: string; details: string } => {
  switch (event.code) {
    case 'reorder':
      return {
        title: `Reorder ${event.drugName}`,
        details: `${event.clinicName} is at ${formatStockQuantity(event.onHand, event.unit)}; reorder level is ${
          event.reorderLevel
        }.`,
      };
    case 'below-zero':
      return {
        title: `Reconcile ${event.drugName}: below zero`,
        details: `${event.clinicName} shows ${MINUS_SIGN}${formatStockQuantity(
          Math.abs(event.onHand),
          event.unit
        )}. Count the shelf.`,
      };
    case 'expiring':
      return {
        title: `${event.drugName} lot ${event.lotNumber} expires ${formatTaskDate(event.expirationDate)}`,
        details: `${event.clinicName} has ${formatStockQuantity(event.onHand, event.unit)} left in this lot.`,
      };
    case 'expired':
      return {
        title: `Remove expired lot ${event.lotNumber} (${event.drugName})`,
        details: `Expired ${formatTaskDate(event.expirationDate)} with ${formatStockQuantity(
          event.onHand,
          event.unit
        )} left. Done by adjusting the lot out in Inventory.`,
      };
  }
};

/**
 * The identity that makes an event "once": drug-level events (reorder, below zero) are per drug and clinic,
 * lot-level events (expiring, expired) per lot, which already names its clinic.
 */
export const inventoryTaskIdentity = (code: InventoryTaskCode, ...parts: string[]): string =>
  [code, ...parts].join('|');

export interface InventoryTaskSpec {
  code: InventoryTaskCode;
  identity: string;
  event: InventoryTaskEvent;
  location: { id: string; name?: string };
  medicationId: string;
  lotId?: string;
}

export const makeInventoryTask = (spec: InventoryTaskSpec): Task => {
  const { title, details } = inventoryTaskWording(spec.event);
  return {
    ...createTask({
      category: INVENTORY_TASK.category,
      title,
      code: { system: INVENTORY_TASK.system, code: spec.code },
      location: spec.location,
      input: [
        { type: INVENTORY_TASK.input.details, valueString: details },
        { type: INVENTORY_TASK.input.medicationId, valueString: spec.medicationId },
        { type: INVENTORY_TASK.input.lotId, valueString: spec.lotId },
      ],
    }),
    identifier: [{ system: INVENTORY_TASK.identitySystem, value: spec.identity }],
  };
};

/**
 * Conditional create on the task's identity: the server creates it only when no task with that identity
 * exists (`openOnly`: no open one — a drug may fall below its reorder level again after recovering).
 */
export async function createInventoryTaskOnce(oystehr: Oystehr, task: Task, openOnly: boolean): Promise<Task> {
  const identity = task.identifier?.find((identifier) => identifier.system === INVENTORY_TASK.identitySystem);
  if (!identity?.value) throw new Error('Inventory task is missing its identity identifier');
  const result = await oystehr.fhir.create<Task>(task, {
    ifNoneExist: [
      { name: 'identifier', value: `${identity.system}|${identity.value}` },
      ...(openOnly ? [{ name: 'status', value: OPEN_TASK_STATUSES }] : []),
    ],
  });
  console.log(`Inventory task ${identity.value}: Task/${result.id}`);
  return result;
}

/** Which drug-level events a stock change from `before` to `after` triggers. Already below → none. */
export const detectStockCrossings = ({
  before,
  after,
  reorderLevel,
}: {
  before: number;
  after: number;
  reorderLevel?: number;
}): ('reorder' | 'below-zero')[] => [
  ...(reorderLevel !== undefined && before >= reorderLevel && after < reorderLevel ? ['reorder' as const] : []),
  ...(before >= 0 && after < 0 ? ['below-zero' as const] : []),
];

export interface InventoryExpirationEvent {
  lot: InventoryLot;
  code: 'expiring' | 'expired';
}

/** Lots with stock that are past, or within `EXPIRING_WINDOW_DAYS` of, their expiration date on `today`. */
export const selectExpirationEvents = (lots: InventoryLot[], today: string): InventoryExpirationEvent[] => {
  const windowEnd = DateTime.fromISO(today).plus({ days: EXPIRING_WINDOW_DAYS }).toISODate() ?? today;
  return lots.flatMap((lot): InventoryExpirationEvent[] => {
    if (lot.onHand <= 0 || !lot.expirationDate) return [];
    if (lot.expirationDate < today) return [{ lot, code: 'expired' }];
    if (lot.expirationDate <= windowEnd) return [{ lot, code: 'expiring' }];
    return [];
  });
};

export async function getResourcesByIds<T extends FhirResource>(
  oystehr: Oystehr,
  resourceType: T['resourceType'],
  ids: string[]
): Promise<Map<string, T>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const resources = (
    await oystehr.fhir.search<T>({
      resourceType,
      params: [
        { name: '_id', value: unique.join(',') },
        { name: '_count', value: `${unique.length}` },
      ],
    })
  ).unbundle();
  return new Map(resources.flatMap((resource) => (resource.id ? [[resource.id, resource]] : [])));
}

export const inventoryDrugName = (catalog: Medication): string =>
  getMedicationName(catalog) ?? catalog.code?.text ?? `Medication/${catalog.id}`;

/**
 * Reorder and below-zero checks for the drug at the lot's clinic, comparing the clinic total before and
 * after an entry of `quantity` was written to `writtenLot`. Never throws: a task problem is logged and
 * captured, and must not fail the stock write that called this.
 */
export async function createStockLevelTasksAfterWrite(
  oystehr: Oystehr,
  writtenLot: Medication,
  quantity: number
): Promise<void> {
  try {
    const lot = parseInventoryLot(writtenLot);
    if (!lot) return;
    const siblings = (
      await oystehr.fhir.search<Medication>({
        resourceType: 'Medication',
        params: [
          { name: 'identifier', value: `${INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM}|${lot.catalogMedicationId}` },
          { name: '_tag', value: `${INVENTORY_LOT_CLINIC_TAG_SYSTEM}|${lot.locationId}` },
        ],
      })
    )
      .unbundle()
      .flatMap((candidate) => (candidate.id === lot.id ? [] : parseInventoryLot(candidate) ?? []));
    // the written lot comes from the transaction result, not the search, so a stale index cannot miss it
    const after = siblings.reduce((total, sibling) => total + sibling.onHand, lot.onHand);
    const before = after - quantity;

    const catalog = await oystehr.fhir.get<Medication>({ resourceType: 'Medication', id: lot.catalogMedicationId });
    const reorderLevel = getMedicationInventoryConfig(catalog)?.reorderLevels.find(
      (level) => level.locationId === lot.locationId
    )?.level;
    const crossings = detectStockCrossings({ before, after, reorderLevel });
    if (crossings.length === 0) return;

    const location = await oystehr.fhir.get<Location>({ resourceType: 'Location', id: lot.locationId });
    const common = {
      drugName: inventoryDrugName(catalog),
      clinicName: location.name ?? '',
      onHand: after,
      unit: lot.unit,
    };
    for (const code of crossings) {
      const event: InventoryTaskEvent =
        code === 'reorder' ? { code, ...common, reorderLevel: reorderLevel ?? 0 } : { code, ...common };
      await createInventoryTaskOnce(
        oystehr,
        makeInventoryTask({
          code,
          identity: inventoryTaskIdentity(code, lot.catalogMedicationId, lot.locationId),
          event,
          location: { id: lot.locationId, name: location.name },
          medicationId: lot.catalogMedicationId,
        }),
        true
      );
    }
  } catch (error) {
    console.error(`Failed to check stock levels after writing to Medication/${writtenLot.id}:`, error);
    captureException(error, { tags: { lotId: writtenLot.id } });
  }
}
