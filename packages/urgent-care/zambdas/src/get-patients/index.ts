import { APIGatewayProxyResult } from 'aws-lambda';
import { validateRequestParameters } from './validateRequestParameters';
import { createFhirClient } from '../shared/helpers';
import { getAccessToken } from '../shared';
import { getPatientsForUser, getUser } from '../shared/auth';
import { PRIVATE_EXTENSION_BASE_URL, Secrets, ZambdaInput, topLevelCatch } from 'ottehr-utils';

export interface GetPatientsInput {
  secrets: Secrets | null;
}

type PatientInfo = {
  id: string | undefined;
  firstName: string | undefined;
  lastName: string | undefined;
  dateOfBirth: string | undefined;
  sex: string | undefined;
  email: string | undefined;
  emailUser: 'Patient' | 'Parent/Guardian' | undefined;
};

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAccessToken(secrets);
    } else {
      console.log('already have token');
    }

    // const appClient = createAppClient(input.headers.Authorization.replace('Bearer ', ''), secrets);
    // const user = await appClient.getMe();
    // console.log(user);

    const fhirClient = createFhirClient(zapehrToken, secrets);
    console.log('getting user');
    const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
    console.log('getting patients for user');
    const patients = await getPatientsForUser(user, fhirClient);

    const patientsInformation = [];
    console.log('building patient information resource array');
    for (const patientTemp of patients) {
      let email;
      const emailUser = patientTemp.extension?.find((ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/form-user`)
        ?.valueString as any;
      if (emailUser) {
        if (emailUser === 'Patient') {
          email = patientTemp.telecom?.find((telecom) => telecom.system === 'email')?.value;
        }
        if (emailUser === 'Parent/Guardian') {
          const guardianContact = patientTemp.contact?.find((contact) =>
            contact.relationship?.find((relationship) => relationship?.coding?.[0].code === 'Parent/Guardian'),
          );
          email = guardianContact?.telecom?.find((telecom) => telecom.system === 'email')?.value;
        }
      }
      const patient: PatientInfo = {
        id: patientTemp.id,
        dateOfBirth: patientTemp.birthDate,
        sex: patientTemp.gender,
        firstName: patientTemp.name?.[0].given?.[0],
        lastName: patientTemp.name?.[0].family,
        email: email,
        emailUser: emailUser,
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
    await topLevelCatch('get-patients', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error }),
    };
  }
};
