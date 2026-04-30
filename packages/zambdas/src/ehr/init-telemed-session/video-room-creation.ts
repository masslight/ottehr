import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getRelatedPersonsForPatient, getSecret, Secrets, SecretsKeys } from 'utils';
import { getAuth0Token } from '../../shared';
import { getPatientFromAppointment } from '../../shared/appointment/helpers';
import { getVideoRoomResourceExtension } from '../../shared/helpers';
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
    body: JSON.stringify({ encounter: encounter }),
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

const updateVideoRoomEncounter = (
  encounter: Encounter,
  relatedPersons: RelatedPerson[],
  startTime: DateTime = DateTime.now()
): Encounter => {
  const wasAlreadyInProgress = encounter.status === 'in-progress';
  encounter.status = 'in-progress';
  const startTimeIso = startTime.toUTC().toISO()!;

  encounter.statusHistory ??= [];

  if (!wasAlreadyInProgress) {
    const previousStatus = encounter.statusHistory[encounter.statusHistory.length - 1];
    if (previousStatus) {
      previousStatus.period = {
        ...previousStatus.period,
        end: startTimeIso,
      };
    }

    encounter.statusHistory.push({
      status: encounter.status,
      period: {
        start: startTimeIso,
      },
    });
  }

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

  const videoRoomExt = getVideoRoomResourceExtension(encounter);
  encounter.extension = encounter.extension?.filter((ext) => ext !== videoRoomExt);

  return encounter;
};
