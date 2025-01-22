import { Encounter } from 'fhir/r4b';
import { EncounterVirtualServiceExtension, OtherParticipantsExtension } from 'utils';

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
