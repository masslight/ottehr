import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import { captureException } from '@sentry/aws-serverless';
import { Operation } from 'fast-json-patch';
import { Appointment, Condition, Encounter } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { buildFollowupEncounterType } from 'utils/lib/fhir/encounter';
import { getAppointmentMetaTagOpForFollowUpConversion } from 'utils/lib/fhir/helpers';
import { getPatchBinary } from 'utils/lib/fhir/resourcePatch';
import { User } from 'utils/lib/types/api/user.types';
import { CONCURRENT_UPDATE_WITH_MESSAGE, errorHasStatusCode } from 'utils/lib/types/errors';
import { v4 as uuid } from 'uuid';

/**
 * Diagnoses already recorded on the visit being converted. Codes here are skipped during
 * carry-over so an in-progress visit doesn't end up with the same diagnosis twice.
 */
const getExistingDiagnosisCodes = async (oystehr: Oystehr, encounter: Encounter): Promise<Set<string>> => {
  const conditionIds = (encounter.diagnosis ?? [])
    .map((entry) => entry.condition?.reference)
    .filter((ref): ref is string => typeof ref === 'string' && ref.startsWith('Condition/'))
    .map((ref) => ref.split('/')[1]);

  if (conditionIds.length === 0) return new Set();

  const conditions = await Promise.all(
    conditionIds.map((id) => oystehr.fhir.get<Condition>({ resourceType: 'Condition', id }))
  );

  return new Set(
    conditions.flatMap((condition) => (condition.code?.coding ?? []).map((coding) => `${coding.system}|${coding.code}`))
  );
};

/**
 * Clones the parent encounter's diagnosis Conditions onto the converted encounter, mirroring
 * the carry-over `create-appointment` performs when a scheduled follow-up is booked outright.
 * Best-effort: a failure here must never prevent the conversion itself.
 */
const buildDiagnosisCarryOver = async (
  oystehr: Oystehr,
  parentEncounter: Encounter,
  encounter: Encounter,
  patientRef: string
): Promise<{ requests: BatchInputPostRequest<Condition>[]; entries: NonNullable<Encounter['diagnosis']> }> => {
  const requests: BatchInputPostRequest<Condition>[] = [];
  const entries: NonNullable<Encounter['diagnosis']> = [];

  try {
    const parentEntries = (parentEncounter.diagnosis ?? []).filter((entry) => {
      const ref = entry.condition?.reference;
      return typeof ref === 'string' && ref.startsWith('Condition/');
    });
    if (parentEntries.length === 0) return { requests, entries };

    const existingCodes = await getExistingDiagnosisCodes(oystehr, encounter);

    const parentConditions = await Promise.all(
      parentEntries.map((entry) =>
        oystehr.fhir.get<Condition>({ resourceType: 'Condition', id: entry.condition!.reference!.split('/')[1] })
      )
    );

    parentEntries.forEach((entry, idx) => {
      const parentCondition = parentConditions[idx];
      const alreadyPresent = (parentCondition.code?.coding ?? []).some((coding) =>
        existingCodes.has(`${coding.system}|${coding.code}`)
      );
      if (alreadyPresent) return;

      const newConditionUrl = `urn:uuid:${uuid()}`;
      requests.push({
        method: 'POST',
        url: '/Condition',
        fullUrl: newConditionUrl,
        resource: {
          resourceType: 'Condition',
          subject: { reference: patientRef },
          encounter: { reference: `Encounter/${encounter.id}` },
          code: parentCondition.code,
          clinicalStatus: parentCondition.clinicalStatus,
          verificationStatus: parentCondition.verificationStatus,
          meta: {
            tag: [{ code: 'diagnosis', system: `${PRIVATE_EXTENSION_BASE_URL}/diagnosis` }],
          },
        },
      });
      entries.push({
        condition: { reference: newConditionUrl },
        ...(entry.rank !== undefined && { rank: entry.rank }),
      });
    });
  } catch (error) {
    console.error(`Failed to carry over diagnoses from parent encounter ${parentEncounter.id}:`, error);
    captureException(error, { extra: { parentEncounterId: parentEncounter.id, encounterId: encounter.id } });
    return { requests: [], entries: [] };
  }

  return { requests, entries };
};

export const convertVisitToScheduledFollowUp = async (
  oystehr: Oystehr,
  {
    encounter,
    appointment,
    parentEncounter,
    patientRef,
    user,
    skipPatientDiagnosis,
  }: {
    encounter: Encounter;
    appointment: Appointment;
    parentEncounter: Encounter;
    patientRef: string;
    user: User;
    skipPatientDiagnosis?: boolean;
  }
): Promise<{ diagnosesCarriedOver: number }> => {
  const { requests: diagnosisRequests, entries: diagnosisEntries } = skipPatientDiagnosis
    ? { requests: [], entries: [] }
    : await buildDiagnosisCarryOver(oystehr, parentEncounter, encounter, patientRef);

  // The whole point of converting in place: the encounter keeps its identity, so every
  // Condition, Observation, ServiceRequest and QuestionnaireResponse already pointing at it
  // stays attached. Only its classification changes.
  const encounterOps: Operation[] = [
    {
      op: encounter.partOf ? 'replace' : 'add',
      path: '/partOf',
      value: { reference: `Encounter/${parentEncounter.id}` },
    },
    {
      op: encounter.type ? 'replace' : 'add',
      path: '/type',
      value: buildFollowupEncounterType('scheduled'),
    },
  ];

  if (diagnosisEntries.length > 0) {
    encounterOps.push({
      op: encounter.diagnosis ? 'replace' : 'add',
      path: '/diagnosis',
      value: [...(encounter.diagnosis ?? []), ...diagnosisEntries],
    });
  }

  const appointmentOps = getAppointmentMetaTagOpForFollowUpConversion(appointment, parentEncounter.id!, { user });

  const requests = [
    ...diagnosisRequests,
    getPatchBinary({
      resourceType: 'Encounter',
      resourceId: encounter.id!,
      patchOperations: encounterOps,
      ifMatch: encounter.meta?.versionId ? `W/"${encounter.meta.versionId}"` : undefined,
    }),
    ...(appointmentOps.length > 0
      ? [
          getPatchBinary({
            resourceType: 'Appointment',
            resourceId: appointment.id!,
            patchOperations: appointmentOps,
          }),
        ]
      : []),
  ];

  try {
    await oystehr.fhir.transaction({ requests });
  } catch (error: any) {
    if (errorHasStatusCode(error, 412) || errorHasStatusCode(error, 410)) {
      throw CONCURRENT_UPDATE_WITH_MESSAGE('The encounter was modified during the operation');
    }
    captureException(error, {
      tags: {
        encounterId: encounter.id,
        appointmentId: appointment.id,
        parentEncounterId: parentEncounter.id,
        userId: user.id,
        function: 'convertVisitToScheduledFollowUp',
      },
    });
    console.error('Error converting visit to a scheduled follow-up:', error);
    throw error;
  }

  return { diagnosesCarriedOver: diagnosisEntries.length };
};
