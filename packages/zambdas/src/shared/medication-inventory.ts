import Oystehr, { BatchInputPostRequest, BatchInputPutRequest } from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Encounter, FhirResource, Medication, MedicationAdministration, Observation } from 'fhir/r4b';
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
  getOrderCatalogMedicationId,
  getOrderInventoryLotId,
  INVENTORY_ENTRY_TYPE_SYSTEM,
  INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM,
  INVENTORY_LOT_LOCATION_TAG_SYSTEM,
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

const INVENTORY_CATEGORY_PARAM = `${INVENTORY_STOCK_ENTRY_CATEGORY_SYSTEM}|${INVENTORY_STOCK_ENTRY_CODE}`;

const escapeTokenSearchValue = (value: string): string => value.replace(/[,$|]/g, (char) => `\\${char}`); // Oystehr fails to match literal backslashes when they are escaped in token searches.

interface InventoryLotKey {
  catalogMedicationId: string;
  locationId: string;
  lotNumber: string;
}

export async function findInventoryLotsByNumber(
  oystehr: Oystehr,
  { catalogMedicationId, locationId, lotNumber }: InventoryLotKey
): Promise<Medication[]> {
  const lots = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM}|${catalogMedicationId}` },
        { name: '_tag', value: `${INVENTORY_LOT_LOCATION_TAG_SYSTEM}|${locationId}` },
        { name: 'lot-number', value: `|${escapeTokenSearchValue(lotNumber)}` },
      ],
    })
  ).unbundle();
  return lots.filter((lot) => isInventoryLot(lot) && lot.batch?.lotNumber === lotNumber);
}

export async function getInventoryLotsOnHand(
  oystehr: Oystehr,
  { catalogMedicationId, locationId }: { catalogMedicationId: string; locationId: string }
): Promise<InventoryLot[]> {
  const lots = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM}|${catalogMedicationId}` },
        { name: '_tag', value: `${INVENTORY_LOT_LOCATION_TAG_SYSTEM}|${locationId}` },
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

const lotEntrySearchParams = (lotId: string): { name: string; value: string }[] => [
  { name: 'subject', value: `Medication/${lotId}` },
  { name: 'category', value: INVENTORY_CATEGORY_PARAM },
  { name: '_sort', value: 'date' },
];

export async function getInventoryLotEntries(oystehr: Oystehr, lotId: string): Promise<Observation[]> {
  return getAllFhirSearchPages<Observation>(
    { resourceType: 'Observation', params: lotEntrySearchParams(lotId) },
    oystehr
  );
}

export async function getInventoryLotHistoryResources(oystehr: Oystehr, lotId: string): Promise<FhirResource[]> {
  return getAllFhirSearchPages<FhirResource>(
    {
      resourceType: 'Observation',
      params: [
        ...lotEntrySearchParams(lotId),
        { name: '_include', value: 'Observation:performer' },
        { name: '_include', value: 'Observation:part-of' },
        { name: '_include:iterate', value: 'MedicationAdministration:context' },
        { name: '_include:iterate', value: 'MedicationAdministration:subject' },
      ],
    },
    oystehr
  );
}

export type StockEntryWrite = Omit<InventoryStockEntryInput, 'lotReference'>;

/**
 * Recomputes on-hand stock from ledger entries and writes changes atomically.
 * Existing lots use optimistic locking with retries.
 */
