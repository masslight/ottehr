export interface GetPatientAccessPhoneNumbersInput {
  patientId: string;
}

export interface GetPatientAccessPhoneNumbersOutput {
  phoneNumbers: string[];
}

export interface UpdatePatientAccessPhoneNumbersInput {
  patientId: string;
  phoneNumbers: string[];
}
