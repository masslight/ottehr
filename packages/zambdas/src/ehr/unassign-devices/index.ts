import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;
export const index = wrapHandler('unassign-devices', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
    const secrets = input.secrets;
    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, secrets);
    const updatedDevices = [];
    const searchResult = await oystehr.fhir.search({
      resourceType: 'Device',
      params: [{ name: '_id', value: requestBody.deviceId }],
    });
    const currentDevice = searchResult.unbundle()[0];
    console.log('Current Device:', currentDevice);
    if (!currentDevice) {
      throw new Error(`Device with ID ${requestBody.deviceId} not found`);
    }
    const patientId = requestBody.patientId;
    if (!patientId) {
      throw new Error('Patient ID not found in device record');
    }

    const updatedPayload = { ...currentDevice };
    delete (updatedPayload as any).patient;
    const result = await oystehr.fhir.update({
      id: requestBody.deviceId,
      ...updatedPayload,
    });

    updatedDevices.push(result);

    return lambdaResponse(200, {
      message: `Unassigned device successfully`,
      updatedDevices,
    });
  } catch (error: any) {
    console.error('Error:', error);
    return lambdaResponse(500, {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});
