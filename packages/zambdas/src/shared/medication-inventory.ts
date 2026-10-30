import Oystehr, { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Medication, Observation } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { makeOptimisticLockIfMatchHeader, withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import {
  INVENTORY_ENTRY_TYPE_SYSTEM,
  INVENTORY_LOT_CLINIC_TAG_SYSTEM,
  INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM,
  INVENTORY_STOCK_ENTRY_CATEGORY_SYSTEM,
  INVENTORY_STOCK_ENTRY_CODE,
  InventoryStockEntryInput,
  isInventoryLot,
  makeInventoryStockEntry,
  sumStockEntries,
  withLotOnHand,
} from 'utils/lib/fhir/medication-inventory';
import { createStockLevelTasksAfterWrite } from './medication-inventory-tasks';

// Writes to the stock ledger. The FHIR shapes (and why they are Medication + Observation) live in
// utils/lib/fhir/medication-inventory.ts; this module owns the searches and the one-transaction write rule:
// every entry is created together with the lot's recomputed on-hand cache, under an If-Match on the lot.

const INVENTORY_CATEGORY_PARAM = `${INVENTORY_STOCK_ENTRY_CATEGORY_SYSTEM}|${INVENTORY_STOCK_ENTRY_CODE}`;

export interface InventoryLotKey {
  catalogMedicationId: string;
  locationId: string;
  lotNumber: string;
}

/** Every lot of `catalogMedicationId` at `locationId` with this lot number (one per expiration date). */
export async function findInventoryLotsByNumber(
  oystehr: Oystehr,
  { catalogMedicationId, locationId, lotNumber }: InventoryLotKey
): Promise<Medication[]> {
  const lots = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM}|${catalogMedicationId}` },
        { name: '_tag', value: `${INVENTORY_LOT_CLINIC_TAG_SYSTEM}|${locationId}` },
        { name: 'lot-number', value: lotNumber },
      ],
    })
  ).unbundle();
  // lot-number is a string search (prefix, case-insensitive); keep only the exact number
  return lots.filter((lot) => isInventoryLot(lot) && lot.batch?.lotNumber === lotNumber);
}

/** The lot of `catalogMedicationId` at `locationId` with this lot number and expiration date, if one exists. */
export async function findInventoryLot(
  oystehr: Oystehr,
  key: InventoryLotKey & { expirationDate: string }
): Promise<Medication | undefined> {
  return (await findInventoryLotsByNumber(oystehr, key)).find(
    (lot) => lot.batch?.expirationDate === key.expirationDate
  );
}

/** Every ledger entry of a lot, oldest first. */
export async function getInventoryLotEntries(oystehr: Oystehr, lotId: string): Promise<Observation[]> {
  return getAllFhirSearchPages<Observation>(
    {
      resourceType: 'Observation',
      params: [
        { name: 'subject', value: `Medication/${lotId}` },
        { name: 'category', value: INVENTORY_CATEGORY_PARAM },
        { name: '_sort', value: 'date' },
      ],
    },
    oystehr
  );
}

export type StockEntryWrite = Omit<InventoryStockEntryInput, 'lotReference'>;

/**
 * Appends one entry to a lot's ledger and refreshes the lot's on-hand cache in a single transaction.
 *
 * `lot` is either an existing lot (has an id; its current version guards the write with If-Match and the
 * write retries from a fresh read on a 412, at most 3 attempts) or a lot built with `makeInventoryLot` that
 * does not exist yet (created in the same bundle; the entry references it by transaction-local urn).
 * On hand is recomputed from every entry of the lot plus this one, never incremented. `reviseLot` changes
 * other lot fields (e.g. `batch.expirationDate`) in the same write; it is applied to whichever version of
 * the lot is written, so a retry from a fresh read keeps the change.
 *
 * After the write, the drug's clinic total is checked for reorder / below-zero tasks; that check never fails
 * the write.
 */
export async function writeInventoryStockEntry(
  oystehr: Oystehr,
  lot: Medication,
  entry: StockEntryWrite,
  reviseLot?: (lot: Medication) => Medication
): Promise<{ lot: Medication; entry: Observation }> {
  const written = await writeStockEntryTransaction(oystehr, lot, entry, reviseLot);
  await createStockLevelTasksAfterWrite(oystehr, written.lot, entry.quantity);
  return written;
}

async function writeStockEntryTransaction(
  oystehr: Oystehr,
  lot: Medication,
  entry: StockEntryWrite,
  reviseLot: (lot: Medication) => Medication = (lot) => lot
): Promise<{ lot: Medication; entry: Observation }> {
  if (!lot.id) {
    const lotUrn = `urn:uuid:${randomUUID()}`;
    const createLot: BatchInputPostRequest<Medication> = {
      method: 'POST',
      url: '/Medication',
      fullUrl: lotUrn,
      resource: withLotOnHand(lot, entry.quantity),
    };
    const createEntry: BatchInputPostRequest<Observation> = {
      method: 'POST',
      url: '/Observation',
      resource: makeInventoryStockEntry({ ...entry, lotReference: lotUrn }),
    };
    const result = await oystehr.fhir.transaction<Medication | Observation>({ requests: [createLot, createEntry] });
    return {
      lot: result.entry?.[0]?.resource as Medication,
      entry: result.entry?.[1]?.resource as Observation,
    };
  }

  const lotId = lot.id;
  let current = lot;
  return withVersionConflictRetries(
    async (attempt) => {
      if (attempt > 1) {
        current = await oystehr.fhir.get<Medication>({ resourceType: 'Medication', id: lotId });
      }
      const existingEntries = await getInventoryLotEntries(oystehr, lotId);
      const onHand = sumStockEntries(existingEntries) + entry.quantity;
      const createEntry: BatchInputPostRequest<Observation> = {
        method: 'POST',
        url: '/Observation',
        resource: makeInventoryStockEntry({ ...entry, lotReference: `Medication/${lotId}` }),
      };
      const updateLot: BatchInputPutRequest<Medication> = {
        method: 'PUT',
        url: `/Medication/${lotId}`,
        resource: withLotOnHand(reviseLot(current), onHand),
        ifMatch: makeOptimisticLockIfMatchHeader(current),
      };
      const result = await oystehr.fhir.transaction<Medication | Observation>({ requests: [createEntry, updateLot] });
      return {
        entry: result.entry?.[0]?.resource as Observation,
        lot: result.entry?.[1]?.resource as Medication,
      };
    },
    {
      onConflict: (attempt) =>
        console.log(`Medication/${lotId} changed while writing a stock entry, retrying (attempt ${attempt})`),
    }
  );
}

/** The lot of a drug (any clinic) whose "received" entry is newest, for prefilling the next receipt. */
export async function getLastReceivedLot(
  oystehr: Oystehr,
  catalogMedicationId: string
): Promise<Medication | undefined> {
  const lots = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM}|${catalogMedicationId}` },
        { name: '_elements', value: 'id' },
      ],
    })
  ).unbundle();
  const lotIds = lots.flatMap((lot) => (lot.id ? [lot.id] : []));
  if (lotIds.length === 0) return undefined;

  const resources = (
    await oystehr.fhir.search<Observation | Medication>({
      resourceType: 'Observation',
      params: [
        { name: 'subject', value: lotIds.map((id) => `Medication/${id}`).join(',') },
        { name: 'category', value: INVENTORY_CATEGORY_PARAM },
        { name: 'code', value: `${INVENTORY_ENTRY_TYPE_SYSTEM}|received` },
        { name: '_sort', value: '-date' },
        { name: '_count', value: '1' },
        { name: '_include', value: 'Observation:subject' },
      ],
    })
  ).unbundle();
  const newest = resources.find((resource): resource is Observation => resource.resourceType === 'Observation');
  const lotId = newest?.subject?.reference?.replace('Medication/', '');
  return resources.find(
    (resource): resource is Medication => resource.resourceType === 'Medication' && resource.id === lotId
  );
}
