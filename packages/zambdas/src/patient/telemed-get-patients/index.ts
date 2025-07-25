import { APIGatewayProxyResult } from 'aws-lambda';
import {
  createOystehrClient,
  FHIR_EXTENSION,
  getPatientsForUser,
  getSecret,
  PatientInfo,
  PRIVATE_EXTENSION_BASE_URL,
  Secrets,
  SecretsKeys,
} from 'utils';
import { getAuth0Token, wrapHandler, ZambdaInput } from '../../shared';
import { getUser } from '../../shared/auth';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetPatientsInput {
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = wrapHandler('telemed-get-patients', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

    // const appClient = createAppClient(input.headers.Authorization.replace('Bearer ', ''), secrets);
    // const user = await appClient.getMe();
    // console.log(user);

    const oystehr = createOystehrClient(
      oystehrToken,
      getSecret(SecretsKeys.FHIR_API, secrets),
      getSecret(SecretsKeys.PROJECT_API, secrets)
    );
    console.log('getting user');
    const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
    console.log('getting patients for user: ' + user.name);
    const patients = await getPatientsForUser(user, oystehr);

    const patientsInformation = [];
    console.log('building patient information resource array');
    for (const patientTemp of patients) {
      const email = patientTemp.telecom?.find((telecom) => telecom.system === 'email')?.value;
      let weight: number | undefined = Number.parseFloat(
        patientTemp.extension?.find((ext) => ext.url === FHIR_EXTENSION.Patient.weight.url)?.valueString ?? ''
      );
      if (isNaN(weight)) {
        weight = undefined;
      }
      const weightLastUpdated = patientTemp.extension?.find(
        (ext) => ext.url === FHIR_EXTENSION.Patient.weightLastUpdated.url
      )?.valueString;
      const chosenName = patientTemp.name?.find((name) => name.use === 'nickname')?.given?.[0];

      const patient: PatientInfo = {
        id: patientTemp.id,
        pointOfDiscovery: patientTemp.extension?.find(
          (ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/point-of-discovery`
        )
          ? true
          : false,
        dateOfBirth: patientTemp.birthDate,
        sex: patientTemp.gender,
        firstName: patientTemp.name?.[0].given?.[0],
        middleName: patientTemp.name?.[0].given?.[1],
        lastName: patientTemp.name?.[0].family,
        chosenName,
        email,
        weightLastUpdated,
        weight,
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
    console.log(error, error.issue);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
});
