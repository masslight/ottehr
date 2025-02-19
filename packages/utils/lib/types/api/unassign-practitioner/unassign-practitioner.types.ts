import { Coding, Practitioner } from 'fhir/r4b';
import { Secrets } from 'zambda-utils';

export interface UnassignPractitionerInput {
  encounterId: string;
  practitioner: Practitioner;
  userRole: (code: string, display: string) => Coding[];
  secrets: Secrets | null;
}

export interface UnassignPractitionerResponse {
  message: string;
}
