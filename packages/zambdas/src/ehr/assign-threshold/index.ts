import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

let oystehrToken: string;
export const index = wrapHandler('assign-threshold', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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

    const { deviceId, patientId, deviceType, thresholds } = requestBody;
    console.log('Request Body:', JSON.stringify(requestBody, null, 2));

    if (!deviceId || !patientId || !deviceType || !thresholds) {
      throw new Error('Missing required parameters: deviceId, patientId, deviceType, or thresholds');
    }

    const secrets = input.secrets;
    if (!oystehrToken) {
      oystehrToken = await getAuth0Token(secrets);
    }
    const oystehr = createOystehrClient(oystehrToken, secrets);

    const searchResult = await oystehr.fhir.search({
      resourceType: 'Device',
      params: [
        { name: '_id', value: deviceId },
        { name: 'patient', value: `Patient/${patientId}` },
      ],
    });

    const devices = searchResult.unbundle();
    if (devices.length === 0) {
      throw new Error(`No device found with ID ${deviceId} for patient ${patientId}`);
    }

    const device = devices[0] as any;

    const filteredProperties = (device.property || []).filter((property: any) => {
      return ![
        'weight-threshold',
        'glucose-threshold',
        'systolic-threshold',
        'diastolic-threshold',
        'threshold',
      ].includes(property.type?.text);
    });

    const updatedProperties = [...filteredProperties];

    switch (deviceType) {
      case 'scale_gen2_measure':
        if (thresholds.weight !== undefined) {
          updatedProperties.push({
            type: {
              text: 'weight-threshold',
            },
            valueCode: [
              {
                text: thresholds.weight.toString(),
              },
            ],
          });
        }
        break;

      case 'bgm_gen1_measure':
        if (thresholds.glucose !== undefined) {
          updatedProperties.push({
            type: {
              text: 'glucose-threshold',
            },
            valueCode: [
              {
                text: thresholds.glucose.toString(),
              },
            ],
          });
        }
        break;

      case 'bpm_gen2_measure':
        if (thresholds.systolic !== undefined) {
          updatedProperties.push({
            type: {
              text: 'systolic-threshold',
            },
            valueCode: [
              {
                text: thresholds.systolic.toString(),
              },
            ],
          });
        }
        if (thresholds.diastolic !== undefined) {
          updatedProperties.push({
            type: {
              text: 'diastolic-threshold',
            },
            valueCode: [
              {
                text: thresholds.diastolic.toString(),
              },
            ],
          });
        }
        break;

      default:
        if (thresholds.default !== undefined) {
          updatedProperties.push({
            type: {
              text: 'threshold',
            },
            valueCode: [
              {
                text: thresholds.default.toString(),
              },
            ],
          });
        }
        break;
    }

    const updatedDevice = {
      ...device,
      property: updatedProperties,
      meta: {
        ...device.meta,
        lastUpdated: new Date().toISOString(),
      },
    };

    console.log('Updated device with new threshold properties:', JSON.stringify(updatedDevice, null, 2));

    const result = await oystehr.fhir.update(updatedDevice);

    return lambdaResponse(200, {
      message: 'Threshold updated successfully in device properties',
      deviceId: result.id,
      deviceType,
      thresholds,
    });
  } catch (error: any) {
    console.error('Error:', error);
    return lambdaResponse(500, {
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});
