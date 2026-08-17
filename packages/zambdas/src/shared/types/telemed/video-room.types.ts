import { Encounter } from 'fhir/r4b';
import {
  EncounterVirtualServiceExtension,
  OtherParticipantsExtension,
} from 'utils/lib/types/data/oystehr-api.types.ts/telemed.types';

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
