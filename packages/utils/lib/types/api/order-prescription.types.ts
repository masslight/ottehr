export interface OrderPrescriptionInput {
  patientId: string;
  practitionerId: string;
  prescriberSpi: string;
  encounterId: string;
  ndc: string;
  medicationDescription: string;
  quantityValue: number;
  quantityUnit: string;
  daysSupply?: number;
  writtenDate: string;
  substitutionAllowed: boolean;
  numberOfRefills: number;
  patientInstructions: string;
  pharmacyId: string;
  pharmacyNpi: string;
  pharmacyName: string;
  pharmacyPhone: string;
  diagnosisCode: string;
  diagnosisDescription: string;
}

export interface OrderPrescriptionOutput {
  medicationRequestId: string;
  messageId: string;
  status: { code?: string; description?: string };
}
