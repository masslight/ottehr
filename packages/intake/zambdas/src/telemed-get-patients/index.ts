import { APIGatewayProxyResult } from 'aws-lambda';
import {
  FHIR_EXTENSION,
  PRIVATE_EXTENSION_BASE_URL,
  PatientInfo,
  createOystehrClient,
  getPatientsForUser,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets, SecretsKeys, getSecret } from 'zambda-utils';
import { getAuth0Token } from '../shared';
import { getUser } from '../shared/auth';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetPatientsInput {
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

    const oystehr = createOystehrClient(
      zapehrToken,
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
      const chosenName = patientTemp.extension?.find((ext) => ext.url === FHIR_EXTENSION.Patient.chosenName.url)
        ?.valueString;

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
};
