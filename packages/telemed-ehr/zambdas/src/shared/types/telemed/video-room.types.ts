import { Encounter } from 'fhir/r4';
import { EncounterVirtualServiceExtension, OtherParticipantsExtension } from 'ehr-utils';

export interface CreateTelemedVideoRoomRequestPayload {
  encounter: Encounter & {
    extension?: OtherParticipantsExtension[];
  };
}

export interface CreateTelemedVideoRoomResponse {
  encounter: Encounter & {
    extension: (OtherParticipantsExtension | EncounterVirtualServiceExtension)[];
  };
}
