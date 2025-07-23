import { Coding } from 'fhir/r4b';

export interface UnassignPractitionerZambdaInput {
  encounterId: string;
  practitionerId: string;
  userRole: Coding[];
}

export interface UnassignPractitionerZambdaOutput {
  message: string;
}