export async function writeInventoryStockEntry(
  oystehr: Oystehr,
  lot: Medication,
  entry:
    | StockEntryWrite
    | StockEntryWrite[]
    | ((onHand: number, lotEntries: Observation[]) => StockEntryWrite | undefined),
  reviseLot: (lot: Medication) => Medication = (lot) => lot
): Promise<{ lot: Medication; entry: Observation | undefined }> {
  const entriesAt = (onHand: number, lotEntries: Observation[]): StockEntryWrite[] =>
    typeof entry === 'function' ? [entry(onHand, lotEntries) ?? []].flat() : Array.isArray(entry) ? entry : [entry];
  if (!lot.id) {
    const entries = entriesAt(0, []);
    const quantity = entries.reduce((total, written) => total + written.quantity, 0);
    const lotUrn = `urn:uuid:${randomUUID()}`;
    const createLot: BatchInputPostRequest<Medication> = {
      method: 'POST',
      url: '/Medication',
      fullUrl: lotUrn,
      resource: withLotOnHand(lot, quantity),
    };
    const createEntries = entries.map(
      (written): BatchInputPostRequest<Observation> => ({
        method: 'POST',
        url: '/Observation',
        resource: makeInventoryStockEntry({ ...written, lotReference: lotUrn }),
      })
    );
    const result = await oystehr.fhir.transaction<Medication | Observation>({
      requests: [createLot, ...createEntries],
    });
    return {
      lot: result.entry?.[0]?.resource as Medication,
      entry: result.entry?.[entries.length]?.resource as Observation,
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
      const balance = sumStockEntries(existingEntries);
      const entries = entriesAt(balance, existingEntries);
      if (entries.length === 0) return { lot: current, entry: undefined };
      const onHand = balance + entries.reduce((total, written) => total + written.quantity, 0);
      const createEntries = entries.map(
        (written): BatchInputPostRequest<Observation> => ({
          method: 'POST',
          url: '/Observation',
          resource: makeInventoryStockEntry({ ...written, lotReference: `Medication/${lotId}` }),
        })
      );
      const updateLot: BatchInputPutRequest<Medication> = {
        method: 'PUT',
        url: `/Medication/${lotId}`,
        resource: withLotOnHand(reviseLot(current), onHand),
        ifMatch: makeOptimisticLockIfMatchHeader(current),
      };
      const result = await oystehr.fhir.transaction<Medication | Observation>({
        requests: [...createEntries, updateLot],
      });
      return {
        entry: result.entry?.[entries.length - 1]?.resource as Observation,
        lot: result.entry?.[entries.length]?.resource as Medication,
      };
    },
    {
      onConflict: (attempt) =>
        console.log(`Medication/${lotId} changed while writing a stock entry, retrying (attempt ${attempt})`),
    }
  );
}

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

// Older medication orders lack the catalog ID, so fall back to name lookup.
async function findCatalogMedicationByName(oystehr: Oystehr, name: string): Promise<Medication | undefined> {
  const medications = (
    await oystehr.fhir.search<Medication>({
      resourceType: 'Medication',
      params: [{ name: 'identifier', value: `${MEDICATION_IDENTIFIER_NAME_SYSTEM}|${escapeTokenSearchValue(name)}` }],
    })
  ).unbundle();
  return medications.find(isCatalogMedication);
}

export async function findOrderCatalogMedication(
  oystehr: Oystehr,
  contained: Medication,
  name: string
): Promise<Medication | undefined> {
  const catalogId = getOrderCatalogMedicationId(contained);
  if (!catalogId) return findCatalogMedicationByName(oystehr, name);
  const medication = await oystehr.fhir.get<Medication>({ resourceType: 'Medication', id: catalogId });
  return isCatalogMedication(medication) ? medication : undefined;
}

// Preserve an existing stock deduction for legacy orders without a picked lot ID.
// Newly typed lots must not trigger a deduction.
async function resolveAdministrationStockTarget(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration,
  heldLotIds: string[],
  heldWithoutPickLotIds: string[]
): Promise<(AdministrationStockTarget & { lot: Medication }) | undefined> {
  const status = mapFhirToOrderStatus(medicationAdministration);
  if (status !== 'administered' && status !== 'administered-partly') return undefined;

  const contained = getMedicationFromMA(medicationAdministration);
  const lotNumber = contained?.batch?.lotNumber?.trim();
  const name = getMedicationName(contained);
  const { dose, units } = getDosageUnitsAndRouteOfMedication(medicationAdministration);
  const encounterId = medicationAdministration.context?.reference?.replace('Encounter/', '');
  if (!contained || !lotNumber || !name || dose === undefined || !units || !encounterId) return undefined;

  const encounter = await oystehr.fhir.get<Encounter>({ resourceType: 'Encounter', id: encounterId });
  const locationId = getEncounterLocationId(encounter);
  if (!locationId) return undefined;

  const catalog = await findOrderCatalogMedication(oystehr, contained, name);
  const inventory = catalog ? getMedicationInventoryConfig(catalog) : undefined;
  if (!catalog?.id || !inventory) return undefined;

  const sameNumber = await findInventoryLotsByNumber(oystehr, {
    catalogMedicationId: catalog.id,
    locationId,
    lotNumber,
  });
  const selectedLotId = getOrderInventoryLotId(contained);
  const expirationDate = contained?.batch?.expirationDate?.slice(0, 10);
  const heldWithoutPick = sameNumber.find(
    (candidate) =>
      candidate.id &&
      heldWithoutPickLotIds.includes(candidate.id) &&
      (sameNumber.length === 1 || candidate.batch?.expirationDate === expirationDate)
  );
  const lot =
    (selectedLotId && sameNumber.find((candidate) => candidate.id === selectedLotId)) ||
    sameNumber.find((candidate) => candidate.id && heldLotIds.includes(candidate.id)) ||
    heldWithoutPick;
  const taken = stockTakenForDose(inventory, dose, units);
  if (!lot?.id || !taken) return undefined;
  return { lotId: lot.id, lot, ...taken };
}

