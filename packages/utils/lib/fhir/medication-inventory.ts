import { Coding, Extension, Medication, Observation } from 'fhir/r4b';
import { CODE_SYSTEM_NDC } from '../helpers/rcm/constants';
import {
  InHouseMedicationInventory,
  InHouseMedicationInventorySchema,
  INVENTORY_ENTRY_COMPONENTS,
  INVENTORY_ENTRY_REASONS,
  INVENTORY_ENTRY_TYPES,
  InventoryEntryComponent,
  InventoryEntryReason,
  InventoryEntryType,
  InventoryLot,
  InventoryStockEntry,
} from '../types/api/config/in-house-medications';
import {
  INVENTORY_MEDICATION_TYPE_CODE,
  MEDICATION_ADMINISTRATION_UNITS_SYSTEM,
  MEDICATION_CATALOG_ID_IDENTIFIER_SYSTEM,
  MEDICATION_TYPE_SYSTEM,
} from '../types/api/medication-administration.constants';
import { getExtension, getTag } from './helpers';
import { getMedicationName } from './medication-administration';
import { ottehrCodeSystemUrl, ottehrExtensionUrl, ottehrIdentifierSystem } from './systemUrls';

/** On an in-house Medication: its inventory setup. Absent means the drug is not tracked. */
export const MEDICATION_INVENTORY_EXTENSION_URL = ottehrExtensionUrl('medication-inventory');

const COUNTED_AS = 'counted-as';
const EACH_CONTAINS = 'each-contains';
const EACH_CONTAINS_IN = 'each-contains-in';
const USE = 'use';
const REORDER_LEVEL = 'reorder-level';
const REORDER_LEVEL_CLINIC = 'clinic';
const REORDER_LEVEL_LEVEL = 'level';

const makeAmountExtension = (url: string, amount: { amount: number; unit: string }): Extension => ({
  url,
  valueQuantity: { value: amount.amount, unit: amount.unit, system: MEDICATION_ADMINISTRATION_UNITS_SYSTEM },
});

const readAmount = (extension: Extension | undefined): { amount?: number; unit?: string } | undefined =>
  extension?.valueQuantity ? { amount: extension.valueQuantity.value, unit: extension.valueQuantity.unit } : undefined;

export const makeMedicationInventoryExtension = (inventory: InHouseMedicationInventory): Extension => ({
  url: MEDICATION_INVENTORY_EXTENSION_URL,
  extension: [
    { url: COUNTED_AS, valueCode: inventory.countedAs },
    makeAmountExtension(EACH_CONTAINS, inventory.eachContains),
    ...(inventory.eachContains.in ? [makeAmountExtension(EACH_CONTAINS_IN, inventory.eachContains.in)] : []),
    { url: USE, valueCode: inventory.use },
    ...[...inventory.reorderLevels]
      .sort((a, b) => a.locationId.localeCompare(b.locationId))
      .map(({ locationId, level }) => ({
        url: REORDER_LEVEL,
        extension: [
          { url: REORDER_LEVEL_CLINIC, valueReference: { reference: `Location/${locationId}` } },
          { url: REORDER_LEVEL_LEVEL, valueInteger: level },
        ],
      })),
  ],
});

/** The inventory setup on a Medication, or undefined when it has none (or an unreadable one). */
export const getMedicationInventoryConfig = (medication: Medication): InHouseMedicationInventory | undefined => {
  const root = getExtension(medication, MEDICATION_INVENTORY_EXTENSION_URL);
  if (!root) return undefined;
  const inAmount = readAmount(getExtension(root, EACH_CONTAINS_IN));
  const parsed = InHouseMedicationInventorySchema.safeParse({
    countedAs: getExtension(root, COUNTED_AS)?.valueCode,
    eachContains: { ...readAmount(getExtension(root, EACH_CONTAINS)), ...(inAmount ? { in: inAmount } : {}) },
    use: getExtension(root, USE)?.valueCode,
    reorderLevels: (root.extension ?? [])
      .filter((extension) => extension.url === REORDER_LEVEL)
      .map((extension) => ({
        locationId: getExtension(extension, REORDER_LEVEL_CLINIC)?.valueReference?.reference?.replace('Location/', ''),
        level: getExtension(extension, REORDER_LEVEL_LEVEL)?.valueInteger,
      })),
  });
  return parsed.success ? parsed.data : undefined;
};

