import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import moment from 'moment';
import { getSecret, SecretsKeys } from 'utils';
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
    try {
      requestBody = JSON.parse(input.body as string);
    } catch (error) {
      console.error(error);
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
      const PROJECT_ID = getSecret(SecretsKeys.PROJECT_ID, secrets);
      // const SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID = getSecret(
      //   SecretsKeys.VIRTUAL_SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID,
      //   secrets
      // );
      const oystehr = createOystehrClient(oystehrToken, secrets);
      const roles = (await oystehr.role.list()).filter((x: any) => ['Administrator', 'Staff'].includes(x.name));
      let usersList: any[] = [];
      for (const role of roles) {
        const users = await fetchUsers(oystehrToken, PROJECT_ID, role.id);
        usersList = [...usersList, ...users.data];
      }
      usersList = getUniqueById(usersList);

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
        await oystehr.fhir.create<any>(payload);

        let isExceeding = false;
        let message = '';
        if (isWS) {
          const weightThreshold = getCmpVal(payload, 'weight-threshold');
          const weightVariance = getCmpVal(payload, 'weight-variance');
          let weight = getCmpVal(payload, 'wt');
          weight = weight ? weight * 0.00220462 : null;
          if (weightThreshold && weightVariance && weight) {
            const range = getRange(weightThreshold, weightVariance);
            isExceeding = range.length == 2 ? !(weight >= range[0] && weight <= range[1]) : false;
            if (isExceeding) {
              message = 'ok';
            }
          }
        }
        if (isBG) {
          const glucoseThreshold = getCmpVal(payload, 'glucose-threshold');
          const glucoseVariance = getCmpVal(payload, 'glucose-variance');
          const glucose = getCmpVal(payload, 'data');
          if (glucoseThreshold && glucoseVariance && glucose) {
            const range = getRange(glucoseThreshold, glucoseVariance);
            isExceeding = range.length == 2 ? !(glucose >= range[0] && glucose <= range[1]) : false;
            if (isExceeding) {
              message = 'ok';
            }
          }
        }
        if (isBP) {
          const systolicThreshold = getCmpVal(payload, 'systolic-threshold');
          const systolicVariance = getCmpVal(payload, 'systolic-variance');
          const systolic = getCmpVal(payload, 'sys');
          if (systolicThreshold && systolicVariance && systolic) {
            const range = getRange(systolicThreshold, systolicVariance);
            isExceeding = range.length == 2 ? !(systolic >= range[0] && systolic <= range[1]) : false;
            if (isExceeding) {
              message = 'ok';
            }
          }

          if (isExceeding == false) {
            const diastolicThreshold = getCmpVal(payload, 'diastolic-threshold');
            const diastolicVariance = getCmpVal(payload, 'diastolic-variance');
            const diastolic = getCmpVal(payload, 'dia');
            if (diastolicThreshold && diastolicVariance && diastolic) {
              const range = getRange(diastolicThreshold, diastolicVariance);
              isExceeding = range.length == 2 ? !(diastolic >= range[0] && diastolic <= range[1]) : false;
              if (isExceeding) {
                message = 'ok';
              }
            }
          }
        }

        if (isExceeding && message?.length > 0) {
          for (const user of usersList) {
            // if (user.email) {
            //   const subject = `${PROJECT_NAME} Telemedicine`;
            //   const templateId = SENDGRID_CONFIRMATION_EMAIL_TEMPLATE_ID;
            //   const templateInformation = {};
            //   await sendEmail(user.email, templateId, subject, templateInformation, secrets);
            // }
            if (user.profile) {
              console.log(user.profile, message);
            }
          }
        }

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
    console.error(error);
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

async function fetchUsers(token: string, projectId: string, roleId: string): Promise<any> {
  const mioRes = await fetch(`https://project-api.zapehr.com/v1/user/v2/list?roleId=${roleId}&limit=1000`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${token}`,
      'x-oystehr-project-id': projectId,
    },
  });

  if (!mioRes.ok) {
    throw new Error(`Failed to fetch users by role: ${mioRes.statusText}`);
  }

  const data: any = await mioRes.json();
  return data;
}

function getUniqueById(array: any): any {
  const seen = new Set();
  return array.filter((item: any) => {
    if (seen.has(item.profile)) {
      return false;
    }
    seen.add(item.profile);
    return true;
  });
}

const getCmpVal = (row: any, field: string): any => {
  return row?.component?.find((x: any) => x.code.text == field)?.valueString ?? null;
};

const getRange = (baselineStr: string, varianceStr: string): any[] => {
  const baseline = parseFloat(baselineStr);
  const variance = parseFloat(varianceStr);
  if (isNaN(baseline) || isNaN(variance)) return [];

  const delta = (baseline * variance) / 100;
  const min = baseline - delta;
  const max = baseline + delta;
  return [min, max];
};
