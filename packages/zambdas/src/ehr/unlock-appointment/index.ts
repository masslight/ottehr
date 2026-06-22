import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Operation } from 'fast-json-patch';
import { Appointment, Coding, Encounter } from 'fhir/r4b';
import {
  createCriticalUpdateTag,
  getAppointmentLockMetaTagOperations,
  getEncounterLockMetaTagOperations,
  getPatchBinary,
  UnlockAppointmentZambdaInputValidated,
  UnlockAppointmentZambdaOutput,
  userMe,
} from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'unlock-appointment';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);

  const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
  console.log('Created Oystehr client');

  const response = await performEffect(oystehr, validatedParameters);
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export const performEffect = async (
  oystehr: Oystehr,
  params: UnlockAppointmentZambdaInputValidated
): Promise<UnlockAppointmentZambdaOutput> => {
  const { appointmentId, encounterId, userToken, secrets } = params;

  // Get the current user for tracking who unlocked the chart
  const user = await userMe(userToken, secrets);
  const unlockedByText = `Staff ${user?.email || `(${user?.id})`}`;

  // Annotation follow-ups have no own Appointment, so their lock lives on the Encounter.
  if (encounterId) {
    const encounter = await oystehr.fhir.get<Encounter>({
      resourceType: 'Encounter',
      id: encounterId,
    });

    if (!encounter) {
      throw new Error(`Encounter with ID ${encounterId} not found`);
    }

    // Generate unlock operation (removes ENCOUNTER_LOCKED tag and replaces /meta/tag array)
    const [unlockOp] = getEncounterLockMetaTagOperations(encounter, false);
    applyCriticalUpdateTag(unlockOp, unlockedByText);

    const patchRequest = getPatchBinary({
      resourceType: 'Encounter',
      resourceId: encounterId,
      patchOperations: [unlockOp],
    });

    await oystehr.fhir.batch({
      requests: [patchRequest],
    });

    return {
      message: 'Follow-up unlocked successfully.',
    };
  }

  if (!appointmentId) {
    throw new Error('Either appointmentId or encounterId is required');
  }

  const appointment = await oystehr.fhir.get<Appointment>({
    resourceType: 'Appointment',
    id: appointmentId,
  });

  if (!appointment) {
    throw new Error(`Appointment with ID ${appointmentId} not found`);
  }

  // Generate unlock operation (removes APPOINTMENT_LOCKED tag and replaces /meta/tag array)
  const [unlockOp] = getAppointmentLockMetaTagOperations(appointment, false);
  applyCriticalUpdateTag(unlockOp, unlockedByText);

  // Execute patch with single operation that unlocks and updates critical tag
  const patchRequest = getPatchBinary({
    resourceType: 'Appointment',
    resourceId: appointmentId,
    patchOperations: [unlockOp],
  });

  // Execute the patch
  await oystehr.fhir.batch({
    requests: [patchRequest],
  });

  return {
    message: 'Appointment unlocked successfully.',
  };
};

// Mutates the /meta/tag replacement op in place to add/update a critical-update tag recording who
// unlocked the chart. The unlock op is always a single replace of /meta/tag with the remaining tags.
const applyCriticalUpdateTag = (unlockOp: Operation, updatedByText: string): void => {
  if (!('value' in unlockOp) || !Array.isArray(unlockOp.value)) {
    throw new Error('Unexpected unlock operation structure');
  }

  const tagsAfterUnlock = unlockOp.value as Coding[];

  const criticalUpdateTag = createCriticalUpdateTag(updatedByText);
  const criticalTagIndex = tagsAfterUnlock.findIndex((tag) => tag.system === criticalUpdateTag.system);

  if (criticalTagIndex >= 0) {
    tagsAfterUnlock[criticalTagIndex] = criticalUpdateTag;
  } else {
    tagsAfterUnlock.push(criticalUpdateTag);
  }
};
