import { APIGatewayProxyResult } from 'aws-lambda';
import { CreateResourcesFromAudioRecordingInput } from 'utils/lib/types/api/appointment.types';
import { Secrets } from 'utils/lib/secrets';
import { userMe } from 'utils/lib/auth/user-me.helper';
import { ZambdaInput } from '../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { wrapHandler } from '../../shared/sentry';
import { transcribeAndCreateResourcesFromZ3Audio } from '../../shared/ai';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'create-resources-from-audio-recording';

export interface CreateResourcesFromAudioRecordingInputValidated extends CreateResourcesFromAudioRecordingInput {
  userToken: string;
  secrets: Secrets | null;
}

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const validatedParameters = validateRequestParameters(input);
  const { userToken, z3URL, duration, visitID, secrets } = validatedParameters;

  m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, validatedParameters.secrets);

  const providerUserProfile = (await userMe(userToken, secrets)).profile;

  const createdResources = await transcribeAndCreateResourcesFromZ3Audio(
    oystehr,
    m2mToken,
    { encounterID: visitID, z3URL, duration, providerUserProfile },
    secrets
  );

  return {
    statusCode: 200,
    body: JSON.stringify(`Successfully created ` + createdResources),
  };
});
