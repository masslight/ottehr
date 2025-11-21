import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter } from 'fhir/r4b';
import {
  ChangeInPersonVisitStatusInput,
  ChangeInPersonVisitStatusResponse,
  getSecret,
  Secrets,
  SecretsKeys,
  User,
  userMe,
  VisitStatusWithoutUnknown,
} from 'utils';
import { checkOrCreateM2MClientToken, topLevelCatch, wrapHandler } from '../../shared';
import { completeInProgressAiQuestionnaireResponseIfPossible } from '../../shared/ai-complete-questionnaire-response';
import { createOystehrClient } from '../../shared/helpers';
import { getVisitResources } from '../../shared/practitioner/helpers';
import { ZambdaInput } from '../../shared/types';
import { changeInPersonVisitStatusIfPossible } from './helpers/helpers';
import { validateRequestParameters } from './validateRequestParameters';

export interface ChangeInPersonVisitStatusInputValidated extends ChangeInPersonVisitStatusInput {
  secrets: Secrets;
  userToken: string;
}

let m2mToken: string;

const ZAMBDA_NAME = 'change-in-person-visit-status';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const validatedParameters = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);

    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);
    console.log('Created Oystehr client');

    const validatedData = await complexValidation(oystehr, validatedParameters);

    const response = await performEffect(oystehr, validatedData);
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

export const complexValidation = async (
  oystehr: Oystehr,
  params: ChangeInPersonVisitStatusInputValidated
): Promise<{
  encounter: Encounter;
  appointment: Appointment;
  oystehr: Oystehr;
  user: User;
  updatedStatus: VisitStatusWithoutUnknown;
}> => {
  const { encounterId, userToken, updatedStatus, secrets } = params;

  const visitResources = await getVisitResources(oystehr, encounterId);
  if (!visitResources) {
    throw new Error(`Visit resources are not properly defined for encounter ${encounterId}`);
  }

  const { encounter, appointment } = visitResources;

  if (!encounter?.id) throw new Error('Encounter not found');

  const user = await userMe(userToken, secrets);
  if (!user) {
    throw new Error('user unexpectedly not found');
  }

  return {
    encounter,
    appointment,
    oystehr,
    user,
    updatedStatus,
  };
};

export const performEffect = async (
  oystehr: Oystehr,
  validatedData: {
    encounter: Encounter;
    appointment: Appointment;
    user: User;
    updatedStatus: VisitStatusWithoutUnknown;
  }
): Promise<ChangeInPersonVisitStatusResponse> => {
  const { encounter, appointment, user, updatedStatus } = validatedData;

  await changeInPersonVisitStatusIfPossible(oystehr, { encounter, appointment }, user, updatedStatus);

  // handle not completed AI interview to give provider required data, completed AI Interview triggers resource creation via subscription
  if (updatedStatus === 'ready for provider' && encounter.id) {
    await completeInProgressAiQuestionnaireResponseIfPossible(oystehr, encounter.id);
  }

  return {};
};
