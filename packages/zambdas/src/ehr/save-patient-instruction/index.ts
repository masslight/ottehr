import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { userMe } from 'utils/lib/auth/user-me.helper';
import { ZambdaInput } from '../../shared/types/common';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { wrapHandler } from '../../shared/sentry';
import { makeCommunicationDTO } from '../../shared/chart-data';
import { createClinicalOystehrClient } from '../../shared/helpers';
import { checkIfProvidersInstruction, createCommunicationResource, updateCommunicationResource } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'save-patient-instruction';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  const { instructionId, text, title, secrets, userToken } = validateRequestParameters(input);
  m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
  const oystehr = createClinicalOystehrClient(m2mToken, secrets);
  const myUserProfile = (await userMe(userToken, secrets)).profile;
  let communication: Communication;

  if (instructionId) {
    await checkIfProvidersInstruction(instructionId, myUserProfile, oystehr);
    communication = await updateCommunicationResource({ communicationId: instructionId, oystehr, text, title });
  } else {
    communication = await createCommunicationResource({ practitionerProfile: myUserProfile, oystehr, text, title });
  }
  return {
    body: JSON.stringify(makeCommunicationDTO(communication)),
    statusCode: 200,
  };
});
