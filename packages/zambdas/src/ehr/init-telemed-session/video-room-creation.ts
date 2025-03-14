import Oystehr from '@oystehr/sdk';
import { Appointment, Encounter, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getSecret, Secrets, SecretsKeys } from 'zambda-utils';
import { getAuth0Token } from '../shared';
import { getPatientFromAppointment } from '../shared/appointment/helpers';
import { getVideoRoomResourceExtension } from '../shared/helpers';
import { getRelatedPersonForPatient } from '../shared/patients';
import { CreateTelemedVideoRoomResponse } from '../shared/types/telemed/video-room.types';

export const createVideoRoom = async (
  appointment: Appointment,
  currentVideoEncounter: Encounter,
  oystehr: Oystehr,
  secrets: Secrets | null
): Promise<CreateTelemedVideoRoomResponse['encounter']> => {
  const patientId = getPatientFromAppointment(appointment);
  if (!patientId) {
    throw new Error(`Pateint id not defined on appointment ${appointment.id}`);
  }
  const relatedPerson = await getRelatedPersonForPatient(patientId, oystehr);

  const updatedEncounter = updateVideoRoomEncounter(currentVideoEncounter, relatedPerson);
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
  relatedPerson?: RelatedPerson,
  startTime: DateTime = DateTime.now()
): Encounter => {
  encounter.status = 'in-progress';
  const startTimeIso = startTime.toUTC().toISO()!;

  encounter.statusHistory ??= [];

  const previousStatus = encounter.statusHistory?.[encounter.statusHistory?.length - 1];
  if (previousStatus) {
    previousStatus.period = {
      ...previousStatus.period,
      end: startTimeIso!,
    };
  }

  encounter.statusHistory?.push({
    status: encounter.status,
    period: {
      start: startTimeIso!,
    },
  });

  encounter.participant ??= [];

  if (relatedPerson) {
    encounter.participant?.push({
      individual: {
        reference: `RelatedPerson/${relatedPerson?.id}`,
      },
    });
  }

  const videoRoomExt = getVideoRoomResourceExtension(encounter);
  encounter.extension = encounter.extension?.filter((ext) => ext !== videoRoomExt);

  return encounter;
};
