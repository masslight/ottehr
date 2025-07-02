import { PatientFollowupDetails } from '.';

export interface SaveFollowupEncounterZambdaInput {
  encounterDetails: PatientFollowupDetails;
}

export interface SaveFollowupEncounterZambdaOutput {
  encounterId: string;
}
