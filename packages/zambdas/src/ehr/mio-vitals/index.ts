import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import moment from 'moment';
import { createOystehrClient, getAuth0Token, lambdaResponse, wrapHandler, ZambdaInput } from '../../shared';

// For local development it makes it easier to track performance
if (process.env.IS_OFFLINE === 'true') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('console-stamp')(console, { pattern: 'HH:MM:ss.l' });
}

let oystehrToken: string;
export const index = wrapHandler('mio-vitals', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    const secrets = input.secrets;
    let requestBody;
    console.group('validateRequestParameters');
    if (input.headers?.['access-key'] != 'mio-to-ottehr') {
      console.debug('Unauthorized Request');
      return lambdaResponse(401, {
        message: 'Unauthorized Request',
      });
    }
    try {
      requestBody = JSON.parse(input.body as string);
    } catch (error) {
      console.debug('Unauthorized Request');
      return lambdaResponse(500, {
        message: 'Invalid request',
      });
    }
    console.groupEnd();
    console.debug('validateRequestParameters success');

    const keys = Object.keys(requestBody);
    const isWS = keys.includes('wet') && keys.includes('lts');
    const isBP = keys.includes('dia') && keys.includes('sys') && keys.includes('pul');
    const isBG = keys.includes('data') && keys.includes('unit') && keys.includes('meal');
    const imei = requestBody.imei;
    if (imei && (isWS || isBP || isBG)) {
      console.log(imei);
      if (!oystehrToken) {
        console.log('getting token');
        oystehrToken = await getAuth0Token(secrets);
      } else {
        console.log('already have token');
      }

      const oystehr = createOystehrClient(oystehrToken, secrets);
      const fhirDevice = await fetchFHIRDevice(oystehr, imei);
      if (fhirDevice) {
        // Bind Device Type if not exists
        if (!['WS', 'BP', 'BG'].includes(String(fhirDevice.distinctIdentifier))) {
          await oystehr.fhir.update({
            id: fhirDevice.id,
            ...fhirDevice,
            distinctIdentifier: isWS ? 'WS' : isBP ? 'BP' : isBG ? 'BG' : '',
          });
        }

        const patient = fhirDevice?.patient?.reference || null;
        const patientBaseline = patient ? await fetchPatientBaseline(oystehr, patient) : null;
        let baseLineComponent = [];
        let componentNames: string[] = [];
        const upload_time = requestBody.upload_time || requestBody.uptime;
        const ts = requestBody.ts;
        const tz = requestBody.tz ?? 'UTC+0';
        if (isWS) {
          componentNames = ['weight-threshold', 'weight-variance'];
        }
        if (isBP) {
          componentNames = ['systolic-threshold', 'systolic-variance', 'diastolic-threshold', 'diastolic-variance'];
        }
        if (isBG) {
          componentNames = ['glucose-threshold', 'glucose-variance'];
        }
        if (patientBaseline?.component) {
          baseLineComponent = patientBaseline.component.filter((c: any) => componentNames.includes(c.code.text));
        }

        const offset = getOffsetFromTZ(tz);
        const tsUTC = moment.unix(ts).utcOffset(offset).utc().format('YYYY-MM-DDTHH:mm:ss.SSS[+00:00]');
        const uploadTimeUTC = moment
          .unix(upload_time)
          .utcOffset(offset)
          .utc()
          .format('YYYY-MM-DDTHH:mm:ss.SSS[+00:00]');

        const component: any[] = [];

        Object.entries(requestBody).forEach((element) => {
          component.push({
            code: {
              text: element[0],
            },
            valueString: String(element[1]),
          });
        });

        const payload = {
          resourceType: 'Observation',
          status: 'final',
          code: {
            text: 'Vital Details',
          },
          ...(patient && {
            subject: {
              type: 'Patient',
              reference: patient,
            },
          }),
          device: {
            type: 'Device',
            reference: `Device/${fhirDevice.id}`,
          },
          component: component.concat(baseLineComponent),
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs',
                },
              ],
            },
          ],
          effectiveDateTime: tsUTC,
          issued: uploadTimeUTC,
        };
        console.log('payload:', JSON.stringify(payload, null, 4));

        await oystehr.fhir.create<any>(payload);

        return lambdaResponse(200, {
          message: 'Ok',
        });
      } else {
        return lambdaResponse(400, {
          message: 'Device not exists',
        });
      }
    } else {
      return lambdaResponse(400, {
        message: 'Invalid request',
      });
    }
  } catch (error: any) {
    console.log('Error: ', JSON.stringify(error.message));
    return lambdaResponse(500, error.message);
  }
});

async function fetchFHIRDevice(oystehr: Oystehr, iccid: string): Promise<any> {
  const searchResults: any = await oystehr.fhir.search<any>({
    resourceType: 'Device',
    params: [{ name: 'identifier', value: iccid }],
  });
  const devices = searchResults.unbundle();
  return devices.length > 0 ? devices[0] : null;
}

async function fetchPatientBaseline(oystehr: Oystehr, patientId: string): Promise<any> {
  const searchResults: any = await oystehr.fhir.search<any>({
    resourceType: 'Observation',
    params: [
      { name: 'patient', value: patientId },
      { name: 'category', value: 'survey' },
    ],
  });
  const devices = searchResults.unbundle();
  return devices.length > 0 ? devices[0] : null;
}

function getOffsetFromTZ(tz: string): string {
  const match = tz.match(/UTC([+-]\d+)/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const offset = hours >= 0 ? `+${String(hours).padStart(2, '0')}:00` : `${String(hours).padStart(3, '0')}:00`;
    return offset;
  }
  return '+00:00';
}