const administrationLotKey = (medicationAdministration: MedicationAdministration): string => {
  const contained = getMedicationFromMA(medicationAdministration);
  return JSON.stringify([
    getOrderCatalogMedicationId(contained),
    getMedicationName(contained),
    getOrderInventoryLotId(contained),
    contained?.batch?.lotNumber?.trim(),
    contained?.batch?.expirationDate?.slice(0, 10),
  ]);
};

const administrationStockBasis = (medicationAdministration: MedicationAdministration): string | undefined => {
  const status = mapFhirToOrderStatus(medicationAdministration);
  if (status !== 'administered' && status !== 'administered-partly') return undefined;
  const { dose, units } = getDosageUnitsAndRouteOfMedication(medicationAdministration);
  return JSON.stringify([administrationLotKey(medicationAdministration), dose, units]);
};

export const administrationStockChanged = (
  before: MedicationAdministration,
  after: MedicationAdministration
): boolean => administrationStockBasis(before) !== administrationStockBasis(after);

export async function reconcileAdministrationStock(
  oystehr: Oystehr,
  medicationAdministration: MedicationAdministration,
  performerReference: string,
  previous?: MedicationAdministration
): Promise<void> {
  const medicationAdministrationId = medicationAdministration.id;
  if (!medicationAdministrationId) return;
  const existing = (await getAdministrationStockEntries(oystehr, medicationAdministrationId)).flatMap(
    (entry) => parseInventoryStockEntry(entry) ?? []
  );
  const sameLotAsBefore =
    previous !== undefined && administrationLotKey(previous) === administrationLotKey(medicationAdministration);
  const neverPicked =
    previous !== undefined &&
    !getOrderInventoryLotId(getMedicationFromMA(previous)) &&
    !getOrderInventoryLotId(getMedicationFromMA(medicationAdministration));
  const heldLotIds = [...new Set(existing.map((entry) => entry.lotId))].filter(
    (lotId) => existing.reduce((sum, entry) => sum + (entry.lotId === lotId ? entry.quantity : 0), 0) < 0
  );
  const target = await resolveAdministrationStockTarget(
    oystehr,
    medicationAdministration,
    sameLotAsBefore ? heldLotIds : [],
    neverPicked ? heldLotIds : []
  );
  const changes = planAdministrationStockChanges(target, existing);
  for (const change of changes) {
    const lot =
      change.lotId === target?.lotId
        ? target.lot
        : await oystehr.fhir.get<Medication>({ resourceType: 'Medication', id: change.lotId });
    const parsedLot = parseInventoryLot(lot);
    if (!parsedLot) throw new Error(`Medication/${change.lotId} is not an inventory lot`);
    await writeInventoryStockEntry(oystehr, lot, (_onHand, lotEntries) => {
      const recorded = lotEntries
        .flatMap((entry) => parseInventoryStockEntry(entry) ?? [])
        .filter((entry) => entry.medicationAdministrationId === medicationAdministrationId);
      const current = planAdministrationStockChanges(target, recorded).find(
        (planned) => planned.lotId === change.lotId
      );
      if (!current) return undefined;
      return {
        locationId: parsedLot.locationId,
        type: current.type,
        ...(current.waste ? { reason: 'partial-dose-waste' } : {}),
        quantity: current.quantity,
        unit: parsedLot.unit,
        performerReference,
        effectiveDateTime: DateTime.now().toUTC().toISO(),
        medicationAdministrationId,
        reversesEntryId: current.reversesEntryId,
        administrationDeleted: current.administrationDeleted,
        ...(current.waste
          ? { components: [{ code: 'waste-amount', value: current.waste.amount, unit: current.waste.unit }] }
          : {}),
      };
    });
  }
}

export async function getLastReceivedLot(
  oystehr: Oystehr,
  catalogMedicationId: string
): Promise<Medication | undefined> {
  const lots = await getAllFhirSearchPages<Medication>(
    {
      resourceType: 'Medication',
      params: [
        { name: 'identifier', value: `${INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM}|${catalogMedicationId}` },
        { name: '_elements', value: 'id' },
      ],
    },
    oystehr
  );
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
