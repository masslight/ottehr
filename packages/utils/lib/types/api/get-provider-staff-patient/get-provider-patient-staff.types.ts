export interface ProviderStaffPatientDetails {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  isProvider: boolean;
  isStaff: boolean;
  isPatient: boolean;
}

export interface GetProviderStaffPatientDetailsResponse {
  message: string;
  employees: ProviderStaffPatientDetails[];
}