// ─── Lots and stock entries ───────────────────────────────────────────────────
//
// A lot is one Medication per drug × clinic × lot number × expiration date (batch holds lot number and
// expiration, both searchable; the same number can be on hand twice when a shipment arrived with a different
// date and staff chose to keep it separate). Every stock change is an Observation whose subject is the lot: Observation was chosen over
// Basic because Oystehr searches only standard parameters, and Observation has one for everything the
// inventory screens, tasks and reports filter on (subject, focus, part-of, derived-from, date, code,
// category, performer, value-quantity). See documents/otr-3339-fhir-inventory-modeling.md, "Decision".
// Entries are append-only and never carry `encounter` or a Patient subject; on hand is the sum of their
// signed values, cached on the lot and recomputed (never incremented) on every write.

/** Marks a Medication as a lot. Its value must never be the catalog's `virtual-medication-inventory`. */
export const INVENTORY_LOT_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('inventory-lot');
export const INVENTORY_LOT_IDENTIFIER_VALUE = 'inventory-lot';
/** Names the catalog drug the lot belongs to (value = catalog Medication id). */
export const INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM = ottehrIdentifierSystem('inventory-lot-drug');
/** meta.tag naming the clinic (code = Location id) so lots can be searched per clinic. */
export const INVENTORY_LOT_CLINIC_TAG_SYSTEM = ottehrCodeSystemUrl('inventory-lot-clinic');
export const INVENTORY_LOT_EXTENSION_URL = ottehrExtensionUrl('inventory-lot');
const LOT_CLINIC = 'clinic';
const LOT_VENDOR = 'vendor';
const LOT_ON_HAND = 'on-hand';

/** On a received entry: that shipment's vendor (same sub-extension url as the lot's). */
export const INVENTORY_STOCK_ENTRY_EXTENSION_URL = ottehrExtensionUrl('inventory-stock-entry');

export const INVENTORY_STOCK_ENTRY_CODE = 'inventory-stock-entry';
export const INVENTORY_STOCK_ENTRY_TAG_SYSTEM = ottehrCodeSystemUrl('inventory-stock-entry');
export const INVENTORY_STOCK_ENTRY_CATEGORY_SYSTEM = ottehrCodeSystemUrl('observation-category');
export const INVENTORY_ENTRY_TYPE_SYSTEM = ottehrCodeSystemUrl('inventory-entry-type');
export const INVENTORY_ENTRY_REASON_SYSTEM = ottehrCodeSystemUrl('inventory-adjustment-reason');
export const INVENTORY_ENTRY_COMPONENT_SYSTEM = ottehrCodeSystemUrl('inventory-entry-component');

export const isInventoryLot = (medication: Medication): boolean =>
  medication.identifier?.some(
    (identifier) =>
      identifier.system === INVENTORY_LOT_IDENTIFIER_SYSTEM && identifier.value === INVENTORY_LOT_IDENTIFIER_VALUE
  ) ?? false;

export const isCatalogMedication = (medication: Medication): boolean =>
  medication.identifier?.some(
    (identifier) => identifier.system === MEDICATION_TYPE_SYSTEM && identifier.value === INVENTORY_MEDICATION_TYPE_CODE
  ) ?? false;

/** The catalog drug an order's contained Medication copy was made from; orders saved before it was recorded have none. */
export const getOrderCatalogMedicationId = (contained: Medication | undefined): string | undefined =>
  contained?.identifier?.find((identifier) => identifier.system === MEDICATION_CATALOG_ID_IDENTIFIER_SYSTEM)?.value;

export interface InventoryLotInput {
  locationId: string;
  lotNumber: string;
  expirationDate: string;
  ndc: string;
  manufacturer?: string;
  vendor?: string;
  /** The drug's stock unit: counted-as items (or the dose volume unit for measured multi-use drugs). */
  unit: string;
}

