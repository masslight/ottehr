import { APIGatewayProxyResult } from 'aws-lambda';
import { getPatientsForUser, getSecret, PatientInfo, Secrets, SecretsKeys } from 'utils';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import { getUser } from '../../shared/auth';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetPatientsInput {
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = wrapHandler('get-patients', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    // const appClient = createAppClient(input.headers.Authorization.replace('Bearer ', ''), secrets);
    // const user = await appClient.getMe();
    // console.log(user);

    const oystehr = createOystehrClient(zapehrToken, secrets);
    console.log('getting user');
    const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
    console.log('getting patients for user', user);
    const patients = await getPatientsForUser(user, oystehr);
    console.log('patients fetched: ', JSON.stringify(patients));

    const patientsInformation = [];
    console.log('building patient information resource array');
    for (const patientTemp of patients) {
      const email = patientTemp.telecom?.find((telecom) => telecom.system === 'email')?.value;
      const patient: PatientInfo = {
        id: patientTemp.id,
        dateOfBirth: patientTemp.birthDate,
        sex: patientTemp.gender,
        firstName: patientTemp.name?.[0].given?.[0],
        middleName: patientTemp.name?.[0].given?.[1],
        lastName: patientTemp.name?.[0].family,
        email: email,
      };
      patientsInformation.push(patient);
    }

    const response = {
      message: 'Successfully retrieved all patients',
      patients: patientsInformation,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('get-patients', error, ENVIRONMENT, true);
  }
});
