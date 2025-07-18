import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Coding, Encounter } from 'fhir/r4b';
import { getPatchBinary } from 'utils';

export const assignPractitionerIfPossible = async (
  oystehr: Oystehr,
  encounter: Encounter,
  practitionerId: string,
  userRole: Coding[]
): Promise<void> => {
  if (!encounter.id || !practitionerId) {
    throw new Error('Invalid Encounter or Practitioner ID');
  }

  await oystehr.fhir.transaction({
    requests: [
      getPatchBinary({
        resourceType: 'Encounter',
        resourceId: encounter.id,
        patchOperations: await getAssignPractitionerToEncounterOperation(encounter, practitionerId, userRole),
      }),
    ],
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
    period: { start: now },
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
