import { APIGatewayProxyResult } from 'aws-lambda';
import { validateRequestParameters } from './validateRequestParameters';
import { createFhirClient } from '../shared/helpers';
import { getAccessToken } from '../shared';
import { getAppointmentResource } from '../shared/fhir';
import { Secrets, ZambdaInput, SecretsKeys, getSecret, topLevelCatch } from 'utils';

export interface GetPresignedFileURLInput {
  appointmentID: string;
  fileType: 'id-front' | 'id-back' | 'insurance-card-front' | 'insurance-card-back';
  fileFormat: 'jpg' | 'jpeg' | 'png';
  secrets: Secrets | null;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { appointmentID, fileType, fileFormat, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAccessToken(secrets);
    } else {
      console.log('already have token');
    }

    const fhirClient = createFhirClient(zapehrToken, secrets);
    // const z3Client = createZ3Client(zapehrToken, secrets);

    console.log(`getting appointment with id ${appointmentID}`);
    const appointment = await getAppointmentResource(appointmentID, fhirClient);
    if (!appointment) {
      throw new Error('Appointment is not found');
    }
    const patient = appointment?.participant.find((participantTemp) =>
      participantTemp.actor?.reference?.startsWith('Patient/'),
    )?.actor?.reference;
    if (!patient) {
      throw new Error('Patient is not found');
    }
    const patientID = patient.replace('Patient/', '');

    let bucketName = '';
    bucketName += getSecret(SecretsKeys.PROJECT_ID, secrets);
    bucketName += '-';
    if (fileType === 'id-front') {
      bucketName += 'id-cards';
    } else if (fileType === 'id-back') {
      bucketName += 'id-cards';
    } else if (fileType === 'insurance-card-front') {
      bucketName += 'insurance-cards';
    } else if (fileType === 'insurance-card-back') {
      bucketName += 'insurance-cards';
    } else {
      throw Error('Unknown bucket');
    }
    console.log(4, bucketName);
    const fileURL = `${getSecret(
      SecretsKeys.PROJECT_API,
      secrets,
    )}/z3/${bucketName}/${patientID}/${Date.now()}-${fileType}.${fileFormat}`;
    console.log('make presigned URL request');
    console.log(fileURL);
    const presignedURLRequest = await fetch(fileURL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${zapehrToken}`,
      },
      body: JSON.stringify({ action: 'upload' }),
    });
    console.log('presigned URL request successfully made');
    const presignedURLResponse = await presignedURLRequest.json();
    console.log('response', presignedURLResponse);
    console.log('token', zapehrToken);

    return {
      statusCode: 200,
      body: JSON.stringify({ presignedURL: presignedURLResponse.signedUrl, z3URL: fileURL }),
    };
  } catch (error: any) {
    await topLevelCatch('get-presigned-file-url', error, input.secrets);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
};
