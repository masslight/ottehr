import { APIGatewayProxyResult } from 'aws-lambda';
// import { Oystehr } from '@oystehr/sdk/dist/cjs/resources/classes';
import { Secrets, CollectInHouseLabSpecimenParameters } from 'utils';
import {
  ZambdaInput,
  topLevelCatch,
  checkOrCreateM2MClientToken,
  createOystehrClient,
  getMyPractitionerId,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mtoken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`collect-in-house-lab-specimen started, input: ${JSON.stringify(input)}`);

  let secrets = input.secrets;
  let validatedParameters: CollectInHouseLabSpecimenParameters & { secrets: Secrets | null; userToken: string };

  try {
    validatedParameters = validateRequestParameters(input);
  } catch (error: any) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        message: `Invalid request parameters. ${error.message || error}`,
      }),
    };
  }

  try {
    secrets = validatedParameters.secrets;

    console.log('validateRequestParameters success');

    m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, secrets);
    const _oystehr = createOystehrClient(m2mtoken, secrets);
    const oystehrCurrentUser = createOystehrClient(validatedParameters.userToken, validatedParameters.secrets);
    const _practitionerIdFromCurrentUser = await getMyPractitionerId(oystehrCurrentUser);

    // todo: Business logic would go here

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Successfully collected in-house lab specimen.',
        // todo: Additional response
      }),
    };
  } catch (error: any) {
    console.error('Error collecting in-house lab specimen:', error);
    await topLevelCatch('collect-in-house-lab-specimen', error, secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: `Error processing request: ${error.message || error}`,
      }),
    };
  }
};
