import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, SecretsKeys } from 'utils';
import { checkOrCreateM2MClientToken, wrapHandler, ZambdaInput } from '../../shared';
import { makeCommunicationDTO } from '../../shared/chart-data';
import { createOystehrClient } from '../../shared/helpers';
import { getCommunicationResources } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;
const ZAMBDA_NAME = 'get-patient-instructions';
export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const { type, secrets, userToken } = validateRequestParameters(input);
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);
    const oystehrCurrentUser = createOystehrClient(userToken, secrets);
    const myPractitionerId = (await oystehrCurrentUser.user.me()).profile;
    const ORGANIZATION_ID = getSecret(SecretsKeys.ORGANIZATION_ID, secrets);
    const communicationsOwnerId = type === 'organization' ? ORGANIZATION_ID : myPractitionerId;

    const communications = await getCommunicationResources(oystehr, type, communicationsOwnerId);
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
});
