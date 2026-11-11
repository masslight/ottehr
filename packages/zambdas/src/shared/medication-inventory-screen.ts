import { DateTime } from 'luxon';
import { isExpirationDatePast, sortInventoryLotsForPicking } from 'utils/lib/fhir/medication-inventory';
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
import { ListActiveLocationsOutput } from 'utils/lib/types/api/locations';

// The inventory screen's read model (requirement 7), built from the lots' cached on-hand numbers so the
// all-locations view never reads the ledger. Pure functions: the zambda does the searches. `today` is the
// user's date (YYYY-MM-DD); expiration dates are calendar dates, so they compare as strings.

/** A catalog drug that is set up for inventory. */
export interface TrackedDrug {
  medicationId: string;
  name: string;
  inventory: InHouseMedicationInventory;
}

const byName = <T extends { name: string }>(a: T, b: T): number => a.name.localeCompare(b.name);

/** `expired` when the date is past, `expiring` when it is within the next 30 days. */
export const expirationMarkers = (expirationDate: string | undefined, today: string): InventoryMarker[] => {
  if (!expirationDate) return [];
  if (isExpirationDatePast(expirationDate, today)) return ['expired'];
  const soon = DateTime.fromISO(today).plus({ days: INVENTORY_EXPIRING_SOON_DAYS }).toISODate() ?? '';
  return expirationDate.slice(0, 10) <= soon ? ['expiring'] : [];
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

const lotRow = (lot: InventoryLot, today: string): InventoryLotRow => ({
  ...lot,
  markers: [...expirationMarkers(lot.expirationDate, today), ...stockMarkers(lot.onHand, undefined)],
});

/** One row per tracked drug with a line per location (all-locations view); only lots at `locations` count. */
export const buildAllLocationsRows = (
  drugs: TrackedDrug[],
  lots: InventoryLot[],
  locations: ListActiveLocationsOutput['locations'],
  today: string
): InventoryDrugRow[] =>
  [...drugs].sort(byName).map((drug) => {
    const drugLots = lots.filter(
      (lot) =>
        lot.catalogMedicationId === drug.medicationId && locations.some((location) => location.id === lot.locationId)
    );
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

/** One row per tracked drug with its lots at `locationId` (location view), ordered as the MAR Lot field is. */
export const buildLocationRows = (
  drugs: TrackedDrug[],
  lots: InventoryLot[],
  locationId: string,
  today: string
): InventoryDrugRow[] =>
  [...drugs].sort(byName).map((drug) => {
    const drugLots = sortInventoryLotsForPicking(
      lots.filter((lot) => lot.catalogMedicationId === drug.medicationId && lot.locationId === locationId),
      today
    ).map((option) => option.lot);
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
