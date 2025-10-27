import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DateTime } from 'luxon';
import moment from 'moment';
import { AppointmentProviderNotificationTypes, getSecret, PROVIDER_NOTIFICATION_TYPE_SYSTEM, SecretsKeys } from 'utils';
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
      console.log('Body : ', input.body);
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
      const PATIENT_VITAL_ERROR_TEMPLATE_EMAIL_TEMPLATE_ID = getSecret(
        SecretsKeys.PATIENT_VITAL_ERROR_TEMPLATE_EMAIL_TEMPLATE_ID,
        secrets
      );
      console.log('PATIENT_VITAL_ERROR_TEMPLATE_EMAIL_TEMPLATE_ID : ', PATIENT_VITAL_ERROR_TEMPLATE_EMAIL_TEMPLATE_ID);
      const oystehr = createOystehrClient(oystehrToken, secrets);
      const roles = (await oystehr.role.list()).filter((x: any) => ['Provider'].includes(x.name));
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

        const patientId = fhirDevice?.patient?.reference || null;
        const patient = patientId ? await fetchFHIRPatient(oystehr, patientId) : null;
        const patientBaseline = patientId ? await fetchPatientBaseline(oystehr, patientId) : null;
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
          ...(patientId && {
            subject: {
              type: 'Patient',
              reference: patientId,
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
        const vital = await oystehr.fhir.create<any>(payload);
        console.log('vital created : ', vital);

        const patientName = patient
          ? [patient.name?.[0]?.family, patient.name?.[0]?.given?.[0]].filter(Boolean).join(' ')
          : '';
        const deviceName = fhirDevice?.identifier?.[0]?.value ?? fhirDevice.id;
        let isExceeding = false;
        let message = '';
        const templateInformation = {
          patientName: patientName,
          imei: deviceName,
          deviceType: isWS ? 'Weight Scale' : isBP ? 'Blood Pressure Monitor' : isBG ? 'Blood Glucose Monitor' : '',
          systolicDisplay: 'none',
          systolicRange: '',
          systolic: '',
          diastolicDisplay: 'none',
          diastolicRange: '',
          diastolic: '',
          weightDisplay: 'none',
          weightRange: '',
          weight: '',
          glucoseDisplay: 'none',
          glucoseRange: '',
          glucose: '',
        };
        if (isWS) {
          const weightThreshold = getCmpVal(payload, 'weight-threshold');
          const weightVariance = getCmpVal(payload, 'weight-variance');
          let weight = getCmpVal(payload, 'wt');
          weight = weight ? weight * 0.00220462 : null;
          if (weightThreshold && weightVariance && weight) {
            const range = getRange(weightThreshold, weightVariance);
            isExceeding = range.length == 2 ? !(weight >= range[0] && weight <= range[1]) : false;
            if (isExceeding) {
              templateInformation.weightDisplay = 'block';
              templateInformation.weightRange = `${range[0]} – ${range[1]}`;
              templateInformation.weight = weight.toFixed(2);
              message = `A new weight measurement ${templateInformation.weight} lbs has been recorded for ${patientName}, which is outside the baseline range of ${templateInformation.weightRange} for the ${deviceName} device`;
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
              templateInformation.glucoseDisplay = 'block';
              templateInformation.glucoseRange = `${range[0]} – ${range[1]}`;
              templateInformation.glucose = glucose;
              message = `A new glucose measurement ${templateInformation.glucose} mg/dL has been recorded for ${patientName}, which is outside the baseline range of ${templateInformation.glucoseRange} for the ${deviceName} device`;
            }
          }
        }
        if (isBP) {
          const systolicThreshold = getCmpVal(payload, 'systolic-threshold');
          const systolicVariance = getCmpVal(payload, 'systolic-variance');
          const systolic = getCmpVal(payload, 'sys');
          let systolicRange = [];
          if (systolicThreshold && systolicVariance && systolic) {
            systolicRange = getRange(systolicThreshold, systolicVariance);
            isExceeding =
              systolicRange.length == 2 ? !(systolic >= systolicRange[0] && systolic <= systolicRange[1]) : false;
            if (isExceeding) {
              templateInformation.systolicDisplay = 'block';
              templateInformation.systolicRange = `${systolicRange[0]} – ${systolicRange[1]}`;
              templateInformation.systolic = systolic;
              message = `A new systolic ${templateInformation.systolic} mmHg has been recorded for ${patientName}, which is outside the baseline range of ${templateInformation.systolicRange} for the ${deviceName} device`;
            }
          }

          const diastolicThreshold = getCmpVal(payload, 'diastolic-threshold');
          const diastolicVariance = getCmpVal(payload, 'diastolic-variance');
          const diastolic = getCmpVal(payload, 'dia');
          if (diastolicThreshold && diastolicVariance && diastolic) {
            const diastolicRange = getRange(diastolicThreshold, diastolicVariance);
            isExceeding =
              diastolicRange.length == 2 ? !(diastolic >= diastolicRange[0] && diastolic <= diastolicRange[1]) : false;
            if (isExceeding) {
              templateInformation.diastolicDisplay = 'block';
              templateInformation.diastolicRange = `${diastolicRange[0]} – ${diastolicRange[1]}`;
              templateInformation.diastolic = diastolic;
              if (message.length > 0) {
                message = `A new ${templateInformation.systolic}/${templateInformation.diastolic} mmHg out of range (Normal: ${templateInformation.systolicRange}/${templateInformation.diastolicRange}) for the ${deviceName} device`;
              } else {
                message = `A new diastolic ${templateInformation.diastolic} mmHg has been recorded for ${patientName}, which is outside the baseline range of ${templateInformation.diastolicRange} for the ${deviceName} device`;
              }
            }
          }
        }

        if (isExceeding && message?.length > 0) {
          const communicationAPICalls: any[] = [];
          const emailCalls: any[] = [];
          let topicText = '';
          if (isWS) topicText = `Weight Baseline Alert for ${patientName}`;
          if (isBG) topicText = `Glucose Baseline Alert for ${patientName}`;
          if (isBP) topicText = `Blood Pressure Baseline Alert for ${patientName}`;

          let thresholdData: any = {};

          if (isWS) {
            const weightThreshold = getCmpVal(payload, 'weight-threshold');
            const weightVariance = getCmpVal(payload, 'weight-variance');
            const weight = getCmpVal(payload, 'wt');
            if (weightThreshold && weightVariance && weight) {
              const range = getRange(weightThreshold, weightVariance);
              thresholdData = {
                deviceType: 'WS',
                thresholds: {
                  weight: {
                    value: weight,
                    threshold: weightThreshold,
                    variance: weightVariance,
                    range: range,
                  },
                },
              };
            }
          } else if (isBG) {
            const glucoseThreshold = getCmpVal(payload, 'glucose-threshold');
            const glucoseVariance = getCmpVal(payload, 'glucose-variance');
            const glucose = getCmpVal(payload, 'data');
            if (glucoseThreshold && glucoseVariance && glucose) {
              const range = getRange(glucoseThreshold, glucoseVariance);
              thresholdData = {
                deviceType: 'BG',
                thresholds: {
                  glucose: {
                    value: glucose,
                    threshold: glucoseThreshold,
                    variance: glucoseVariance,
                    range: range,
                  },
                },
              };
            }
          } else if (isBP) {
            const systolicThreshold = getCmpVal(payload, 'systolic-threshold');
            const systolicVariance = getCmpVal(payload, 'systolic-variance');
            const systolic = getCmpVal(payload, 'sys');
            const diastolicThreshold = getCmpVal(payload, 'diastolic-threshold');
            const diastolicVariance = getCmpVal(payload, 'diastolic-variance');
            const diastolic = getCmpVal(payload, 'dia');

            thresholdData = {
              deviceType: 'BP',
              thresholds: {},
            };

            if (systolicThreshold && systolicVariance && systolic) {
              const range = getRange(systolicThreshold, systolicVariance);
              thresholdData.thresholds.systolic = {
                value: systolic,
                threshold: systolicThreshold,
                variance: systolicVariance,
                range: range,
              };
            }

            if (diastolicThreshold && diastolicVariance && diastolic) {
              const range = getRange(diastolicThreshold, diastolicVariance);
              thresholdData.thresholds.diastolic = {
                value: diastolic,
                threshold: diastolicThreshold,
                variance: diastolicVariance,
                range: range,
              };
            }
          }

          for (const user of usersList) {
            // if (user.email) {
            //   emailCalls.push(
            //     sendEmail(
            //       user.email,
            //       PATIENT_VITAL_ERROR_TEMPLATE_EMAIL_TEMPLATE_ID,
            //       topicText,
            //       templateInformation,
            //       secrets
            //     )
            //   );
            // }
            if (user.profile) {
              const payloadForCommunication = {
                resourceType: 'Communication',
                priority: 'asap',
                recipient: [
                  {
                    type: 'Practitioner',
                    reference: `${user.profile}`,
                  },
                ],
                status: 'completed',
                topic: {
                  text: topicText,
                },
                payload: [
                  {
                    contentString: message,
                  },
                ],
                meta: {
                  lastUpdated: uploadTimeUTC,
                },
                sender: {
                  type: 'Device',
                  reference: `Device/${fhirDevice.id}`,
                },
                category: [
                  {
                    coding: [
                      {
                        system: PROVIDER_NOTIFICATION_TYPE_SYSTEM,
                        code: AppointmentProviderNotificationTypes.device_vital_alert,
                        version: patientId.replace('Patient/', ''),
                      },
                    ],
                  },
                ],
                reasonCode: [
                  {
                    text: `${templateInformation.imei}`,
                    coding: [
                      {
                        system: 'threshold-data',
                        code: JSON.stringify(thresholdData),
                        display: 'Device Threshold Information',
                        version: 'new latest',
                      },
                    ],
                  },
                ],
                sent: DateTime.utc().toISO()!,
              };
              communicationAPICalls.push(oystehr.fhir.create<any>(payloadForCommunication));
            }
          }

          console.log('emailCalls : ', emailCalls.length > 0 ? await Promise.allSettled(emailCalls) : []);
          console.log(
            'communicationAPICalls : ',
            communicationAPICalls.length > 0 ? await Promise.allSettled(communicationAPICalls) : []
          );
        }

        return lambdaResponse(200, {
          message: 'ok',
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

async function fetchFHIRPatient(oystehr: Oystehr, patientId: string): Promise<any> {
  const searchResults: any = await oystehr.fhir.search<any>({
    resourceType: 'Patient',
    params: [{ name: '_id', value: patientId.replace('Patient/', '') }],
  });
  const patients = searchResults.unbundle();
  return patients.length > 0 ? patients[0] : null;
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
