import { Coding } from 'fhir/r4b';
import { Secrets } from '../../../secrets';

export interface AssignPractitionerInput {
  encounterId: string;
  practitionerId: string;
  userRole: Coding[];
}

export interface AssignPractitionerInputValidated {
  encounterId: string;
  practitionerId: string;
  userRole: Coding[];
  secrets: Secrets | null;
  userToken: string;
}

export interface AssignPractitionerResponse {
  message: string;
}
