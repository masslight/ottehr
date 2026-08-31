export interface GetPatientLoginPhoneNumbersInput {
  patientId: string;
}

export interface GetPatientLoginPhoneNumbersOutput {
  phoneNumbers: string[];
}

export interface UpdatePatientLoginPhoneNumbersInput {
  patientId: string;
  phoneNumbers: string[];
}
