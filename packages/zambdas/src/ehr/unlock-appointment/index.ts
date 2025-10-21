import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment } from 'fhir/r4b';
import {
  getAppointmentLockMetaTagOperations,
  getCriticalUpdateTagOp,
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

  // Generate patch operations to remove the locked meta tag
  const unlockOperations = getAppointmentLockMetaTagOperations(appointment, false);

  // Add critical update tag to track who made the change
  const updateTag = getCriticalUpdateTagOp(appointment, `Staff ${user?.email || `(${user?.id})`}`);
  unlockOperations.push(updateTag);

  // Create patch request
  const patchRequest = getPatchBinary({
    resourceType: 'Appointment',
    resourceId: appointmentId,
    patchOperations: unlockOperations,
  });

  // Execute the patch
  await oystehr.fhir.batch({
    requests: [patchRequest],
  });

  return {
    message: 'Appointment unlocked successfully.',
  };
};
