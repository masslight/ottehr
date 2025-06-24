import { InsurancePlan, Location, Organization } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { IcdSearchResponse } from 'utils';

export type PlanOwnedBy = Omit<InsurancePlan, 'ownedBy'> & { ownedBy?: Organization };

export type NameInformation = {
  firstName: string;
  middleName: string;
  lastName: string;
};

export type PersonInformation = {
  dob: DateTime | null;
  sex: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
} & NameInformation;

export type PatientInformationModalFormValues = {
  relationship: string;
} & PersonInformation;

export type InsuredInformationModalFormValues = {
  planAndPayor?: PlanOwnedBy;
  insuredID: string;
  policyGroup: string;
} & PersonInformation;

export type AdditionalInformationFormValues = {
  relatedToEmployment: boolean;
  relatedToAutoAccident: string;
  relatedToOtherAccident: boolean;
  claimCodes: string;
  illness: DateTime | null;
  unableToWork: [DateTime | null, DateTime | null];
  hospitalization: [DateTime | null, DateTime | null];
  resubmissionCode: string;
  authorizationNumber: string;
};

export type DiagnosesFormValues = {
  items: (IcdSearchResponse['codes'][number] | null)[];
  comment: string;
};

export type BillingFormValues = {
  items: {
    date: [DateTime | null, DateTime | null];
    // place: string;
    emergency: boolean;
    code: string;
    modifiers: string;
    // pointerA: boolean;
    // pointerB: boolean;
    charges: number;
    units: number;
    // epsdt: boolean;
    // provider: string;
  }[];
  payment: number;
};

export type AdditionalInsuranceFormValues = {
  firstName: string;
  middleName: string;
  lastName: string;
  policyGroup: string;
};

export type SLBProviderFormValues = {
  location?: Location;
};
