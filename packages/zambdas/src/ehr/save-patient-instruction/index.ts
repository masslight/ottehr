import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { getSecret, SecretsKeys } from 'utils';
import { topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { makeCommunicationDTO } from '../../shared/chart-data';
import { createOystehrClient } from '../../shared/helpers';
import { checkIfProvidersInstruction, createCommunicationResource, updateCommunicationResource } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'save-patient-instruction';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { instructionId, text, title, secrets, userToken } = validateRequestParameters(input);
    const oystehr = createOystehrClient(input.accessToken!, secrets);
    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    const myUserProfile = (await oystehrCurrentUser.user.me()).profile;
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
  } catch (error) {
    console.log(error);
    return topLevelCatch(ZAMBDA_NAME, error, getSecret(SecretsKeys.ENVIRONMENT, input.secrets));
  }
});
