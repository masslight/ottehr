import { Account, Coverage, Organization, Patient, RelatedPerson } from 'fhir/r4b';

export interface OrderedCoverages {
  primary?: Coverage;
  secondary?: Coverage;
  workersComp?: Coverage;
}

export interface OrderedCoveragesWithSubscribers extends OrderedCoverages {
  primarySubscriber?: RelatedPerson;
  secondarySubscriber?: RelatedPerson;
}

export interface PatientAccountAndCoverageResources {
  patient: Patient;
  coverages: OrderedCoveragesWithSubscribers;
  insuranceOrgs: Organization[];
  account?: Account;
  workersCompAccount?: Account;
  occupationalMedicineAccount?: Account;
  employerOrganization?: Organization;
  occupationalMedicineEmployerOrganization?: Organization;
  attorneyRelatedPerson?: RelatedPerson;
  guarantorResource?: RelatedPerson | Patient;
  emergencyContactResource?: RelatedPerson;
}

export interface CoverageWithPriority {
  resource: Coverage;
  startingPriority: number;
}
