import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;
export const index = wrapHandler('assign-devices', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
    for (const deviceId of requestBody.deviceIds) {
      const searchResult = await oystehr.fhir.search({
        resourceType: 'Device',
        params: [{ name: '_id', value: deviceId }],
      });
      const currentDevice = searchResult.unbundle()[0];
      if (!currentDevice) {
        throw new Error(`Device with ID ${deviceId} not found`);
      }
      const patientPayload = {
        patient: {
          type: 'Patient',
          reference: `Patient/${requestBody.patientId}`,
        },
      };
      const updatedPayload = { ...currentDevice, ...patientPayload };
      const result = await oystehr.fhir.update({
        id: deviceId,
        ...updatedPayload,
      });
      updatedDevices.push(result);
    }
    return lambdaResponse(200, {
      message: `Assigned ${requestBody.deviceIds.length} devices`,
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
