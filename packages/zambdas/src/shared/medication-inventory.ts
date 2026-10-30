import Oystehr, { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Encounter, Medication, MedicationAdministration, Observation } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getEncounterLocationId } from 'utils/lib/fhir/encounter';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { makeOptimisticLockIfMatchHeader, withVersionConflictRetries } from 'utils/lib/fhir/helpers';
import {
  getDosageUnitsAndRouteOfMedication,
  getMedicationFromMA,
  getMedicationName,
  mapFhirToOrderStatus,
} from 'utils/lib/fhir/medication-administration';
import {
  AdministrationStockTarget,
  getMedicationInventoryConfig,
  INVENTORY_ENTRY_TYPE_SYSTEM,
  INVENTORY_LOT_CLINIC_TAG_SYSTEM,
  INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM,
  INVENTORY_STOCK_ENTRY_CATEGORY_SYSTEM,
  INVENTORY_STOCK_ENTRY_CODE,
  InventoryStockEntryInput,
  isCatalogMedication,
  isInventoryLot,
  makeInventoryStockEntry,
  parseInventoryLot,
  parseInventoryStockEntry,
  planAdministrationStockChanges,
  stockTakenForDose,
  sumStockEntries,
  withLotOnHand,
} from 'utils/lib/fhir/medication-inventory';
import { InventoryLot } from 'utils/lib/types/api/config/in-house-medications';
import { MEDICATION_IDENTIFIER_NAME_SYSTEM } from 'utils/lib/types/api/medication-administration.constants';

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

/** Lots of `catalogMedicationId` with stock on hand at `locationId`, soonest expiration first (the MAR Lot field). */
export async function getInventoryLotsOnHand(
  oystehr: Oystehr,
  { catalogMedicationId, locationId }: { catalogMedicationId: string; locationId: string }
): Promise<InventoryLot[]> {
  const lots = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM}|${catalogMedicationId}` },
        { name: '_tag', value: `${INVENTORY_LOT_CLINIC_TAG_SYSTEM}|${locationId}` },
        { name: 'status', value: 'active' },
        { name: '_sort', value: 'expiration-date' },
      ],
    })
  ).unbundle();
  return lots
    .filter(isInventoryLot)
    .flatMap((lot) => {
      const parsed = parseInventoryLot(lot);
      return parsed && parsed.onHand > 0 ? [parsed] : [];
    })
    .sort((a, b) => a.expirationDate.localeCompare(b.expirationDate));
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
 */
export async function writeInventoryStockEntry(
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

/** What the ledger already took off for an administration, oldest first. */
async function getAdministrationStockEntries(
  oystehr: Oystehr,
  medicationAdministrationId: string
): Promise<Observation[]> {
  return getAllFhirSearchPages<Observation>(
    {
      resourceType: 'Observation',
      params: [
        { name: 'part-of', value: `MedicationAdministration/${medicationAdministrationId}` },
        { name: 'category', value: INVENTORY_CATEGORY_PARAM },
        { name: '_sort', value: 'date' },
      ],
    },
    oystehr
  );
}

/**
 * The catalog drug an order's contained Medication copy was made from. The copy keeps the catalog's name
 * identifier but not its id, and an existing order's `medicationId` is the contained sentinel.
 */
async function findCatalogMedicationByName(oystehr: Oystehr, name: string): Promise<Medication | undefined> {
  const medications = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [{ name: 'identifier', value: `${MEDICATION_IDENTIFIER_NAME_SYSTEM}|${name}` }],
    })
  ).unbundle();
  return medications.find(isCatalogMedication);
}

/**
 * What an administration should have off the shelf right now: the lot of its drug at the visit's clinic
 * with the lot number on the order, and what the dose takes from it. Undefined when nothing should be off:
 * the order isn't administered, the drug isn't tracked, the lot was typed (not in inventory), or the drug
 * is multi-use.
 */
async function resolveAdministrationStockTarget(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration
): Promise<(AdministrationStockTarget & { lot: Medication }) | undefined> {
  const status = mapFhirToOrderStatus(medicationAdministration);
  if (status !== 'administered' && status !== 'administered-partly') return undefined;

  const contained = getMedicationFromMA(medicationAdministration);
  const lotNumber = contained?.batch?.lotNumber?.trim();
  const name = getMedicationName(contained);
  const { dose, units } = getDosageUnitsAndRouteOfMedication(medicationAdministration);
  const encounterId = medicationAdministration.context?.reference?.replace('Encounter/', '');
  if (!lotNumber || !name || dose === undefined || !units || !encounterId) return undefined;

  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  const locationId = getEncounterLocationId(encounter);
  if (!locationId) return undefined;

  const catalog = await findCatalogMedicationByName(oystehr, name);
  const inventory = catalog ? getMedicationInventoryConfig(catalog) : undefined;
  if (!catalog?.id || !inventory) return undefined;

  // The same number can be on hand with two expiration dates; the order's date (a date or date-time) picks one.
  const sameNumber = await findInventoryLotsByNumber(oystehr, {
    catalogMedicationId: catalog.id,
    locationId,
    lotNumber,
  });
  const expirationDate = contained?.batch?.expirationDate?.slice(0, 10);
  const lot =
    sameNumber.length === 1
      ? sameNumber[0]
      : sameNumber.find((candidate) => candidate.batch?.expirationDate === expirationDate);
  const taken = stockTakenForDose(inventory, dose, units);
  if (!lot?.id || !taken) return undefined;
  return { lotId: lot.id, lot, ...taken };
}

/**
 * Brings the stock ledger in line with an administration (requirements 4 and 5): writes the difference
 * between what the order should have taken off and what its entries already took off, per lot. Call after
 * every save and delete of an order; a no-op for untracked drugs, typed lots and orders not administered.
 */
export async function reconcileAdministrationStock(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration,
  performerReference: string
): Promise<void> {
  const medicationAdministrationId = medicationAdministration.id;
  if (!medicationAdministrationId) return;
  const [existing, target] = await Promise.all([
    getAdministrationStockEntries(oystehr, medicationAdministrationId),
    resolveAdministrationStockTarget(oystehr, medicationAdministration),
  ]);
  const changes = planAdministrationStockChanges(
    target,
    existing.flatMap((entry) => parseInventoryStockEntry(entry) ?? [])
  );
  for (const change of changes) {
    const lot =
      change.lotId === target?.lotId
        ? target.lot
        : await oystehr.fhir.get<Medication>({ resourceType: 'Medication', id: change.lotId });
    const parsedLot = parseInventoryLot(lot);
    if (!parsedLot) throw new Error(`Medication/${change.lotId} is not an inventory lot`);
    await writeInventoryStockEntry(oystehr, lot, {
      locationId: parsedLot.locationId,
      type: change.type,
      ...(change.waste ? { reason: 'partial-dose-waste' } : {}),
      quantity: change.quantity,
      unit: parsedLot.unit,
      performerReference,
      effectiveDateTime: DateTime.now().toUTC().toISO(),
      medicationAdministrationId,
      reversesEntryId: change.reversesEntryId,
      ...(change.waste
        ? { components: [{ code: 'waste-amount', value: change.waste.amount, unit: change.waste.unit }] }
        : {}),
    });
  }
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
