import { Location } from 'fhir/r4b';
import { FollowupReason, FollowupType } from '../../fhir';

export interface FollowupEncounterDTO {
  encounterId?: string;
  patientId?: string;
}

export interface ProviderDetails {
  practitionerId: string;
  name: string;
}
export interface PatientFollowupDetails {
  encounterId?: string; // will only exist when updating
  patientId: string | null;
  followupType: FollowupType;
  reason?: FollowupReason;
  answered?: string;
  caller?: string;
  message?: string;
  start: string;
  end?: string; // if resolved === true, this should be entered
  location?: Location;
  provider?: ProviderDetails;
  resolved: boolean;
}
