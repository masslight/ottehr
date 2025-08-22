import { APIGatewayProxyResult } from 'aws-lambda';
import { getSecret, Secrets, SecretsKeys } from 'utils';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { getUser } from '../../shared/auth';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetPatientsInput {
  secrets: Secrets | null;
}

let oystehrToken: string;

export const index = wrapHandler('get-patients-devices', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);
    console.log('getting user');
    const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
    console.log('getting patientId', user.profile.split('/')[1]);
    const patientID = user.profile.split('/')[1];
    const locationsResults = await oystehr.fhir.search<any>({
      resourceType: 'Device',
      params: [{ name: 'patient', value: patientID }],
    });
    console.log('Total : ', locationsResults.total);
    const response = {
      message: `Successfully retrieved devices details`,
      devices: locationsResults.unbundle(),
      total: Number(locationsResults.total),
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('get-patients-devices', error, ENVIRONMENT);
  }
});
