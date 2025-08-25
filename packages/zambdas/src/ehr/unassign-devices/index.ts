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

    // const observationResult = await oystehr.fhir.search({
    //   resourceType: 'Observation',
    //   params: [
    //     { name: 'device', value: `Device/${requestBody.deviceId}` },
    //     { name: 'patient', value: `Patient/${patientId}` },
    //     { name: '_sort', value: '-date' },
    //     { name: '_count', value: '1' },
    //   ],
    // });

    // const observations = observationResult.unbundle()[0] as any;

    // if (!observations) {
    //   throw new Error(`No observation found for device ${requestBody.deviceId} and patient ${patientId}`);
    // }

    // const filteredComponents = (observations.component || []).filter((component: any) => {
    //   return ![
    //     'weight_threshold',
    //     'glucose_threshold',
    //     'systolic_threshold',
    //     'diastolic_threshold',
    //     'threshold',
    //   ].includes(component.code?.text);
    // });

    // const updatedObservation = {
    //   ...observations,
    //   component: filteredComponents,
    //   meta: {
    //     ...observations.meta,
    //     lastUpdated: new Date().toISOString(),
    //   },
    // };

    // console.log('Updated observation without threshold components:', JSON.stringify(updatedObservation, null, 2));

    // await oystehr.fhir.update(updatedObservation);

    const updatedPayload = { ...currentDevice };
    delete (updatedPayload as any).patient;
    const result = await oystehr.fhir.update({
      id: requestBody.deviceId,
      ...updatedPayload,
    });

    // const deviceTimePeriod = {
    //   start: currentDevice.meta?.lastUpdated,
    //   end: new Date().toISOString(),
    // };

    // const deviceUseStatement = {
    //   status: 'completed' as any,
    //   subject: {
    //     type: 'Patient',
    //     reference: `Patient/${patientId}`,
    //   },
    //   device: {
    //     type: 'Device',
    //     reference: `Device/${requestBody.deviceId}`,
    //   },
    //   timingPeriod: {
    //     start: deviceTimePeriod.start,
    //     end: deviceTimePeriod.end,
    //   },
    //   recordedOn: new Date().toISOString(),
    // };

    // await oystehr.fhir.create({
    //   resourceType: 'DeviceUseStatement',
    //   ...deviceUseStatement,
    // });

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
