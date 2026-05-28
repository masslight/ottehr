// Autocomplete option types shared across pages — map to backend response shapes

export interface PatientOption {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  address: string;
}

export interface PayerOption {
  id: string;
  name: string;
  payerId: string;
}

export interface CoverageOption {
  id: string;
  subscriberId: string;
  payorName: string;
  payorId: string;
}

export interface PractitionerOption {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  npi: string;
}

export interface LocationOption {
  id: string;
  name: string;
  npi: string;
  address: string;
}

export interface OrgOption {
  id: string;
  name: string;
  npi: string;
  tin: string;
}
