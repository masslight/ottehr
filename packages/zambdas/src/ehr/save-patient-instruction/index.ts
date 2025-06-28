import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { makeCommunicationDTO } from '../../shared/chart-data';
import { createOystehrClient } from '../../shared/helpers';
import { checkIfProvidersInstruction, createCommunicationResource, updateCommunicationResource } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'save-patient-instruction';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { instructionId, text, secrets, userToken } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    const myUserProfile = (await oystehrCurrentUser.user.me()).profile;
    let communication: Communication;

    if (instructionId) {
      await checkIfProvidersInstruction(instructionId, myUserProfile, oystehr);
      communication = await updateCommunicationResource(instructionId, text, oystehr);
    } else {
      communication = await createCommunicationResource(text, myUserProfile, oystehr);
    }
    return {
      body: JSON.stringify(makeCommunicationDTO(communication)),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Error saving patient instruction...' }),
      statusCode: 500,
    };
  }
});
