import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Appointment, Coding, Encounter } from 'fhir/r4b';
import {
  getAppointmentMetaTagOpForStatusUpdate,
  getPatchBinary,
  getVisitStatus,
  PRACTITIONER_CODINGS,
  User,
} from 'utils';

export const assignPractitionerIfPossible = async (
  oystehr: Oystehr,
  encounter: Encounter,
  appointment: Appointment,
  practitionerId: string,
  userRole: Coding[],
  user: User
): Promise<void> => {
  if (!encounter.id || !practitionerId) {
    throw new Error('Invalid Encounter or Practitioner ID');
  }

  console.log('assigning practitioner: ', practitionerId);
  const patchRequests = [
    getPatchBinary({
      resourceType: 'Encounter',
      resourceId: encounter.id,
      patchOperations: await getAssignPractitionerToEncounterOperation(encounter, practitionerId, userRole),
    }),
  ];

  const visitStatus = getVisitStatus(appointment, encounter);
  console.log('current visitStatus: ', visitStatus);

  // i believe the only time this will get hit is if the user does not assign a provider before clicking "complete intake"
  // but since there is no logic to prevent not assigning the provider before clicking "complete intake" this is the only way to record the status update
  if (visitStatus === 'ready for provider' && appointment.id) {
    console.log('a provider is being assigned to an appointment in the status', visitStatus);
    console.log('with user role: ', userRole);
    const isAttender = userRole[0].code === PRACTITIONER_CODINGS.Attender[0].code;
    if (isAttender) {
      console.log('and isAttender therefore will add status update tags for provider status');
      patchRequests.push(
        getPatchBinary({
          resourceType: 'Appointment',
          resourceId: appointment.id,
          patchOperations: getAppointmentMetaTagOpForStatusUpdate(appointment, 'provider', { user }),
        })
      );
    }
  }

  await oystehr.fhir.transaction({
    requests: patchRequests,
  });
};

const getAssignPractitionerToEncounterOperation = async (
  encounter: Encounter,
  practitionerId: string,
  userRole: Coding[]
): Promise<Operation[]> => {
  const now = new Date().toISOString();
  const participants = encounter.participant;
  const individualReference = `Practitioner/${practitionerId}`;

  const newParticipant = {
    individual: { reference: individualReference },
    // if it's an attender, we don't need to set the period start, because it will be set on changing status
    // to provider
    period: userRole.some((role) => role.code === PRACTITIONER_CODINGS.Attender[0].code) ? undefined : { start: now },
    type: [{ coding: userRole }],
  };

  // Empty participants case, 'add' operation.
  if (!participants || participants.length === 0) {
    return [
      {
        op: 'add',
        path: '/participant',
        value: [newParticipant],
      },
    ];
  }

  // If participants exist, we need to check if someone already has this same role and remove them and add the new person.
  const participantsExcludingThoseWithRoleWeAreTaking = participants?.filter((participant) => {
    return participant.type?.some((type) => {
      return type.coding?.some((coding) => coding.code !== userRole[0].code);
    });
  });

  return [
    {
      op: 'replace',
      path: `/participant`,
      value: [...participantsExcludingThoseWithRoleWeAreTaking, newParticipant],
    },
  ];
};
