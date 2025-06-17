import { Coding, Practitioner } from 'fhir/r4b';
import { Secrets } from '../../../secrets';

export interface UnassignPractitionerInput {
  encounterId: string;
  practitioner: Practitioner;
  userRole: (code: string, display: string) => Coding[];
  secrets: Secrets | null;
}

export interface UnassignPractitionerResponse {
  message: string;
}
