import { ZambdaInput } from '../types';
import { APIGatewayProxyResult } from 'aws-lambda';
import { validateRequestParameters } from './validateRequestParameters';
import { checkOrCreateM2MClientToken, createAppClient, createFhirClient } from '../shared/helpers';
import { checkIfProvidersInstruction, createCommunicationResource, updateCommunicationResource } from './helpers';
import { Communication } from 'fhir/r4';
import { makeCommunicationDTO } from '../shared/chart-data/chart-data-helpers';
import { getMyPractitionerId } from '../shared/practitioners';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    const { id, text, secrets } = validateRequestParameters(input);
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const fhirClient = createFhirClient(m2mtoken, secrets);
    const appClient = createAppClient(input.headers.Authorization.replace('Bearer ', ''), secrets);
    const myPractitionerId = await getMyPractitionerId(fhirClient, appClient);
    let communication: Communication;

    if (id) {
      await checkIfProvidersInstruction(id, myPractitionerId, fhirClient);
      communication = await updateCommunicationResource(id, text, fhirClient);
    } else {
      communication = await createCommunicationResource(text, myPractitionerId, fhirClient);
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
