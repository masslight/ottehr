import { DateTime } from 'luxon';
import {
  InHouseMedicationInventory,
  INVENTORY_EXPIRING_SOON_DAYS,
  InventoryDrugRow,
  InventoryHistoryEntry,
  InventoryLocationLine,
  InventoryLot,
  InventoryLotRow,
  InventoryMarker,
  InventoryStockEntry,
} from 'utils/lib/types/api/config/in-house-medications';

// The inventory screen's read model (requirement 7), built from the lots' cached on-hand numbers so the
// all-locations view never reads the ledger. Pure functions: the zambda does the searches.

/** A catalog drug that is set up for inventory. */
export interface TrackedDrug {
  medicationId: string;
  name: string;
  inventory: InHouseMedicationInventory;
}

export interface ActiveLocation {
  id: string;
  name: string;
}

const byName = <T extends { name: string }>(a: T, b: T): number => a.name.localeCompare(b.name);

// Expiration dates are calendar dates (YYYY-MM-DD, no zone), so they compare as strings against today's date.
const ISO_DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;
const isoDate = (date: string): string | undefined => (ISO_DATE_PREFIX.test(date) ? date.slice(0, 10) : undefined);

const isExpired = (expirationDate: string, today: DateTime): boolean => {
  const date = isoDate(expirationDate);
  return date !== undefined && date < (today.toISODate() ?? '');
};

/** `expired` when the date is past, `expiring` when it is within the next 30 days. */
export const expirationMarkers = (expirationDate: string | undefined, today: DateTime): InventoryMarker[] => {
  const date = expirationDate ? isoDate(expirationDate) : undefined;
  if (!date) return [];
  if (isExpired(date, today)) return ['expired'];
  return date <= (today.plus({ days: INVENTORY_EXPIRING_SOON_DAYS }).toISODate() ?? '') ? ['expiring'] : [];
};

const stockMarkers = (onHand: number, reorderLevel: number | undefined): InventoryMarker[] => [
  ...(reorderLevel !== undefined && onHand <= reorderLevel ? (['low'] as const) : []),
  ...(onHand < 0 ? (['below-zero'] as const) : []),
];

/** Soonest expiration among lots that have stock. */
const earliestExpiration = (lots: InventoryLot[]): string | undefined =>
  lots
    .filter((lot) => lot.onHand > 0 && lot.expirationDate)
    .map((lot) => lot.expirationDate)
    .sort()[0];

const sumOnHand = (lots: InventoryLot[]): number => lots.reduce((total, lot) => total + lot.onHand, 0);

/** Soonest expiration first; expired lots last (the MAR orders them the same way). */
export const sortLots = (lots: InventoryLot[], today: DateTime): InventoryLot[] =>
  [...lots].sort((a, b) => {
    const expiredA = isExpired(a.expirationDate, today);
    const expiredB = isExpired(b.expirationDate, today);
    if (expiredA !== expiredB) return expiredA ? 1 : -1;
    return a.expirationDate.localeCompare(b.expirationDate) || a.lotNumber.localeCompare(b.lotNumber);
  });

const lotRow = (lot: InventoryLot, today: DateTime): InventoryLotRow => ({
  ...lot,
  markers: [...expirationMarkers(lot.expirationDate, today), ...stockMarkers(lot.onHand, undefined)],
});

/** One row per tracked drug with a line per location (all-locations view). */
export const buildAllLocationsRows = (
  drugs: TrackedDrug[],
  lots: InventoryLot[],
  locations: ActiveLocation[],
  today: DateTime
): InventoryDrugRow[] =>
  [...drugs].sort(byName).map((drug) => {
    const drugLots = lots.filter((lot) => lot.catalogMedicationId === drug.medicationId);
    const lines: InventoryLocationLine[] = [...locations].sort(byName).map((location) => {
      const locationLots = drugLots.filter((lot) => lot.locationId === location.id);
      const onHand = sumOnHand(locationLots);
      const reorderLevel = drug.inventory.reorderLevels.find((level) => level.locationId === location.id)?.level;
      const expiration = earliestExpiration(locationLots);
      return {
        locationId: location.id,
        locationName: location.name,
        onHand,
        ...(reorderLevel !== undefined ? { reorderLevel } : {}),
        ...(expiration ? { earliestExpiration: expiration } : {}),
        markers: [...stockMarkers(onHand, reorderLevel), ...expirationMarkers(expiration, today)],
      };
    });
    const onHand = sumOnHand(drugLots);
    const expiration = earliestExpiration(drugLots);
    const locationsBelowReorderLevel = lines.filter((line) => line.markers.includes('low')).length;
    return {
      medicationId: drug.medicationId,
      name: drug.name,
      countedAs: drug.inventory.countedAs,
      use: drug.inventory.use,
      onHand,
      ...(expiration ? { earliestExpiration: expiration } : {}),
      locationsBelowReorderLevel,
      locationsWithReorderLevel: lines.filter((line) => line.reorderLevel !== undefined).length,
      markers: [
        ...(locationsBelowReorderLevel > 0 ? (['low'] as const) : []),
        ...stockMarkers(onHand, undefined),
        ...expirationMarkers(expiration, today),
      ],
      locations: lines,
      lots: [],
    };
  });

/** One row per tracked drug with its lots at `locationId` (location view). */
export const buildLocationRows = (
  drugs: TrackedDrug[],
  lots: InventoryLot[],
  locationId: string,
  today: DateTime
): InventoryDrugRow[] =>
  [...drugs].sort(byName).map((drug) => {
    const drugLots = sortLots(
      lots.filter((lot) => lot.catalogMedicationId === drug.medicationId && lot.locationId === locationId),
      today
    );
    const onHand = sumOnHand(drugLots);
    const reorderLevel = drug.inventory.reorderLevels.find((level) => level.locationId === locationId)?.level;
    const expiration = earliestExpiration(drugLots);
    const low = reorderLevel !== undefined && onHand <= reorderLevel;
    return {
      medicationId: drug.medicationId,
      name: drug.name,
      countedAs: drug.inventory.countedAs,
      use: drug.inventory.use,
      onHand,
      ...(expiration ? { earliestExpiration: expiration } : {}),
      ...(reorderLevel !== undefined ? { reorderLevel } : {}),
      locationsBelowReorderLevel: low ? 1 : 0,
      locationsWithReorderLevel: reorderLevel !== undefined ? 1 : 0,
      markers: [...stockMarkers(onHand, reorderLevel), ...expirationMarkers(expiration, today)],
      locations: [],
      lots: drugLots.map((lot) => lotRow(lot, today)),
    };
  });

export interface HistoryNames {
  /** Performer reference (`Practitioner/{id}`) → display name. */
  performers: Map<string, string>;
  /** MedicationAdministration id → the visit it belongs to. */
  visits: Map<string, NonNullable<InventoryHistoryEntry['visit']>>;
}

/** A lot's ledger, oldest first in, newest first out, with the running on-hand total after each entry. */
export const buildHistory = (entries: InventoryStockEntry[], names: HistoryNames): InventoryHistoryEntry[] => {
  let onHand = 0;
  return entries
    .map((entry) => {
      onHand += entry.quantity;
      const performerName = entry.performerReference ? names.performers.get(entry.performerReference) : undefined;
      const visit = entry.medicationAdministrationId ? names.visits.get(entry.medicationAdministrationId) : undefined;
      return {
        ...entry,
        onHandAfter: onHand,
        ...(performerName ? { performerName } : {}),
        ...(visit ? { visit } : {}),
      };
    })
    .reverse();
};