const makeLotExtension = (
  input: Pick<InventoryLotInput, 'locationId' | 'vendor' | 'unit'>,
  onHand: number
): Extension => ({
  url: INVENTORY_LOT_EXTENSION_URL,
  extension: [
    { url: LOT_CLINIC, valueReference: { reference: `Location/${input.locationId}` } },
    ...(input.vendor ? [{ url: LOT_VENDOR, valueString: input.vendor }] : []),
    { url: LOT_ON_HAND, valueQuantity: { value: onHand, unit: input.unit } },
  ],
});

/**
 * A new lot of `catalog` with nothing on hand yet. Copies the catalog codings (so the claim path that reads
 * the NDC from a contained Medication copy keeps working) and replaces the catalog's representative NDC with
 * the one from the box.
 */
export const makeInventoryLot = (catalog: Medication & { id: string }, input: InventoryLotInput): Medication => {
  const codings: Coding[] = [
    ...(catalog.code?.coding ?? []).filter((coding) => coding.system !== CODE_SYSTEM_NDC),
    { system: CODE_SYSTEM_NDC, code: input.ndc },
  ];
  return {
    resourceType: 'Medication',
    meta: { tag: [{ system: INVENTORY_LOT_CLINIC_TAG_SYSTEM, code: input.locationId }] },
    identifier: [
      { system: INVENTORY_LOT_IDENTIFIER_SYSTEM, value: INVENTORY_LOT_IDENTIFIER_VALUE },
      { system: INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM, value: catalog.id },
    ],
    status: 'inactive',
    code: { coding: codings, ...(getMedicationName(catalog) ? { text: getMedicationName(catalog) } : {}) },
    ...(input.manufacturer ? { manufacturer: { display: input.manufacturer } } : {}),
    batch: { lotNumber: input.lotNumber, expirationDate: input.expirationDate },
    extension: [makeLotExtension(input, 0)],
  };
};

const readLotExtension = (
  lot: Medication
): { locationId?: string; vendor?: string; unit: string; onHand: number } | undefined => {
  const root = getExtension(lot, INVENTORY_LOT_EXTENSION_URL);
  if (!root) return undefined;
  const onHand = getExtension(root, LOT_ON_HAND)?.valueQuantity;
  return {
    locationId:
      getExtension(root, LOT_CLINIC)?.valueReference?.reference?.replace('Location/', '') ??
      getTag(lot, INVENTORY_LOT_CLINIC_TAG_SYSTEM)?.code,
    vendor: getExtension(root, LOT_VENDOR)?.valueString,
    unit: onHand?.unit ?? '',
    onHand: onHand?.value ?? 0,
  };
};

const replaceLotExtension = (lot: Medication, details: { vendor?: string }, onHand: number): Medication => {
  const existing = readLotExtension(lot);
  if (!existing?.locationId) throw new Error(`Medication/${lot.id} is not an inventory lot`);
  return {
    ...lot,
    extension: [
      ...(lot.extension ?? []).filter((extension) => extension.url !== INVENTORY_LOT_EXTENSION_URL),
      makeLotExtension(
        {
          locationId: existing.locationId,
          unit: existing.unit,
          vendor: details.vendor ?? existing.vendor,
        },
        onHand
      ),
    ],
  };
};

/** The lot with its on-hand cache replaced and status derived from it (active while on hand ≠ 0). */
export const withLotOnHand = (lot: Medication, onHand: number): Medication => ({
  ...replaceLotExtension(lot, {}, onHand),
  status: onHand === 0 ? 'inactive' : 'active',
});

/** The lot's vendor replaced; passed as undefined it is kept. */
export const withLotDetails = (lot: Medication, details: { vendor?: string }): Medication =>
  replaceLotExtension(lot, details, readLotExtension(lot)?.onHand ?? 0);

