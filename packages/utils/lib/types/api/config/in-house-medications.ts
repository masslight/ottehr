import { z } from 'zod';
import { IN_HOUSE_MEDICATION_UNIT_OPTIONS, MedicationUnitOptions } from '../../../fhir/medication-administration';

export interface CreateInHouseMedicationInput {
  name: string;
  ndc?: string;
  medispanID: string;
  medispanIDForInteractions?: string;
}

/** The thing staff count on the shelf for a drug. */
export const MEDICATION_COUNTED_AS_OPTIONS = [
  'vial',
  'ampule',
  'syringe',
  'tablet',
  'capsule',
  'tube',
  'bottle',
  'inhaler',
  'swab',
  'packet',
  'other',
] as const;
export type MedicationCountedAs = (typeof MEDICATION_COUNTED_AS_OPTIONS)[number];
export const MEDICATION_COUNTED_AS_LABELS: Record<MedicationCountedAs, { singular: string; plural: string }> = {
  vial: { singular: 'Vial', plural: 'vials' },
  ampule: { singular: 'Ampule', plural: 'ampules' },
  syringe: { singular: 'Syringe', plural: 'syringes' },
  tablet: { singular: 'Tablet', plural: 'tablets' },
  capsule: { singular: 'Capsule', plural: 'capsules' },
  tube: { singular: 'Tube', plural: 'tubes' },
  bottle: { singular: 'Bottle', plural: 'bottles' },
  inhaler: { singular: 'Inhaler', plural: 'inhalers' },
  swab: { singular: 'Swab', plural: 'swabs' },
  packet: { singular: 'Packet', plural: 'packets' },
  other: { singular: 'Other', plural: 'items' },
};

/** Whether one counted item can serve more than one patient. */
export const MEDICATION_USE_OPTIONS = ['single-use', 'multi-use'] as const;
export type MedicationUse = (typeof MEDICATION_USE_OPTIONS)[number];
export const MEDICATION_USE_LABELS: Record<MedicationUse, string> = {
  'single-use': 'Single-use',
  'multi-use': 'Multi-use',
};

const MEDICATION_UNIT_VALUES = IN_HOUSE_MEDICATION_UNIT_OPTIONS.map((option) => option.value) as [
  MedicationUnitOptions,
  ...MedicationUnitOptions[],
];

const MedicationAmountSchema = z.object({
  amount: z.number().positive(),
  unit: z.enum(MEDICATION_UNIT_VALUES),
});

/** A drug's inventory setup. A drug without one is not tracked and its medication card works as today. */
export const InHouseMedicationInventorySchema = z.object({
  countedAs: z.enum(MEDICATION_COUNTED_AS_OPTIONS),
  /** How much drug is in one counted item, in dose units; `in` is the volume it comes in (4 mg in 2 ml). */
  eachContains: MedicationAmountSchema.extend({ in: MedicationAmountSchema.optional() }),
  use: z.enum(MEDICATION_USE_OPTIONS),
  /** One entry per in-person Location that has a reorder level; a clinic without one has none. */
  reorderLevels: z
    .array(z.object({ locationId: z.string().min(1), level: z.number().int().nonnegative() }))
    .default([]),
});
export type InHouseMedicationInventory = z.infer<typeof InHouseMedicationInventorySchema>;

export type UpdateInHouseMedicationInput = Partial<CreateInHouseMedicationInput> & {
  medicationID: string;
  status?: string;
  /** `undefined` leaves the inventory setup unchanged; `null` clears it so the drug is no longer tracked. */
  inventory?: InHouseMedicationInventory | null;
};

// ─── Lots and stock entries (OTR-3339) ────────────────────────────────────────

/** What a stock entry is. `code.coding[0]` on the entry; the MAR, adjustments and counts reuse these. */
export const INVENTORY_ENTRY_TYPES = [
  'received',
  'administered',
  'administration-reversed',
  'adjustment',
  'count',
] as const;
export type InventoryEntryType = (typeof INVENTORY_ENTRY_TYPES)[number];

