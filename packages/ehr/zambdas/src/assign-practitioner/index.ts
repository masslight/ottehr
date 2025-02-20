import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Practitioner, PractitionerRole } from 'fhir/r4b';
import { AssignPractitionerInput, AssignPractitionerResponse } from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { checkOrCreateM2MClientToken, createOystehrClient } from '../shared/helpers';
import { getVisitResources } from '../shared/practitioner/helpers';
import { getMyPractitionerId } from '../shared/practitioners';
import { assignPractitionerIfPossible } from './helpers/helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, validatedParameters.secrets);

    const oystehr = createOystehrClient(m2mtoken, validatedParameters.secrets);
    const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);
    console.log('Created Oystehr client');

    const validatedData = await complexValidation(oystehr, oystehrCurrentUser, validatedParameters);

    const response = await performEffect(oystehr, validatedData);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error('Stringified error: ' + JSON.stringify(error));
    console.error('Error: ' + error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error assigning encounter participant' }),
    };
  }
};

export const complexValidation = async (
  oystehr: Oystehr,
  oystehrCurrentUser: Oystehr,
  params: AssignPractitionerInput
): Promise<{
  encounter: Encounter;
  appointment: Appointment;
  practitionerRole?: PractitionerRole;
  practitioner: Practitioner;
  userRole: any;
}> => {
  const { encounterId, practitioner, userRole } = params;

  const practitionerIdFromCurrentUser = await getMyPractitionerId(oystehrCurrentUser);

  if (practitioner.id !== practitionerIdFromCurrentUser) {
    throw new Error(`User ID ${practitioner.id} does not match practitioner ID ${practitionerIdFromCurrentUser}.`);
  }
  // todo: query practitionerRole array for this practitioner and determine if any matches for the encounter location

  const visitResources = await getVisitResources(oystehr, encounterId);
  if (!visitResources) {
    throw new Error(`Visit resources are not properly defined for encounter ${encounterId}`);
  }

  const { encounter, appointment, practitionerRole } = visitResources;

  if (!encounter?.id) throw new Error('Encounter not found');

  return {
    encounter,
    appointment,
    practitionerRole,
    practitioner,
    userRole,
  };
};

export const performEffect = async (
  oystehr: Oystehr,
  validatedData: {
    encounter: Encounter;
    appointment: Appointment;
    practitionerRole?: PractitionerRole;
    practitioner: Practitioner;
    userRole: any;
  }
): Promise<AssignPractitionerResponse> => {
  const { encounter, appointment, practitionerRole, practitioner, userRole } = validatedData;

  await assignPractitionerIfPossible(oystehr, { encounter, appointment, practitionerRole }, practitioner, userRole);

  return {
    message: `Successfully assigned practitioner with ID ${
      practitionerRole ? practitionerRole.id : practitioner.id
    } to encounter ${encounter.id}.`,
  };
};