export const parseInventoryLot = (lot: Medication): InventoryLot | undefined => {
  const details = readLotExtension(lot);
  const catalogMedicationId = lot.identifier?.find(
    (identifier) => identifier.system === INVENTORY_LOT_DRUG_IDENTIFIER_SYSTEM
  )?.value;
  if (!lot.id || !details?.locationId || !isInventoryLot(lot) || !catalogMedicationId || !lot.batch?.lotNumber) {
    return undefined;
  }
  return {
    id: lot.id,
    catalogMedicationId,
    locationId: details.locationId,
    lotNumber: lot.batch.lotNumber,
    expirationDate: lot.batch.expirationDate ?? '',
    ndc: lot.code?.coding?.find((coding) => coding.system === CODE_SYSTEM_NDC)?.code,
    manufacturer: lot.manufacturer?.display,
    vendor: details.vendor,
    onHand: details.onHand,
    unit: details.unit,
    status: lot.status === 'active' ? 'active' : 'inactive',
  };
};

export type InventoryStockEntryInput = Omit<InventoryStockEntry, 'id' | 'lotId'> & {
  /** `Medication/{id}`, or the transaction-local `urn:uuid:` of a lot created in the same bundle. */
  lotReference: string;
};

export const makeInventoryStockEntry = (input: InventoryStockEntryInput): Observation => ({
  resourceType: 'Observation',
  meta: { tag: [{ system: INVENTORY_STOCK_ENTRY_TAG_SYSTEM, code: INVENTORY_STOCK_ENTRY_CODE }] },
  status: 'final',
  category: [{ coding: [{ system: INVENTORY_STOCK_ENTRY_CATEGORY_SYSTEM, code: INVENTORY_STOCK_ENTRY_CODE }] }],
  code: {
    coding: [
      { system: INVENTORY_ENTRY_TYPE_SYSTEM, code: input.type },
      ...(input.reason ? [{ system: INVENTORY_ENTRY_REASON_SYSTEM, code: input.reason }] : []),
    ],
  },
  subject: { reference: input.lotReference },
  focus: [{ reference: `Location/${input.locationId}` }],
  ...(input.medicationAdministrationId
    ? { partOf: [{ reference: `MedicationAdministration/${input.medicationAdministrationId}` }] }
    : {}),
  ...(input.reversesEntryId ? { derivedFrom: [{ reference: `Observation/${input.reversesEntryId}` }] } : {}),
  ...(input.performerReference ? { performer: [{ reference: input.performerReference }] } : {}),
  effectiveDateTime: input.effectiveDateTime,
  valueQuantity: { value: input.quantity, unit: input.unit },
  ...(input.note ? { note: [{ text: input.note }] } : {}),
  ...(input.vendor
    ? {
        extension: [
          { url: INVENTORY_STOCK_ENTRY_EXTENSION_URL, extension: [{ url: LOT_VENDOR, valueString: input.vendor }] },
        ],
      }
    : {}),
  ...(input.components?.length
    ? {
        component: input.components.map((component) => ({
          code: { coding: [{ system: INVENTORY_ENTRY_COMPONENT_SYSTEM, code: component.code }] },
          valueQuantity: { value: component.value, unit: component.unit },
        })),
      }
    : {}),
});

const isEntryType = (code: string | undefined): code is InventoryEntryType =>
  INVENTORY_ENTRY_TYPES.includes(code as InventoryEntryType);
const isEntryReason = (code: string | undefined): code is InventoryEntryReason =>
  INVENTORY_ENTRY_REASONS.includes(code as InventoryEntryReason);
const isEntryComponent = (code: string | undefined): code is InventoryEntryComponent =>
  INVENTORY_ENTRY_COMPONENTS.includes(code as InventoryEntryComponent);

export const isInventoryStockEntry = (observation: Observation): boolean =>
  observation.category?.some(
    (category) =>
      category.coding?.some(
        (coding) =>
          coding.system === INVENTORY_STOCK_ENTRY_CATEGORY_SYSTEM && coding.code === INVENTORY_STOCK_ENTRY_CODE
      )
  ) ?? false;

