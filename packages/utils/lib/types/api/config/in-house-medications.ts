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
  'expiration-corrected',
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
  'expiration-corrected': 'Expiration corrected',
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
  /** On a received entry: the vendor and cost per item of that shipment (the lot keeps only the latest). */
  vendor?: string;
  unitCost?: number;
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
  /**
   * What to do when this lot number is already on hand at the clinic with a different expiration date. Without
   * it the zambda writes nothing and answers with `expirationConflict` so staff can choose.
   */
  expirationConflict: z.enum(['separate-lot', 'correct-existing']).optional(),
});
export type ReceiveMedicationShipmentInput = z.infer<typeof ReceiveMedicationShipmentInputSchema>;

export interface InventoryStockWriteResponse {
  lot: InventoryLot;
  entry: InventoryStockEntry;
}

/** The lot that already carries this number at the clinic, when its expiration date differs from the one entered. */
export interface ReceiveExpirationConflict {
  lotId: string;
  expirationDate: string;
  onHand: number;
  unit: string;
}

export type ReceiveMedicationShipmentResponse =
  | InventoryStockWriteResponse
  | { expirationConflict: ReceiveExpirationConflict };

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

// ─── Inventory screen, adjustments and counts (requirements 6 and 7) ──────────

/** The reasons staff can pick when adjusting a lot by hand (requirement 6). Counts and the MAR use the rest. */
export const INVENTORY_ADJUSTMENT_REASONS = [
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
] as const satisfies readonly InventoryEntryReason[];
export type InventoryAdjustmentReason = (typeof INVENTORY_ADJUSTMENT_REASONS)[number];

/** A lot comes within this many days of its expiration date: "expiring". */
export const INVENTORY_EXPIRING_SOON_DAYS = 30;

/** What the inventory screen marks (requirement 7). `low` is on hand below the clinic's reorder level. */
export const INVENTORY_MARKERS = ['low', 'expiring', 'expired', 'below-zero'] as const;
export type InventoryMarker = (typeof INVENTORY_MARKERS)[number];
export const INVENTORY_MARKER_LABELS: Record<InventoryMarker, string> = {
  low: 'low',
  expiring: 'expiring',
  expired: 'expired',
  'below-zero': 'below zero',
};

export const ListMedicationInventoryInputSchema = z.discriminatedUnion('view', [
  z.object({ view: z.literal('all-clinics') }),
  z.object({ view: z.literal('clinic'), locationId: z.string().min(1) }),
  z.object({ view: z.literal('lot-history'), lotId: z.string().min(1) }),
]);
export type ListMedicationInventoryInput = z.infer<typeof ListMedicationInventoryInputSchema>;

/** One clinic's line under a drug in the all-clinics view. */
export interface InventoryClinicLine {
  locationId: string;
  locationName: string;
  onHand: number;
  reorderLevel?: number;
  /** Among the clinic's lots with stock on hand. */
  earliestExpiration?: string;
  markers: InventoryMarker[];
}

export interface InventoryLotRow extends InventoryLot {
  markers: InventoryMarker[];
}

/** One tracked drug on the inventory screen. `clinics` is filled in the all-clinics view, `lots` in the clinic view. */
export interface InventoryDrugRow {
  medicationId: string;
  name: string;
  countedAs: MedicationCountedAs;
  use: MedicationUse;
  /** Total across the clinics (or lots) shown. */
  onHand: number;
  /** Among lots with stock on hand. */
  earliestExpiration?: string;
  /** The clinic's reorder level (clinic view only). */
  reorderLevel?: number;
  clinicsBelowReorderLevel: number;
  clinicsWithReorderLevel: number;
  markers: InventoryMarker[];
  clinics: InventoryClinicLine[];
  lots: InventoryLotRow[];
}

/** One stock history line. Newest first; `onHandAfter` is the running total after this entry. */
export interface InventoryHistoryEntry extends InventoryStockEntry {
  onHandAfter: number;
  performerName?: string;
  /** The visit the entry came from, when it has a MedicationAdministration. */
  visit?: { appointmentId?: string; patientName?: string; date?: string };
}

export interface ListMedicationInventoryResponse {
  /** Clinic and all-clinics views. Sorted by medication name. */
  drugs: InventoryDrugRow[];
  /** Lot-history view. */
  entries: InventoryHistoryEntry[];
}

/** Adjusting a lot up or down with a reason, or counting what is on the shelf (requirement 6). */
export const AdjustMedicationInventoryInputSchema = z
  .discriminatedUnion('action', [
    z.object({
      action: z.literal('adjust'),
      lotId: z.string().min(1),
      direction: z.enum(['remove', 'add']),
      quantity: z.number().int().positive(),
      reason: z.enum(INVENTORY_ADJUSTMENT_REASONS),
      note: z.string().trim().min(1).optional(),
    }),
    z.object({
      action: z.literal('count'),
      lotId: z.string().min(1),
      /** Items on the shelf; multi-use items are counted as containers. */
      counted: z.number().int().nonnegative(),
    }),
  ])
  .superRefine((input, ctx) => {
    if (input.action === 'adjust' && input.reason === 'other' && !input.note) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'Say what the adjustment is for' });
    }
  });
export type AdjustMedicationInventoryInput = z.infer<typeof AdjustMedicationInventoryInputSchema>;

export type AdjustMedicationInventoryResponse = InventoryStockWriteResponse;
