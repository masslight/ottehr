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

    const { deviceId, patientId, page = 1, pageSize = 5, isModal } = requestBody;

    if (!deviceId || !patientId) {
      throw new Error('Missing required parameters: deviceId, patientId');
    }

    const secrets = input.secrets;
    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, secrets);
    const offset = (page - 1) * pageSize;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const searchResult = await oystehr.fhir.search({
      resourceType: 'Observation',
      params: [
        { name: 'device', value: `Device/${deviceId}` },
        { name: 'patient', value: `Patient/${patientId}` },
        { name: 'category', value: `vital-signs` },
        { name: '_sort', value: '-_lastUpdated' },
        { name: '_total', value: 'accurate' },
        { name: '_count', value: String(pageSize) },
        { name: '_offset', value: String(offset) },
        ...(isModal ? [{ name: 'date', value: `ge${thirtyDaysAgo}` }] : []),
      ],
    });

    const observations = searchResult.unbundle() as any[];

    return lambdaResponse(200, {
      message: `Successfully retrieved vitals`,
      observations: observations,
      total: Number(searchResult.total),
    });
  } catch (error: any) {
    console.error('Error:', error);
    return lambdaResponse(500, {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});
