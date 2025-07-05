import { Account, Coverage, Organization, Patient, RelatedPerson } from 'fhir/r4b';

export interface OrderedCoverages {
  primary?: Coverage;
  secondary?: Coverage;
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
  guarantorResource?: RelatedPerson | Patient;
}
