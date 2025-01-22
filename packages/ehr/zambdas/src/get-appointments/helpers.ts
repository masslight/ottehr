import { Encounter, Practitioner } from 'fhir/r4b';
import { AppointmentParticipants, PARTICIPANT_TYPE, ParticipantInfo } from 'utils';

const parseParticipantInfo = (practitioner: Practitioner): ParticipantInfo => ({
  firstName: practitioner.name?.[0]?.given?.[0] ?? '',
  lastName: practitioner.name?.[0]?.family ?? '',
});

export const parseEncounterParticipants = (
  encounter: Encounter,
  participantIdToResourceMap: Record<string, Practitioner>
): AppointmentParticipants => {
  const participants: AppointmentParticipants = {};

  encounter.participant?.forEach((participant) => {
    // Skip if no reference or type
    if (!participant.individual?.reference || !participant.type?.[0]?.coding?.[0]?.code) {
      return;
    }

    const practitioner = participantIdToResourceMap[participant.individual.reference];
    if (!practitioner) return;

    const participantType = participant.type[0].coding[0].code;

    switch (participantType) {
      case PARTICIPANT_TYPE.ADMITTER:
        participants.admitter = parseParticipantInfo(practitioner);
        break;
      case PARTICIPANT_TYPE.ATTENDER:
        participants.attender = parseParticipantInfo(practitioner);
        break;
    }
  });

  return participants;
};
