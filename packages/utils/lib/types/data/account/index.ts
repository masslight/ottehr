import { Account, Coverage, InsurancePlan, Organization, Patient, Practitioner, RelatedPerson } from 'fhir/r4b';

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

export interface PatientAccountResponse extends PatientAccountAndCoverageResources {
  primaryCarePhysician?: Practitioner;
  insurancePlans?: InsurancePlan[];
  insuranceOrgs?: Organization[];
}
