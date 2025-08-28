import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

// For local development it makes it easier to track performance
if (process.env.IS_OFFLINE === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('console-stamp')(console, { pattern: 'HH:MM:ss.l' });
}

interface MioDevice {
  deviceId: string;
  lastActive: number;
  imei: string;
  status: string;
  createdAt: string;
  iccid: string;
  modelNumber: string;
  firmwareVersion: string;
}

interface FetchMioDevicesResponse {
  items: MioDevice[];
  nextToken: string | null;
  count: number;
}

interface MioDeviceType {
  modelNumber: string;
  manufacturer: string;
  serialNumber: string;
  status: string;
  createdAt: string;
  activatedAt: string;
  lastActiveAt: string;
  connectionStatus: string;
  modemVersion: string;
  hardwareVersion: string;
  firmwareVersion: string;
  userEmail: string;
  imei: string;
  iccid: string;
  battery: string;
}

let oystehrToken: string;
export const index = wrapHandler('get-mio-devices', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    console.log(input);
    const secrets = input.secrets;
    const MIO_API_KEY = secrets?.MIO_API_KEY;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!MIO_API_KEY) {
      throw new Error('Mio configuration is not setup');
    }

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);

    let nextToken: string | null = null;
    do {
      const awa = await fetchMioDevices(MIO_API_KEY, nextToken);
      nextToken = awa.nextToken;
      for (const item of awa.items) {
        const isDeviceAlreadyCreatedInFHIR = await isDeviceExists(oystehr, item.imei);
        console.log(`Checking for ${item.imei} : `, isDeviceAlreadyCreatedInFHIR);
        if (!isDeviceAlreadyCreatedInFHIR) {
          try {
            const mioDeviceInfo = await fetchMioDeviceById(MIO_API_KEY, item.deviceId);
            console.log('successfully fetch : ' + JSON.stringify(mioDeviceInfo));
            const fhirDevice = await createFHIRDevice(oystehr, mioDeviceInfo);
            console.log(fhirDevice);
          } catch (error) {
            console.error(error);
          }
        }
      }
    } while (nextToken);

    return lambdaResponse(200, {});
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return lambdaResponse(500, error.message);
  }
});

async function fetchMioDevices(apiKey: string, nextToken: string | null = null): Promise<FetchMioDevicesResponse> {
  const mioRes = await fetch(
    `https://api.connect.mio-labs.com/v1/devices?limit=10${nextToken ? `&nextToken=${nextToken}` : ''}`,
    {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
      },
    }
  );

  if (!mioRes.ok) {
    throw new Error(`Failed to fetch devices: ${mioRes.statusText}`);
  }

  const data: FetchMioDevicesResponse = await mioRes.json();
  return data;
}

async function fetchMioDeviceById(apiKey: string, deviceId: string | null = null): Promise<MioDeviceType> {
  const mioRes = await fetch(`https://api.connect.mio-labs.com/v1/devices/${deviceId}`, {
    method: 'GET',
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!mioRes.ok) {
    throw new Error(`Failed to fetch devices: ${mioRes.statusText}`);
  }

  const data: MioDeviceType = await mioRes.json();
  return data;
}

async function isDeviceExists(oystehr: Oystehr, iccid: string): Promise<boolean> {
  const searchResults: any = await oystehr.fhir.search<any>({
    resourceType: 'Device',
    params: [{ name: 'identifier', value: iccid }],
  });
  return searchResults.total > 0;
}

async function createFHIRDevice(oystehr: Oystehr, deviceInfo: MioDeviceType): Promise<any> {
  let distinctIdentifier = '';

  if (['TMB-2092-G', 'LS802-GP'].includes(deviceInfo.modelNumber)) distinctIdentifier = 'BP';
  if (['BS-2001-G1', 'GBS-2104-G'].includes(deviceInfo.modelNumber)) distinctIdentifier = 'WS';
  if (['TMB-2282-G'].includes(deviceInfo.modelNumber)) distinctIdentifier = 'BG';

  return await oystehr.fhir.create<any>({
    resourceType: 'Device',
    identifier: [
      {
        value: deviceInfo.imei,
        use: 'official',
      },
    ],
    status: 'active',
    manufacturer: deviceInfo.manufacturer || '',
    serialNumber: deviceInfo.serialNumber,
    modelNumber: deviceInfo.modelNumber,
    version: [
      {
        type: {
          text: 'hardwareVersion',
        },
        value: deviceInfo.hardwareVersion || '',
      },
      {
        type: {
          text: 'modemVersion',
        },
        value: deviceInfo.modemVersion || '',
      },
      {
        type: {
          text: 'firmwareVersion',
        },
        value: deviceInfo.firmwareVersion || '',
      },
    ],
    distinctIdentifier: distinctIdentifier,
  });
}
