import { z } from 'zod';
import { IN_HOUSE_MEDICATION_UNIT_OPTIONS, MedicationUnitOptions } from '../../../fhir/medication-administration';

export interface CreateInHouseMedicationInput {
  name: string;
  ndc?: string;
  medispanID: string;
  medispanIDForInteractions?: string;
}

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

export const InHouseMedicationInventorySchema = z.object({
  countedAs: z.enum(MEDICATION_COUNTED_AS_OPTIONS),
  eachContains: MedicationAmountSchema.extend({ in: MedicationAmountSchema.optional() }),
  use: z.enum(MEDICATION_USE_OPTIONS),
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

export const INVENTORY_ENTRY_TYPES = [
  'received',
  'administered',
  'administration-reversed',
  'adjustment',
  'count',
] as const;
export type InventoryEntryType = (typeof INVENTORY_ENTRY_TYPES)[number];

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
  transferred: 'Transferred to another location',
  other: 'Other',
  'count-adjustment': 'Count adjustment',
  'no-difference': 'No difference',
  'expiration-corrected': 'Expiration corrected',
};

export const INVENTORY_ENTRY_COMPONENTS = ['waste-amount', 'counted'] as const;
export type InventoryEntryComponent = (typeof INVENTORY_ENTRY_COMPONENTS)[number];

export interface InventoryLot {
  id: string;
  catalogMedicationId: string;
  locationId: string;
  lotNumber: string;
  expirationDate: string;
  ndc?: string;
  manufacturer?: string;
  vendor?: string;
  onHand: number;
  unit: string;
  status: 'active' | 'inactive';
}

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
  vendor?: string;
  administrationDeleted?: true;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const ReceiveMedicationShipmentInputSchema = z.object({
  medicationId: z.string().uuid(),
  locationId: z.string().uuid(),
  lotNumber: z.string().trim().min(1),
  expirationDate: z.string().regex(ISO_DATE, 'expirationDate must be YYYY-MM-DD'),
  quantity: z.number().int().positive(),
  ndc: z.string().trim().min(1),
  manufacturer: z.string().trim().min(1).optional(),
  vendor: z.string().trim().min(1).optional(),
  expirationConflict: z.enum(['separate-lot', 'correct-existing']).optional(),
  lotId: z.string().uuid().optional(),
});
export type ReceiveMedicationShipmentInput = z.infer<typeof ReceiveMedicationShipmentInputSchema>;

export interface InventoryStockWriteResponse {
  lot: InventoryLot;
  entry: InventoryStockEntry;
}

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
  medicationId: z.string().uuid(),
});
export type LookupNdcInput = z.infer<typeof LookupNdcInputSchema>;

export interface LookupNdcResponse {
  status: 'match' | 'mismatch' | 'not-found' | 'unavailable';
  product?: {
    packageNdc: string;
    name: string;
    genericName?: string;
    brandName?: string;
    manufacturer?: string;
    packageDescription?: string;
    rxcuis: string[];
  };
  comparedBy?: 'rxcui' | 'name';
}

export const GetMedicationInventoryInputSchema = z.object({
  medicationId: z.string().uuid(),
  locationId: z.string().uuid().optional(),
});
export type GetMedicationInventoryInput = z.infer<typeof GetMedicationInventoryInputSchema>;

export interface GetMedicationInventoryResponse {
  lastReceivedLot?: Pick<InventoryLot, 'id' | 'locationId' | 'lotNumber' | 'ndc' | 'manufacturer' | 'vendor'>;
  lots?: InventoryLot[];
}

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

export const INVENTORY_EXPIRING_SOON_DAYS = 30;

export type InventoryMarker = 'low' | 'expiring' | 'expired' | 'below-zero';
export const INVENTORY_MARKER_LABELS: Record<InventoryMarker, string> = {
  low: 'Low',
  expiring: 'Expiring',
  expired: 'Expired',
  'below-zero': 'Below Zero',
};

/** The user's date (YYYY-MM-DD), so "expired" on the screen agrees with the MAR; the server's date when absent. */
const TodaySchema = z.string().regex(ISO_DATE, 'today must be YYYY-MM-DD').optional();

export const ListMedicationInventoryInputSchema = z.discriminatedUnion('view', [
  z.object({ view: z.literal('all-locations'), today: TodaySchema }),
  z.object({ view: z.literal('location'), locationId: z.string().uuid(), today: TodaySchema }),
  z.object({ view: z.literal('lot-history'), lotId: z.string().uuid() }),
]);
export type ListMedicationInventoryInput = z.infer<typeof ListMedicationInventoryInputSchema>;

export interface InventoryLocationLine {
  locationId: string;
  locationName: string;
  onHand: number;
  reorderLevel?: number;
  earliestExpiration?: string;
  markers: InventoryMarker[];
}

export interface InventoryLotRow extends InventoryLot {
  markers: InventoryMarker[];
}

export interface InventoryDrugRow {
  medicationId: string;
  name: string;
  countedAs: MedicationCountedAs;
  use: MedicationUse;
  onHand: number;
  earliestExpiration?: string;
  reorderLevel?: number;
  locationsBelowReorderLevel: number;
  locationsWithReorderLevel: number;
  markers: InventoryMarker[];
  locations: InventoryLocationLine[];
  lots: InventoryLotRow[];
}

export interface InventoryHistoryEntry extends InventoryStockEntry {
  onHandAfter: number;
  performerName?: string;
  visit?: { appointmentId?: string; patientName?: string; date?: string };
}

export interface ListMedicationInventoryResponse {
  drugs: InventoryDrugRow[];
  entries: InventoryHistoryEntry[];
}

export const AdjustMedicationInventoryInputSchema = z
  .discriminatedUnion('action', [
    z.object({
      action: z.literal('adjust'),
      lotId: z.string().uuid(),
      direction: z.enum(['remove', 'add']),
      quantity: z.number().int().positive(),
      reason: z.enum(INVENTORY_ADJUSTMENT_REASONS),
      note: z.string().trim().min(1).optional(),
    }),
    z.object({
      action: z.literal('count'),
      lotId: z.string().uuid(),
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
