export interface ImmunizationReportZambdaInput {
  dateRange: {
    start: string; // ISO date string
    end: string; // ISO date string
  };
}

export interface ImmunizationReportItem {
  // Patient demographics
  patientId: string;
  firstName: string;
  middleName: string;
  lastName: string;
  dateOfBirth: string;
  sex: string;
  raceOrEthnicity: string;
  address: string;
  phoneNumber: string;
  email: string;
  // Order details
  medicationAdministrationId: string;
  vaccineName: string;
  dose: string;
  units: string;
  orderedByProvider: string;
  instructions: string;
  // Administration details
  orderStatus: string;
  dateAdministered: string;
  cptCode: string;
  cvxCode: string;
  mvxCode: string;
  ndcCode: string;
  lotNumber: string;
  expirationDate: string;
  anatomicalSite: string;
  route: string;
  administeringProvider: string;
  visGiven: string;
  // Context
  encounterId: string;
  appointmentId: string;
  encounterDate: string;
  location: string;
  status: string;
}

export interface ImmunizationReportZambdaOutput {
  message: string;
  totalImmunizations: number;
  immunizations: ImmunizationReportItem[];
  dateRange: {
    start: string;
    end: string;
  };
}
