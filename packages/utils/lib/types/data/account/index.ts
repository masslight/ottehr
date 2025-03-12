import { Account, Coverage, Patient, RelatedPerson } from 'fhir/r4b';

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
  account?: Account;
  guarantorResource?: RelatedPerson | Patient;
}
