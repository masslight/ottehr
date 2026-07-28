import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, RelatedPerson } from 'fhir/r4b';
import { getRelatedPersonsForPatient, getSecret, Secrets, SecretsKeys } from 'utils';
import { getAuth0Token } from '../../shared';
import { getPatientFromAppointment } from '../../shared/appointment/helpers';
import { CreateTelemedVideoRoomResponse } from '../../shared/types/telemed/video-room.types';

export const createVideoRoom = async (
  appointment: Appointment,
  currentVideoEncounter: Encounter,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<CreateTelemedVideoRoomResponse['encounter']> => {
  const patientId = getPatientFromAppointment(appointment);
  if (!patientId) {
    throw new Error(`Patient id not defined on appointment ${appointment.id}`);
  }
  const relatedPersons = await getRelatedPersonsForPatient(patientId, oystehr);

  const updatedEncounter = updateVideoRoomEncounter(currentVideoEncounter, relatedPersons);
  const videoRoomEncounterResource = await execCreateVideoRoomRequest(secrets, updatedEncounter);

  return videoRoomEncounterResource as CreateTelemedVideoRoomResponse['encounter'];
};

const execCreateVideoRoomRequest = async (
  secrets: Secrets | null,
  encounter: Encounter
): Promise<CreateTelemedVideoRoomResponse['encounter']> => {
  const token = await getAuth0Token(secrets);
  const response = await fetch(`${getSecret(SecretsKeys.PROJECT_API, secrets)}/telemed/v2/meeting`, {
    // recordAudio enables Oystehr's telemed audio recording. When the recording is ready Oystehr stores an
    // audio/mp4 file in Z3 and creates a DocumentReference (LOINC 56444-3) on the Encounter, which the
    // process-telemed-recording subscription picks up to power the Ambient Scribe AI chart recommendations.
    body: JSON.stringify({ encounter: encounter, recordAudio: true }),
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: 'POST',
  });
  if (!response.ok) {
    throw new Error(`Request failed to create a telemed video room: ${response.statusText}`);
  }
  const responseData = (await response.json()) as CreateTelemedVideoRoomResponse;
  return responseData.encounter;
};

const updateVideoRoomEncounter = (encounter: Encounter, relatedPersons: RelatedPerson[]): Encounter => {
  encounter.participant ??= [];

  const existingRefs = new Set(
    encounter.participant.map((p) => p.individual?.reference).filter((r): r is string => !!r)
  );
  for (const rp of relatedPersons) {
    if (!rp.id) {
      console.warn('Skipping RelatedPerson without id when adding to video encounter participant list');
      continue;
    }
    const ref = `RelatedPerson/${rp.id}`;
    if (!existingRefs.has(ref)) {
      encounter.participant.push({ individual: { reference: ref } });
      existingRefs.add(ref);
    }
  }

  return encounter;
};
