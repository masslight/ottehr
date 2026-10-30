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