export const parseInventoryStockEntry = (observation: Observation): InventoryStockEntry | undefined => {
  const type = observation.code?.coding?.find((coding) => coding.system === INVENTORY_ENTRY_TYPE_SYSTEM)?.code;
  const reason = observation.code?.coding?.find((coding) => coding.system === INVENTORY_ENTRY_REASON_SYSTEM)?.code;
  const lotId = observation.subject?.reference?.replace('Medication/', '');
  const locationId = observation.focus?.[0]?.reference?.replace('Location/', '');
  const quantity = observation.valueQuantity?.value;
  if (
    !observation.id ||
    !isInventoryStockEntry(observation) ||
    !isEntryType(type) ||
    !lotId ||
    !locationId ||
    quantity === undefined ||
    !observation.effectiveDateTime
  ) {
    return undefined;
  }
  const components = (observation.component ?? []).flatMap((component) => {
    const code = component.code?.coding?.find((coding) => coding.system === INVENTORY_ENTRY_COMPONENT_SYSTEM)?.code;
    const value = component.valueQuantity?.value;
    return isEntryComponent(code) && value !== undefined
      ? [{ code, value, unit: component.valueQuantity?.unit ?? '' }]
      : [];
  });
  const details = getExtension(observation, INVENTORY_STOCK_ENTRY_EXTENSION_URL);
  const vendor = details ? getExtension(details, LOT_VENDOR)?.valueString : undefined;
  return {
    id: observation.id,
    lotId,
    locationId,
    type,
    ...(isEntryReason(reason) ? { reason } : {}),
    quantity,
    unit: observation.valueQuantity?.unit ?? '',
    performerReference: observation.performer?.[0]?.reference,
    effectiveDateTime: observation.effectiveDateTime,
    medicationAdministrationId: observation.partOf?.[0]?.reference?.replace('MedicationAdministration/', ''),
    reversesEntryId: observation.derivedFrom?.[0]?.reference?.replace('Observation/', ''),
    note: observation.note?.[0]?.text,
    ...(components.length ? { components } : {}),
    ...(vendor ? { vendor } : {}),
  };
};

/** On hand = the sum of the lot's entries' signed values. The ledger is the source of truth; the lot caches this. */
export const sumStockEntries = (entries: Observation[]): number =>
  entries.reduce((total, entry) => total + (entry.valueQuantity?.value ?? 0), 0);

// ─── What an administration takes off a lot ───────────────────────────────────
//
// Stock stays in counted-as items for every drug. A single-use dose takes whole items (rounded up) and the
// leftover is waste; a multi-use dose takes nothing until the next count.

const ROUND_PLACES = 10_000;
const round = (value: number): number => Math.round(value * ROUND_PLACES) / ROUND_PLACES;

/** Dose units that can be converted into each other: mass (mg, g) and volume (ml, cc). */
const UNIT_FACTORS: Partial<Record<string, { dimension: 'mass' | 'volume'; factor: number }>> = {
  mg: { dimension: 'mass', factor: 1 },
  g: { dimension: 'mass', factor: 1000 },
  ml: { dimension: 'volume', factor: 1 },
  cc: { dimension: 'volume', factor: 1 },
};

const convertAmount = (amount: number, from: string, to: string): number | undefined => {
  if (from === to) return amount;
  const fromUnit = UNIT_FACTORS[from];
  const toUnit = UNIT_FACTORS[to];
  if (!fromUnit || !toUnit || fromUnit.dimension !== toUnit.dimension) return undefined;
  return (amount * fromUnit.factor) / toUnit.factor;
};

/** What one counted item contains, in the dose's unit; undefined when the units can't be related. */
export const containerAmountInDoseUnit = (
  inventory: Pick<InHouseMedicationInventory, 'eachContains'>,
  doseUnit: string
): number | undefined => {
  const { eachContains } = inventory;
  return (
    convertAmount(eachContains.amount, eachContains.unit, doseUnit) ??
    (eachContains.in ? convertAmount(eachContains.in.amount, eachContains.in.unit, doseUnit) : undefined)
  );
};

export interface AdministrationStockTake {
  /** Counted-as items taken off the lot. */
  items: number;
  /** Single-use only: the part of the last item not given, in the dose's unit. */
  waste?: { amount: number; unit: string };
}