/** Why stock changed. `code.coding[1]` on the entry; the list from the requirements so every slice uses one system. */
export const INVENTORY_ENTRY_REASONS = [
  'partial-dose-waste',
  'expired',
  'temperature-excursion',
  'broken-container',
  'contaminated',
  'reconstitution-error',
  'drawn-up-not-administered',
  'missing-stock',
  'manufacturer-recall',
  'transferred',
  'other',
  'count-adjustment',
  'no-difference',
] as const;
export type InventoryEntryReason = (typeof INVENTORY_ENTRY_REASONS)[number];
export const INVENTORY_ENTRY_REASON_LABELS: Record<InventoryEntryReason, string> = {
  'partial-dose-waste': 'Partial dose / unused portion',
  expired: 'Expired stock',
  'temperature-excursion': 'Temperature excursion',
  'broken-container': 'Broken / dropped container',
  contaminated: 'Contaminated',
  'reconstitution-error': 'Reconstitution / dilution error',
  'drawn-up-not-administered': 'Drawn up, not administered',
  'missing-stock': 'Missing stock',
  'manufacturer-recall': 'Manufacturer recall',
  transferred: 'Transferred to another clinic',
  other: 'Other',
  'count-adjustment': 'Count adjustment',
  'no-difference': 'No difference',
};

/** Extra numbers on an entry: the wasted dose on an administration, the shelf count on a count. */
export const INVENTORY_ENTRY_COMPONENTS = ['waste-amount', 'counted'] as const;
export type InventoryEntryComponent = (typeof INVENTORY_ENTRY_COMPONENTS)[number];

/** One lot of one drug at one clinic, as the UI sees it. */
export interface InventoryLot {
  id: string;
  catalogMedicationId: string;
  locationId: string;
  lotNumber: string;
  expirationDate: string;
  ndc?: string;
  manufacturer?: string;
  vendor?: string;
  /** Cost per counted-as item, USD. */
  unitCost?: number;
  onHand: number;
  unit: string;
  status: 'active' | 'inactive';
}

/** One stock change, as the UI sees it. `quantity` is signed, in the lot's unit. */
export interface InventoryStockEntry {
  id: string;
  lotId: string;
  locationId: string;
  type: InventoryEntryType;
  reason?: InventoryEntryReason;
  quantity: number;
  unit: string;
  performerReference?: string;
  effectiveDateTime: string;
  medicationAdministrationId?: string;
  reversesEntryId?: string;
  note?: string;
  components?: { code: InventoryEntryComponent; value: number; unit: string }[];
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Receiving a shipment (requirement 2). Cost is per package (as invoiced) or per counted-as item. */
export const ReceiveMedicationShipmentInputSchema = z.object({
  medicationId: z.string().min(1),
  locationId: z.string().min(1),
  lotNumber: z.string().trim().min(1),
  expirationDate: z.string().regex(ISO_DATE, 'expirationDate must be YYYY-MM-DD'),
  quantity: z.number().int().positive(),
  ndc: z.string().trim().min(1),
  manufacturer: z.string().trim().min(1).optional(),
  vendor: z.string().trim().min(1).optional(),
  cost: z
    .union([
      z.object({ pricePerPackage: z.number().nonnegative(), itemsPerPackage: z.number().int().positive() }),
      z.object({ perItem: z.number().nonnegative() }),
    ])
    .optional(),
});
export type ReceiveMedicationShipmentInput = z.infer<typeof ReceiveMedicationShipmentInputSchema>;

export interface ReceiveMedicationShipmentResponse {
  lot: InventoryLot;
  entry: InventoryStockEntry;
}

export const LookupNdcInputSchema = z.object({
  ndc: z.string().trim().min(1),
  medicationId: z.string().min(1),
});
export type LookupNdcInput = z.infer<typeof LookupNdcInputSchema>;

/** What the FDA NDC directory says a box is. `unavailable` means the lookup failed; receiving still works. */
export interface LookupNdcResponse {
  status: 'match' | 'mismatch' | 'not-found' | 'unavailable';
  product?: {
    /** Package NDC as the directory spells it (hyphenated 10-digit). */
    packageNdc: string;
    name: string;
    genericName?: string;
    brandName?: string;
    manufacturer?: string;
    packageDescription?: string;
    rxcuis: string[];
  };
  /** How match/mismatch was decided: RxCUI when both sides have one, otherwise generic name. */
  comparedBy?: 'rxcui' | 'name';
}

export const GetMedicationInventoryInputSchema = z.object({ medicationId: z.string().min(1) });
export type GetMedicationInventoryInput = z.infer<typeof GetMedicationInventoryInputSchema>;

export interface GetMedicationInventoryResponse {
  /** The lot of this drug (any clinic) with the newest "received" entry; prefills the receive dialog. */
  lastReceivedLot?: Pick<InventoryLot, 'id' | 'locationId' | 'lotNumber' | 'ndc' | 'manufacturer' | 'vendor'>;
}
