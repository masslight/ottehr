import { ZambdaInput } from '../types';
import { APIGatewayProxyResult } from 'aws-lambda';
import { checkOrCreateM2MClientToken, createAppClient, createFhirClient } from '../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';
import { getCommunicationResources } from './helpers';
import { getSecret, SecretsKeys } from '../shared';
import { makeCommunicationDTO } from '../shared/chart-data/chart-data-helpers';
import { getMyPractitionerId } from '../shared/practitioners';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.log(`Input: ${JSON.stringify(input)}`);
    const { type, secrets } = validateRequestParameters(input);
    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const fhirClient = createFhirClient(m2mtoken, secrets);
    const appClient = createAppClient(input.headers.Authorization.replace('Bearer ', ''), secrets);
    const ORGANIZATION_ID = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);
    const communicationsOwnerId =
      type === 'organization' ? ORGANIZATION_ID : await getMyPractitionerId(fhirClient, appClient);

    const communications = await getCommunicationResources(fhirClient, type, communicationsOwnerId);
    const communicationsDTOs = communications.map((element) => makeCommunicationDTO(element));
    return {
      body: JSON.stringify(communicationsDTOs),
      statusCode: 200,
    };
  } catch (error) {
    console.log(error);
    return {
      body: JSON.stringify({ message: 'Error getting patient instructions...' }),
      statusCode: 500,
    };
  }
};
