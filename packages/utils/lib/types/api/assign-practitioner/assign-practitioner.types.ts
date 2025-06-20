import { Coding, Practitioner } from 'fhir/r4b';
import { Secrets } from '../../../secrets';

export interface AssignPractitionerInput {
  encounterId: string;
  practitioner: Practitioner;
  userRole: Coding[];
}

export interface AssignPractitionerInputValidated {
  encounterId: string;
  practitioner: Practitioner;
  userRole: Coding[];
  secrets: Secrets | null;
  userToken: string;
}

export interface AssignPractitionerResponse {
  message: string;
}
