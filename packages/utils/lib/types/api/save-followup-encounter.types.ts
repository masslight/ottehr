import { PatientFollowupDetails } from './encounter.types';

export interface SaveFollowupEncounterZambdaInput {
  encounterDetails: PatientFollowupDetails;
}

export interface SaveFollowupEncounterZambdaOutput {
  encounterId: string;
}
