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

export interface OrderPrescriptionInput {
  patientId: string;
  practitionerId: string;
  encounterId: string;
  ndc: string;
  medicationDescription: string;
  quantityValue: number;
  quantityUnit: QuantityUnit;
  daysSupply?: number;
  writtenDate: string;
  substitutionAllowed: boolean;
  numberOfRefills: number;
  patientInstructions: string;
  noteToPharmacy?: string;
  pharmacyId: string;
  pharmacyNpi: string;
  pharmacyName: string;
  pharmacyPhone: string;
  diagnosisCode?: string;
  diagnosisDescription?: string;
}

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