/** What a dose takes off a lot of this drug, or undefined when nothing comes off (multi-use). */
export const stockTakenForDose = (
  inventory: Pick<InHouseMedicationInventory, 'eachContains' | 'use'>,
  dose: number,
  doseUnit: string
): AdministrationStockTake | undefined => {
  if (!Number.isFinite(dose) || dose <= 0 || inventory.use === 'multi-use') return undefined;
  const containerAmount = containerAmountInDoseUnit(inventory, doseUnit);
  // Single-use: a dose whose unit can't be related to the container still opens one item.
  if (!containerAmount) return { items: 1 };
  const items = Math.max(1, Math.ceil(round(dose / containerAmount)));
  const wasteAmount = round(items * containerAmount - dose);
  return { items, ...(wasteAmount > 0 ? { waste: { amount: wasteAmount, unit: doseUnit } } : {}) };
};

export interface AdministrationStockTarget extends AdministrationStockTake {
  lotId: string;
}

export interface AdministrationStockChange {
  lotId: string;
  type: Extract<InventoryEntryType, 'administered' | 'administration-reversed'>;
  /** Signed, in counted-as items: negative takes off the lot, positive puts back. */
  quantity: number;
  /** Signed change to the waste recorded for this administration on this lot. */
  waste?: { amount: number; unit: string };
  reversesEntryId?: string;
}

const sumWaste = (entries: InventoryStockEntry[]): number =>
  entries.reduce(
    (total, entry) =>
      total + (entry.components ?? []).reduce((sum, c) => sum + (c.code === 'waste-amount' ? c.value : 0), 0),
    0
  );

/**
 * One rule for every save and delete of an administration: what it should have taken off now (`target`,
 * undefined when nothing should be off) minus what the ledger already took off for it (`existing`, its
 * entries oldest first) is the entry to write per lot. Covers delete, lot change, dose change and status
 * change; a put-back reverses the lot's latest "administered" entry.
 */
export const planAdministrationStockChanges = (
  target: AdministrationStockTarget | undefined,
  existing: InventoryStockEntry[]
): AdministrationStockChange[] => {
  const lotIds = [...new Set([...existing.map((entry) => entry.lotId), ...(target ? [target.lotId] : [])])];
  return lotIds.flatMap((lotId) => {
    const own = existing.filter((entry) => entry.lotId === lotId);
    const taken = -own.reduce((total, entry) => total + entry.quantity, 0);
    const wasted = sumWaste(own);
    const wanted = target?.lotId === lotId ? target : undefined;
    const itemsDelta = round((wanted?.items ?? 0) - taken);
    const wasteDelta = round((wanted?.waste?.amount ?? 0) - wasted);
    if (itemsDelta === 0 && wasteDelta === 0) return [];
    const reversing = itemsDelta < 0 || (itemsDelta === 0 && wasteDelta < 0);
    const wasteUnit =
      wanted?.waste?.unit ??
      own.flatMap((entry) => entry.components ?? []).find((c) => c.code === 'waste-amount')?.unit;
    const latestAdministered = [...own].reverse().find((entry) => entry.type === 'administered');
    return [
      {
        lotId,
        type: reversing ? 'administration-reversed' : 'administered',
        quantity: itemsDelta === 0 ? 0 : -itemsDelta,
        ...(wasteDelta !== 0 && wasteUnit ? { waste: { amount: wasteDelta, unit: wasteUnit } } : {}),
        ...(reversing && latestAdministered ? { reversesEntryId: latestAdministered.id } : {}),
      },
    ];
  });
};

/** Lots for the MAR Lot field: unexpired first, each group soonest expiration first; expired lots last. */
export const sortInventoryLotsForPicking = <T extends Pick<InventoryLot, 'expirationDate'>>(
  lots: T[],
  today: string
): { lot: T; expired: boolean }[] => {
  const byExpiration = (a: T, b: T): number => a.expirationDate.localeCompare(b.expirationDate);
  const isExpired = (lot: T): boolean => Boolean(lot.expirationDate) && lot.expirationDate < today;
  return [
    ...lots.filter((lot) => !isExpired(lot)).sort(byExpiration),
    ...lots.filter(isExpired).sort(byExpiration),
  ].map((lot) => ({ lot, expired: isExpired(lot) }));
};
