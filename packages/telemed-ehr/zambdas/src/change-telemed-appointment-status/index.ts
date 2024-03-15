import { APIGatewayProxyResult } from 'aws-lambda';
import { getAuth0Token } from '../shared';
import { createFhirClient } from '../shared/helpers';
import { ZambdaInput } from '../types';
import { validateRequestParameters } from './validateRequestParameters';
import { FhirClient } from '@zapehr/sdk';
import { getVideoResources } from './helpers/fhir-utils';
import { changeStatusIfPossible } from './helpers/helpers';
import {
  ChangeTelemedAppointmentStatusInput,
  ChangeTelemedAppointmentStatusResponse,
  mapStatusToTelemed,
} from 'ehr-utils';

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    const token = await getAuth0Token(validatedParameters.secrets);
    const fhirClient = createFhirClient(token, validatedParameters.secrets);
    console.log('Created zapToken and fhir client');

    const response = await performEffect(fhirClient, validatedParameters);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log(JSON.stringify(error));
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error changing appointment status' }),
    };
  }
};

export const performEffect = async (
  fhirClient: FhirClient,
  params: ChangeTelemedAppointmentStatusInput,
): Promise<ChangeTelemedAppointmentStatusResponse> => {
  const { appointmentId, newStatus } = params;

  const resourcesToUpdate = await getVideoResources(fhirClient, appointmentId);
  if (!resourcesToUpdate)
    return {
      message: "No resources found with provided 'appointmentId'. Or resources don't have video-room extension.",
    };

  console.log(
    `appointment and encounter statuses: ${resourcesToUpdate.appointment.status}, ${resourcesToUpdate.encounter.status}`,
  );
  const currentStatus = mapStatusToTelemed(resourcesToUpdate.encounter.status, resourcesToUpdate.appointment.status);
  if (currentStatus) await changeStatusIfPossible(fhirClient, resourcesToUpdate, currentStatus, newStatus);
  // if (!(currentStatus && isStatusChangePossible(currentStatus, newStatus)))
  //   return {
  //     message: `Status change between current status: '${currentStatus}', and desired status: '${newStatus}', is not possible.`,
  //   };

  return { message: 'Appointment status successfully changed.' };
};
