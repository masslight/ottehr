import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;
export const index = wrapHandler('get-vitals', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

    const { deviceId, patientId } = requestBody;

    if (!deviceId || !patientId) {
      throw new Error('Missing required parameters: deviceId, patientId');
    }

    const secrets = input.secrets;
    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, secrets);

    const searchResult = await oystehr.fhir.search({
      resourceType: 'Observation',
      params: [
        { name: 'device', value: `Device/${deviceId}` },
        { name: 'patient', value: `Patient/${patientId}` },
        { name: '_sort', value: '-date' },
        { name: '_count', value: '100' },
      ],
    });

    const observations = searchResult.unbundle()[0] as any;
    console.log('Observations:', JSON.stringify(observations, null, 2));

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
});
