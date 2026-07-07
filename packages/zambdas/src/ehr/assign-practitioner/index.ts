import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Coding, Encounter, PractitionerRole } from 'fhir/r4b';
import { AssignPractitionerInput, AssignPractitionerResponse, Secrets, userMe } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { getVisitResources } from '../../shared/practitioner/helpers';
import { assignPractitionerIfPossible } from './helpers/helpers';
import { validateRequestParameters } from './validateRequestParameters';
let m2mToken: string;

export const index = wrapHandler('assign-practitioner', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);

  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);
  console.log('Created Oystehr client');

  const validatedData = await complexValidation(oystehr, validatedParameters);

  const response = await performEffect(
    oystehr,
    validatedParameters.userToken,
    validatedParameters.secrets,
    validatedData
  );
  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});

export const complexValidation = async (
  oystehr: Oystehr,
  params: AssignPractitionerInput
): Promise<{
  encounter: Encounter;
  appointment: Appointment;
  practitionerRole?: PractitionerRole;
  practitionerId: string;
  userRole: Coding[];
}> => {
  const { encounterId, practitionerId, userRole } = params;
  // todo: query practitionerRole array for this practitioner and determine if any matches for the encounter location

  const visitResources = await getVisitResources(oystehr, encounterId);
  if (!visitResources) {
    throw new Error(`Visit resources are not properly defined for encounter ${encounterId}`);
  }

  const { encounter, appointment } = visitResources;

  if (!encounter?.id) throw new Error('Encounter not found');

  return {
    encounter,
    appointment,
    practitionerId,
    userRole,
  };
};

export const performEffect = async (
  oystehr: Oystehr,
  token: string,
  secrets: Secrets | null,
  validatedData: {
    encounter: Encounter;
    appointment: Appointment;
    practitionerId: string;
    userRole: Coding[];
  }
): Promise<AssignPractitionerResponse> => {
  const { encounter, appointment, practitionerId, userRole } = validatedData;

  const user = await userMe(token, secrets);
  await assignPractitionerIfPossible(oystehr, encounter, appointment, practitionerId, userRole, user);

  return {
    message: `Successfully assigned practitioner with ID ${practitionerId} to encounter ${encounter.id}.`,
  };
};
