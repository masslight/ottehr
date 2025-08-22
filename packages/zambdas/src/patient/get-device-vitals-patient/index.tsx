import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getAuth0Token, getUser, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;
export const index = wrapHandler(
  'get-device-vitals-patient',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    try {
      let requestBody;
      try {
        requestBody = typeof input.body === 'string' ? JSON.parse(input.body) : input.body;
        if (requestBody.body) {
          requestBody = typeof requestBody.body === 'string' ? JSON.parse(requestBody.body) : requestBody.body;
        }
      } catch (e) {
        console.error('Failed to parse body:', e);
        throw new Error('Invalid request body format');
      }

      const { deviceId } = requestBody;

      if (!deviceId) {
        throw new Error('Missing required parameters: deviceId');
      }

      const secrets = input.secrets;
      if (!oystehrToken) {
        oystehrToken = await getAuth0Token(secrets);
      }
      const oystehr = createOystehrClient(oystehrToken, secrets);
      const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
      const patientId = user.profile.split('/')[1];

      const searchResult = await oystehr.fhir.search({
        resourceType: 'Observation',
        params: [
          { name: 'device', value: `Device/${deviceId}` },
          { name: 'patient', value: `Patient/${patientId}` },
          { name: '_sort', value: '-date' },
          { name: '_count', value: '1' },
        ],
      });

      const observations = searchResult.unbundle()[0] as any;

      if (!observations) {
        throw new Error(`No observation found for device ${deviceId} and patient ${patientId}`);
      }

      console.log('Observations of components:', JSON.stringify(observations, null, 2));
      console.log('Observations of vitals:', JSON.stringify(observations.component, null, 2));

      return lambdaResponse(200, {
        message: `Successfully retrieved vital details`,
        vitals: observations.component,
        total: Number(observations.component.length),
      });
    } catch (error: any) {
      console.error('Error:', error);
      return lambdaResponse(500, {
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  }
);
