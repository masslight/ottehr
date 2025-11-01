import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Coding } from 'fhir/r4b';
import {
  createCriticalUpdateTag,
  getAppointmentLockMetaTagOperations,
  getPatchBinary,
  getSecret,
  SecretsKeys,
  UnlockAppointmentZambdaInputValidated,
  UnlockAppointmentZambdaOutput,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'unlock-appointment';

let m2mToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);

    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);
    console.log('Created Oystehr client');

    const response = await performEffect(oystehr, oystehrCurrentUser, validatedParameters);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Stringified error: ' + JSON.stringify(error));
    console.error('Error: ' + error);
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});

export const performEffect = async (
  oystehr: Oystehr,
  oystehrCurrentUser: Oystehr,
  params: UnlockAppointmentZambdaInputValidated
): Promise<UnlockAppointmentZambdaOutput> => {
  const { appointmentId } = params;

  const appointment = await oystehr.fhir.get<Appointment>({
    resourceType: 'Appointment',
    id: appointmentId,
  });

  if (!appointment) {
    throw new Error(`Appointment with ID ${appointmentId} not found`);
  }

  // Get the current user for tracking who unlocked the appointment
  const user = await oystehrCurrentUser.user.me();

  // Generate unlock operation (removes APPOINTMENT_LOCKED tag and replaces /meta/tag array)
  const [unlockOp] = getAppointmentLockMetaTagOperations(appointment, false);

  if (!('value' in unlockOp) || !Array.isArray(unlockOp.value)) {
    throw new Error('Unexpected unlock operation structure');
  }

  const tagsAfterUnlock = unlockOp.value as Coding[];

  // Create and add/update critical update tag
  const criticalUpdateTag = createCriticalUpdateTag(`Staff ${user?.email || `(${user?.id})`}`);
  const criticalTagIndex = tagsAfterUnlock.findIndex((tag) => tag.system === criticalUpdateTag.system);

  if (criticalTagIndex >= 0) {
    tagsAfterUnlock[criticalTagIndex] = criticalUpdateTag;
  } else {
    tagsAfterUnlock.push(criticalUpdateTag);
  }

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
