// NCPDP QuantityUnitOfMeasure preferred terms accepted by the order prescription endpoint
export const QUANTITY_UNITS = [
  'Applicator',
  'Blister',
  'Caplet',
  'Capsule',
  'Each',
  'Film',
  'Gram',
  'Gum',
  'Implant',
  'Inhaler',
  'Insert',
  'International Unit',
  'Kit',
  'Lancet',
  'Lozenge',
  'Microgram',
  'Milligram',
  'Milliliter',
  'Nebule',
  'Packet',
  'Pad',
  'Patch',
  'Pen Needle',
  'Pre-filled Pen Syringe',
  'Ring',
  'Sponge',
  'Stick',
  'Strip',
  'Suppository',
  'Swab',
  'Syringe',
  'Tablet',
  'Troche',
  'Unspecified',
  'Vial',
  'Wafer',
] as const;

export type QuantityUnit = (typeof QUANTITY_UNITS)[number];

// NCPDP Compound Dosage Form preferred terms the order prescription endpoint accepts (it maps them to codes)
export const COMPOUND_DOSAGE_FORMS = [
  'Capsule',
  'Chewable Tablet',
  'Cream',
  'Disintegrating Tablet',
  'Elixir',
  'Emulsion',
  'Enema',
  'Film',
  'Foam',
  'Gel',
  'Implantable Pellet',
  'Injectable',
  'Injectable Solution',
  'Intravenous Solution',
  'Irrigant',
  'Liposomal Injection',
  'Lipstick',
  'Liquid',
  'Lollipop',
  'Lotion',
  'Lozenge',
  'Lyophilized Powder for Injectable Solution',
  'Mouthwash',
  'Nasal Spray',
  'Oil',
  'Ointment',
  'Ophthalmic Solution',
  'Ophthalmic Suspension',
  'Otic Suspension',
  'Pad',
  'Paste',
  'Pellet',
  'Plaster',
  'Powder',
  'Shampoo',
  'Solution',
  'Spray',
  'Strip',
  'Suppository',
  'Suspension',
  'Sustained Release Capsule',
  'Syrup',
  'Tablet',
  'Tablet Triturate',
  'Tincture',
  'Troche',
  'Unspecified',
  'Urethral Gel',
  'Wash',
] as const;

export type CompoundDosageForm = (typeof COMPOUND_DOSAGE_FORMS)[number];

// The strengths a compound ingredient can have in the finished product
export const COMPOUND_STRENGTH_UNITS = ['%', 'mg/mL', 'mg/g', 'mg each'] as const;

export type CompoundStrengthUnit = (typeof COMPOUND_STRENGTH_UNITS)[number];

/** One ingredient of a compound as the provider enters it (and a quick pick saves it): a product picked from the
 * medication search (with its NDC), or one typed in. Exactly one of amount, strength and base. The order converts it
 * to an amount (`CompoundOrderIngredient`). */
export interface CompoundIngredientInput {
  description: string;
  ndc?: string;
  rxcui?: string;
  /** Set on a typed-in ingredient (no NDC): the prescriber confirmed it is not a controlled substance. */
  typedNotControlled?: true;
  /** How much of it goes in: 6 Gram. */
  amount?: { value: number; unit: QuantityUnit };
  /** Its strength in the finished product: 10 %, 2 mg/mL, 75 mg each. */
  strength?: { value: number; unit: CompoundStrengthUnit };
  /** The base that fills the compound up to the dispensed quantity; at most one per compound. */
  base?: true;
}

/** A compound the pharmacy mixes, as entered: its name (up to 105 characters), dosage form and ingredients. The
 * dosage form is absent only on a quick pick saved before it was asked for. */
export interface CompoundInput {
  description: string;
  dosageForm?: CompoundDosageForm;
  ingredients: CompoundIngredientInput[];
}

/** One ingredient as the order prescription endpoint takes it: how much of it goes in, plus its strength when the
 * provider entered one. Strength names are NCPDP terms ("Percentage", "mg/ml", "Milligram"). */
export interface CompoundOrderIngredient {
  description: string;
  ndc?: string;
  strength?: { value?: string; form?: string; unit?: string };
  quantityValue: number;
  quantityUnit: QuantityUnit;
}

/** A compound as the order prescription endpoint takes it; its name goes in `medicationDescription`. */
export interface CompoundOrder {
  dosageForm: CompoundDosageForm;
  ingredients: CompoundOrderIngredient[];
}

interface OrderPrescriptionCommonInput {
  medicationDescription: string;
  substitutionAllowed: boolean;
  patientId: string;
  practitionerId: string;
  encounterId: string;
  quantityValue: number;
  quantityUnit: QuantityUnit;
  daysSupply?: number;
  writtenDate: string;
  numberOfRefills: number;
  patientInstructions: string;
  noteToPharmacy?: string;
  pharmacyId: string;
  pharmacyNpi: string;
  pharmacyName: string;
  pharmacyPhone: string;
  diagnosisCode?: string;
  diagnosisDescription?: string;
  // Requested from the eRx service: the patient's height and weight, each with the date measured (YYYY-MM-DD)
  patientHeight?: { cm: number; measuredDate: string };
  patientWeight?: { kg: number; measuredDate: string };
}

/** A prescription for one product. */
export interface OrderProductPrescriptionInput extends OrderPrescriptionCommonInput {
  ndc: string;
  compound?: never;
}

/** A prescription for a compound, named by `medicationDescription`: the quantity is the finished compound's, and
 * there is no substitution. */
export interface OrderCompoundPrescriptionInput extends OrderPrescriptionCommonInput {
  ndc?: never;
  substitutionAllowed: false;
  compound: CompoundOrder;
}

export type OrderPrescriptionInput = OrderProductPrescriptionInput | OrderCompoundPrescriptionInput;

export interface OrderPrescriptionOutput {
  medicationRequestId: string;
  messageId: string;
  status: { code?: string; description?: string };
}

// The cancellation reasons the cancel prescription endpoint accepts
export const CANCEL_PRESCRIPTION_REASONS = [
  'Allergic reaction',
  'Prescription/Therapy change',
  'Prescription/Therapy completed',
  'Duplicate order (different pharmacy)',
  'Duplicate order (same pharmacy)',
  'Sent in error',
  'Interaction, intolerance, or contraindication',
  'Patient request',
  'Transition of care has occurred',
] as const;

export type CancelPrescriptionReason = (typeof CANCEL_PRESCRIPTION_REASONS)[number];

export interface CancelPrescriptionInput {
  medicationRequestId: string;
  practitionerId: string;
  reason: CancelPrescriptionReason;
}

export interface CancelPrescriptionOutput {
  medicationRequestId: string;
  messageId: string;
  status: { code?: string; description?: string };
}
