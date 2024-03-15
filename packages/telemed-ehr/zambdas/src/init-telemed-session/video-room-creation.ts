import { AppClient, FhirClient, User } from '@zapehr/sdk';
import { Appointment, Encounter, RelatedPerson } from 'fhir/r4';
import { DateTime } from 'luxon';
import { SecretsKeys, getAuth0Token, getSecret } from '../shared';
import { getPatientFromAppointment } from '../shared/appointment/helpers';
import { getVideoRoomResourceExtension } from '../shared/helpers';
import { getRelatedPersonForPatient } from '../shared/patients';
import { getPractitionerResourceForUser } from '../shared/practitioners';
import { CreateTelemedVideoRoomResponse } from '../shared/types/telemed/video-room.types';
import { Secrets } from '../types';

export const createVideoRoom = async (
  appointment: Appointment,
  currentVideoEncounter: Encounter,
  fhirClient: FhirClient,
  userId: User['id'],
  secrets: Secrets | null,
  appClient: AppClient,
): Promise<CreateTelemedVideoRoomResponse['encounter']> => {
  const patientId = getPatientFromAppointment(appointment);
  if (!patientId) {
    throw new Error(`Pateint id not defined on appointment ${appointment.id}`);
  }
  const relatedPerson = await getRelatedPersonForPatient(patientId, fhirClient);

  const practitioner = await getPractitionerResourceForUser(userId, fhirClient, appClient);

  const updatedEncounter = updateVideoRoomEncounter(currentVideoEncounter, practitioner.id!, relatedPerson);
  const videoRoomEncounterResource = await execCreateVideoRoomRequest(secrets, updatedEncounter);

  return videoRoomEncounterResource as CreateTelemedVideoRoomResponse['encounter'];
};

const execCreateVideoRoomRequest = async (
  secrets: Secrets | null,
  encounter: Encounter,
): Promise<CreateTelemedVideoRoomResponse['encounter']> => {
  const token = await getAuth0Token(secrets);
  const response = await fetch(`${getSecret(SecretsKeys.PROJECT_API, secrets)}/telemed/room`, {
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
  practitionerId: string,
  relatedPerson?: RelatedPerson,
  startTime: DateTime = DateTime.now(),
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

  encounter.participant?.push({
    individual: {
      reference: `Practitioner/${practitionerId}`,
    },
  });

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
