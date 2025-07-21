import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Coding, Encounter, Practitioner, PractitionerRole } from 'fhir/r4b';
import { getAppointmentMetaTagOpForStatusUpdate, getPatchBinary, PRACTITIONER_CODINGS, User } from 'utils';
import { EncounterPackage } from '../../../shared/practitioner/types';

export const assignPractitionerIfPossible = async (
  oystehr: Oystehr,
  resourcesToUpdate: EncounterPackage,
  practitioner: Practitioner,
  userRole: Coding[],
  curUser: User,
  practitionerRole?: PractitionerRole
): Promise<void> => {
  if (!resourcesToUpdate.encounter?.id || !practitioner) {
    throw new Error('Invalid Encounter or Practitioner ID');
  }

  const encounterPatchOp: Operation[] = [];

  const assignPractitionerOp = await getAssignPractitionerToEncounterOperation(
    resourcesToUpdate.encounter,
    practitioner,
    userRole,
    practitionerRole
  );
  if (assignPractitionerOp) {
    encounterPatchOp.push(...assignPractitionerOp);
  }

  const patchRequests = [
    getPatchBinary({
      resourceType: 'Encounter',
      resourceId: resourcesToUpdate.encounter.id!,
      patchOperations: encounterPatchOp,
    }),
  ];

  // if provider is being added, status should be changing to provider
  if (
    userRole[0].code === PRACTITIONER_CODINGS.Attender[0].code &&
    userRole[0].system === PRACTITIONER_CODINGS.Attender[0].system
  ) {
    patchRequests.push(
      getPatchBinary({
        resourceType: 'Appointment',
        resourceId: resourcesToUpdate.appointment.id!,
        patchOperations: getAppointmentMetaTagOpForStatusUpdate(resourcesToUpdate.appointment, 'provider', {
          user: curUser,
        }),
      })
    );
  }

  if (encounterPatchOp.length > 0) {
    await oystehr.fhir.transaction({
      requests: patchRequests,
    });
  }
};

const getAssignPractitionerToEncounterOperation = async (
  encounter: Encounter,
  practitioner: Practitioner,
  userRole: Coding[],
  practitionerRole?: PractitionerRole
): Promise<Operation[] | undefined> => {
  const now = new Date().toISOString();
  const participants = encounter.participant;
  const individualReference = practitionerRole
    ? `PractitionerRole/${practitionerRole.id}`
    : `Practitioner/${practitioner.id}`;

  if (!participants || participants.length === 0) {
    return [
      {
        op: 'add',
        path: '/participant',
        value: [
          {
            individual: { reference: individualReference },
            period: { start: now },
            type: [{ coding: userRole }],
          },
        ],
      },
    ];
  }

  const existingParticipantIndex = participants.findIndex((participant) => {
    const matchIndividualReference = participant.individual?.reference === individualReference;
    const matchUserRole = Array.isArray(userRole)
      ? participant.type?.some(
          (type) =>
            type.coding?.some((coding) =>
              userRole.some((role) => role.code === coding.code || role.display === coding.display)
            )
        )
      : participant.type?.some((type) => type.coding?.some((coding) => coding === userRole));

    return matchIndividualReference && matchUserRole;
  });

  return existingParticipantIndex === -1
    ? [
        {
          op: 'add',
          path: '/participant/',
          value: {
            individual: { reference: individualReference },
            period: { start: now },
            type: [{ coding: userRole }],
          },
        },
      ]
    : [];
};
