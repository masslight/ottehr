import { Coding, Practitioner } from 'fhir/r4b';

export interface UnassignPractitionerZambdaInput {
  encounterId: string;
  practitioner: Practitioner;
  userRole: Coding[];
}

export interface UnassignPractitionerZambdaOutput {
  message: string;
}
