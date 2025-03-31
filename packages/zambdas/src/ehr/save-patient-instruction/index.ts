import { APIGatewayProxyResult } from 'aws-lambda';
import { Communication } from 'fhir/r4b';
import { makeCommunicationDTO } from '../../shared/chart-data';
import { createOystehrClient } from '../../shared/helpers';
import { ZambdaInput } from '../../shared';
import { checkIfProvidersInstruction, createCommunicationResource, updateCommunicationResource } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';
import { checkOrCreateM2MClientToken } from '../../shared';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    const { instructionId, text, secrets, userToken } = validateRequestParameters(input);
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const oystehr = createOystehrClient(m2mtoken, secrets);
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
};
