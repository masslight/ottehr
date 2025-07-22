import Oystehr from '@oystehr/sdk';
import { Operation } from 'fast-json-patch';
import { Coding, Encounter, PractitionerRole } from 'fhir/r4b';
import { getPatchBinary, UserRole } from 'utils';
import { EncounterPackage } from '../../../shared/practitioner/types';

export const unassignParticipantIfPossible = async (
  oystehr: Oystehr,
  resourcesToUpdate: EncounterPackage,
  practitionerId: string,
  userRole: typeof UserRole,
  practitionerRole?: PractitionerRole
): Promise<void> => {
  if (!resourcesToUpdate.encounter?.id || !practitionerId) {
    throw new Error('Invalid Encounter or Practitioner ID');
  }

  const encounterPatchOp: Operation[] = [];

  const unassignPractitionerOp = await getUnassignParticipantToEncounterOperation(
    resourcesToUpdate.encounter,
    practitionerId,
    userRole,
    practitionerRole
  );
  if (unassignPractitionerOp) {
    encounterPatchOp.push(...unassignPractitionerOp);
  }

  if (encounterPatchOp.length > 0) {
    await oystehr.fhir.transaction({
      requests: [
        getPatchBinary({
          resourceType: 'Encounter',
          resourceId: resourcesToUpdate.encounter.id!,
          patchOperations: encounterPatchOp,
        }),
      ],
    });
  }
};

const getUnassignParticipantToEncounterOperation = async (
  encounter: Encounter,
  practitionerId: string,
  userRole: typeof UserRole,
  practitionerRole?: PractitionerRole
): Promise<Operation[]> => {
  const now = new Date().toISOString();
  const participants = encounter.participant;
  const individualReference = practitionerRole
    ? `PractitionerRole/${practitionerRole.id}`
    : `Practitioner/${practitionerId}`;

  if (!participants || participants.length === 0) {
    return [
      {
        op: 'add',
        path: '/participant',
        value: [
          {
            individual: { reference: individualReference },
            period: { start: now, end: now },
            type: [{ coding: userRole }],
          },
        ],
      },
    ];
  }
  const matchParticipant = (participant: any, hasEnd: boolean): boolean => {
    const matchIndividualReference = participant.individual?.reference === individualReference;
    const matchUserRole = Array.isArray(userRole)
      ? participant.type?.some(
          (type: { coding: any[] }) =>
            type.coding?.some((coding: { code: any; display: any }) =>
              userRole.some((role) => role.code === coding.code || role.display === coding.display)
            )
        )
      : participant.type?.some(
          (type: { coding: any[] }) =>
            type.coding?.some((coding: (code: string, display: string) => Coding[]) => coding === userRole)
        );

    const hasStartCondition = hasEnd
      ? participant.period?.start && participant.period?.end
      : participant.period?.start && !participant.period?.end;

    return matchIndividualReference && matchUserRole && hasStartCondition;
  };

  const startOnlyIndex = participants.findIndex((p) => matchParticipant(p, false));
  const startAndEndIndex = participants.findIndex((p) => matchParticipant(p, true));

  if (startOnlyIndex !== -1) {
    return [
      {
        op: 'add',
        path: `/participant/${startOnlyIndex}/period/end`,
        value: now,
      },
    ];
  }

  if (startAndEndIndex !== -1) {
    return [];
  }

  return [
    {
      op: 'add',
      path: `/participant/${participants.length}`,
      value: {
        individual: { reference: individualReference },
        period: { start: now, end: now },
        type: [{ coding: userRole }],
      },
    },
  ];
};
