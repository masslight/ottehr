import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { DateTime } from 'luxon';
import moment from 'moment';
import { AppointmentProviderNotificationTypes, getSecret, PROVIDER_NOTIFICATION_TYPE_SYSTEM, SecretsKeys } from 'utils';
import { fetchPatientSettingsById } from '../../services/patientSettings';
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
      // const PATIENT_VITAL_ERROR_TEMPLATE_EMAIL_TEMPLATE_ID = getSecret(
      //   SecretsKeys.PATIENT_VITAL_ERROR_TEMPLATE_EMAIL_TEMPLATE_ID,
      //   secrets
      // );
      // console.log('PATIENT_VITAL_ERROR_TEMPLATE_EMAIL_TEMPLATE_ID : ', PATIENT_VITAL_ERROR_TEMPLATE_EMAIL_TEMPLATE_ID);
      const oystehr = createOystehrClient(oystehrToken, secrets);

      const roles = (await oystehr.role.list()).filter((x: any) => ['Provider', 'Staff'].includes(x.name));
      let allUsersList: any[] = [];
      for (const role of roles) {
        const users = await fetchUsers(oystehrToken, PROJECT_ID, role.id);
        allUsersList = [...allUsersList, ...users.data];
      }
      allUsersList = getUniqueById(allUsersList);
      console.log('Allocated List : ', JSON.stringify(allUsersList, null, 2));

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

        let allocatedProviders: any[] = [];
        let allocatedStaff: any[] = [];

        console.log('Patient Id : ', patientId);
        if (patientId) {
          try {
            const patientSettings = await fetchPatientSettingsById(patientId.split('/')[1]);
            console.log('Patient settings api res :', JSON.stringify(patientSettings, null, 2));

            if (patientSettings?.settings) {
              const patientSpecificId = patientId.replace('Patient/', '');
              const patientEntries = patientSettings.settings.filter(
                (setting: any) => setting.patient_id === patientSpecificId && setting.is_notification_enabled
              );

              allocatedProviders = [...new Set(patientEntries.map((setting: any) => setting.provider_id))];
              allocatedStaff = [...new Set(patientEntries.map((setting: any) => setting.staff_id))];

              console.log('Allocated Providers:', allocatedProviders);
              console.log('Allocated Staff:', allocatedStaff);
            }
          } catch (error) {
            console.error('Error fetching patient settings:', error);
          }
        }

        let baseLineComponent = [];
        let componentNames: string[] = [];
        const upload_time = requestBody.upload_time || requestBody.uptime;
        const ts = requestBody.ts;
        const tz = requestBody.tz ?? 'UTC+0';
        if (isWS) {
          componentNames = ['weight-threshold', 'weight-variance', 'weight-critical-variance'];
        }
        if (isBP) {
          componentNames = [
            'systolic-threshold',
            'systolic-variance',
            'systolic-critical-variance',
            'diastolic-threshold',
            'diastolic-variance',
            'diastolic-critical-variance',
          ];
        }
        if (isBG) {
          componentNames = ['glucose-threshold', 'glucose-variance', 'glucose-critical-variance'];
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
        console.log('vital created :', JSON.stringify(vital, null, 2));

        const patientName = patient
          ? [patient.name?.[0]?.family, patient.name?.[0]?.given?.[0]].filter(Boolean).join(' ')
          : '';
        const deviceName = fhirDevice?.identifier?.[0]?.value ?? fhirDevice.id;
        let isWarning = false;
        let isCritical = false;
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
          const weightCriticalVariance = getCmpVal(payload, 'weight-critical-variance');
          let weight = getCmpVal(payload, 'wt');
          weight = weight ? weight * 0.00220462 : null;

          if (weightThreshold && weightVariance && weightCriticalVariance && weight) {
            const normalRange = getRange(weightThreshold, weightVariance);
            const criticalRange = getRange(weightThreshold, weightCriticalVariance);

            isWarning = normalRange.length == 2 ? !(weight >= normalRange[0] && weight <= normalRange[1]) : false;

            isCritical =
              criticalRange.length == 2 ? !(weight >= criticalRange[0] && weight <= criticalRange[1]) : false;

            if (isWarning) {
              templateInformation.weightDisplay = 'block';
              templateInformation.weightRange = `${normalRange[0]} – ${normalRange[1]}`;
              templateInformation.weight = weight.toFixed(2);
              const alertType = 'Warning';
              message = `${alertType}: A new weight measurement ${templateInformation.weight} lbs has been recorded for ${patientName}, which is outside the baseline range of ${templateInformation.weightRange} for the ${deviceName} device`;
            }

            if (isCritical) {
              templateInformation.weightDisplay = 'block';
              templateInformation.weightRange = `${criticalRange[0]} – ${criticalRange[1]}`;
              templateInformation.weight = weight.toFixed(2);
              const alertType = 'CRITICAL';
              message = `${alertType}: A new weight measurement ${templateInformation.weight} lbs has been recorded for ${patientName}, which is outside the baseline range of ${templateInformation.weightRange} for the ${deviceName} device`;
            }
          }
        }

        if (isBG) {
          const glucoseThreshold = getCmpVal(payload, 'glucose-threshold');
          const glucoseVariance = getCmpVal(payload, 'glucose-variance');
          const glucoseCriticalVariance = getCmpVal(payload, 'glucose-critical-variance');
          const glucose = getCmpVal(payload, 'data');

          if (glucoseThreshold && glucoseVariance && glucoseCriticalVariance && glucose) {
            const normalRange = getRange(glucoseThreshold, glucoseVariance);
            const criticalRange = getRange(glucoseThreshold, glucoseCriticalVariance);

            isWarning = normalRange.length == 2 ? !(glucose >= normalRange[0] && glucose <= normalRange[1]) : false;

            isCritical =
              criticalRange.length == 2 ? !(glucose >= criticalRange[0] && glucose <= criticalRange[1]) : false;

            if (isWarning) {
              templateInformation.glucoseDisplay = 'block';
              templateInformation.glucoseRange = `${normalRange[0]} – ${normalRange[1]}`;
              templateInformation.glucose = glucose;
              const alertType = 'Warning';
              message = `${alertType}: A new glucose measurement ${templateInformation.glucose} mg/dL has been recorded for ${patientName}, which is outside the baseline range of ${templateInformation.glucoseRange} for the ${deviceName} device`;
            }

            if (isCritical) {
              templateInformation.glucoseDisplay = 'block';
              templateInformation.glucoseRange = `${criticalRange[0]} – ${criticalRange[1]}`;
              templateInformation.glucose = glucose;
              const alertType = 'CRITICAL';
              message = `${alertType}: A new glucose measurement ${templateInformation.glucose} mg/dL has been recorded for ${patientName}, which is outside the baseline range of ${templateInformation.glucoseRange} for the ${deviceName} device`;
            }
          }
        }

        if (isBP) {
          const systolicThreshold = getCmpVal(payload, 'systolic-threshold');
          const systolicVariance = getCmpVal(payload, 'systolic-variance');
          const systolicCriticalVariance = getCmpVal(payload, 'systolic-critical-variance');
          const systolic = getCmpVal(payload, 'sys');

          const diastolicThreshold = getCmpVal(payload, 'diastolic-threshold');
          const diastolicVariance = getCmpVal(payload, 'diastolic-variance');
          const diastolicCriticalVariance = getCmpVal(payload, 'diastolic-critical-variance');
          const diastolic = getCmpVal(payload, 'dia');

          let systolicNormalRange: number[] = [];
          let systolicCriticalRange: number[] = [];
          let diastolicNormalRange: number[] = [];
          let diastolicCriticalRange: number[] = [];

          let systolicExceeding = false;
          let systolicCritical = false;
          let diastolicExceeding = false;
          let diastolicCritical = false;

          if (systolicThreshold && systolicVariance && systolicCriticalVariance && systolic) {
            systolicNormalRange = getRange(systolicThreshold, systolicVariance);
            systolicCriticalRange = getRange(systolicThreshold, systolicCriticalVariance);

            systolicExceeding =
              systolicNormalRange.length == 2
                ? !(systolic >= systolicNormalRange[0] && systolic <= systolicNormalRange[1])
                : false;
            systolicCritical =
              systolicCriticalRange.length == 2
                ? !(systolic >= systolicCriticalRange[0] && systolic <= systolicCriticalRange[1])
                : false;

            console.log('Systolic exceeding :', systolicExceeding);
            console.log('Systolic critical :', systolicCritical);

            if (systolicExceeding) {
              templateInformation.systolicDisplay = 'block';
              templateInformation.systolicRange = `${systolicNormalRange[0]} – ${systolicNormalRange[1]}`;
              templateInformation.systolic = systolic;
              isWarning = true;
            }

            if (systolicCritical) {
              templateInformation.systolicDisplay = 'block';
              templateInformation.systolicRange = `${systolicCriticalRange[0]} – ${systolicCriticalRange[1]}`;
              templateInformation.systolic = systolic;
              isCritical = true;
            }
          }

          if (diastolicThreshold && diastolicVariance && diastolicCriticalVariance && diastolic) {
            diastolicNormalRange = getRange(diastolicThreshold, diastolicVariance);
            diastolicCriticalRange = getRange(diastolicThreshold, diastolicCriticalVariance);

            diastolicExceeding =
              diastolicNormalRange.length == 2
                ? !(diastolic >= diastolicNormalRange[0] && diastolic <= diastolicNormalRange[1])
                : false;
            diastolicCritical =
              diastolicCriticalRange.length == 2
                ? !(diastolic >= diastolicCriticalRange[0] && diastolic <= diastolicCriticalRange[1])
                : false;

            console.log('Diastolic exceeding:', diastolicExceeding);
            console.log('Diastolic critical:', diastolicCritical);

            if (diastolicExceeding) {
              console.log('Inside diastolic exceeding');
              templateInformation.diastolicDisplay = 'block';
              templateInformation.diastolicRange = `${diastolicNormalRange[0]} – ${diastolicNormalRange[1]}`;
              templateInformation.diastolic = diastolic;
              isWarning = true;
            }

            if (diastolicCritical) {
              templateInformation.diastolicDisplay = 'block';
              templateInformation.diastolicRange = `${diastolicCriticalRange[0]} – ${diastolicCriticalRange[1]}`;
              templateInformation.diastolic = diastolic;
              isCritical = true;
            }
          }

          if (isWarning || isCritical) {
            const alertType = isCritical ? 'CRITICAL' : 'Warning';

            if (systolicCritical && diastolicCritical) {
              message = `${alertType}: A new ${templateInformation.systolic}/${templateInformation.diastolic} mmHg out of critical range (Critical: ${templateInformation.systolicRange}/${templateInformation.diastolicRange}) for the ${deviceName} device`;
            } else if (systolicCritical && diastolicExceeding) {
              message = `${alertType}: A new ${templateInformation.systolic}/${templateInformation.diastolic} mmHg out of range (Systolic Critical: ${templateInformation.systolicRange}, Diastolic Warning: ${templateInformation.diastolicRange}) for the ${deviceName} device`;
            } else if (systolicExceeding && diastolicCritical) {
              message = `${alertType}: A new ${templateInformation.systolic}/${templateInformation.diastolic} mmHg out of range (Systolic Warning: ${templateInformation.systolicRange}, Diastolic Critical: ${templateInformation.diastolicRange}) for the ${deviceName} device`;
            } else if (systolicExceeding && diastolicExceeding) {
              message = `${alertType}: A new ${templateInformation.systolic}/${templateInformation.diastolic} mmHg out of normal range (Normal: ${templateInformation.systolicRange}/${templateInformation.diastolicRange}) for the ${deviceName} device`;
            } else if (systolicCritical) {
              message = `${alertType}: A new systolic ${templateInformation.systolic} mmHg has been recorded for ${patientName}, which is outside the critical baseline range of ${templateInformation.systolicRange} for the ${deviceName} device`;
            } else if (diastolicCritical) {
              message = `${alertType}: A new diastolic ${templateInformation.diastolic} mmHg has been recorded for ${patientName}, which is outside the critical baseline range of ${templateInformation.diastolicRange} for the ${deviceName} device`;
            } else if (systolicExceeding) {
              message = `${alertType}: A new systolic ${templateInformation.systolic} mmHg has been recorded for ${patientName}, which is outside the baseline range of ${templateInformation.systolicRange} for the ${deviceName} device`;
            } else if (diastolicExceeding) {
              message = `${alertType}: A new diastolic ${templateInformation.diastolic} mmHg has been recorded for ${patientName}, which is outside the baseline range of ${templateInformation.diastolicRange} for the ${deviceName} device`;
            }
          }
        }

        const getFilteredUsers = (isCriticalAlert: boolean): any => {
          return allUsersList.filter((user) => {
            const userId = user.profile?.replace('Practitioner/', '');

            console.log('User Id : ', userId);
            if (!userId) return false;

            if (isCriticalAlert) {
              return allocatedProviders.includes(userId) || allocatedStaff.includes(userId);
            } else {
              return allocatedStaff.includes(userId);
            }
          });
        };

        // Send Warning notifications
        if (isWarning && message?.length > 0) {
          const communicationAPICalls: any[] = [];
          const emailCalls: any[] = [];
          let topicText = '';
          const alertType = 'Warning';

          if (isWS) topicText = `${alertType}: Weight Baseline Alert for ${patientName}`;
          if (isBG) topicText = `${alertType}: Glucose Baseline Alert for ${patientName}`;
          if (isBP) topicText = `${alertType}: Blood Pressure Baseline Alert for ${patientName}`;

          let thresholdData: any = {};

          if (isWS) {
            const weightThreshold = getCmpVal(payload, 'weight-threshold');
            const weightVariance = getCmpVal(payload, 'weight-variance');
            let weight = getCmpVal(payload, 'wt');
            weight = weight ? weight * 0.00220462 : null;

            if (weightThreshold && weightVariance && weight) {
              const normalRange = getRange(weightThreshold, weightVariance);

              thresholdData = {
                ...thresholdData,
                deviceType: 'WS',
                thresholds: {
                  weight: {
                    value: weight,
                    threshold: weightThreshold,
                    variance: weightVariance,
                    range: normalRange,
                  },
                },
              };
            }
          } else if (isBG) {
            const glucoseThreshold = getCmpVal(payload, 'glucose-threshold');
            const glucoseVariance = getCmpVal(payload, 'glucose-variance');
            const glucose = getCmpVal(payload, 'data');

            if (glucoseThreshold && glucoseVariance && glucose) {
              const normalRange = getRange(glucoseThreshold, glucoseVariance);

              thresholdData = {
                ...thresholdData,
                deviceType: 'BG',
                thresholds: {
                  glucose: {
                    value: glucose,
                    threshold: glucoseThreshold,
                    variance: glucoseVariance,
                    range: normalRange,
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
              ...thresholdData,
              deviceType: 'BP',
              thresholds: {},
            };

            if (systolicThreshold && systolicVariance && systolic) {
              const normalRange = getRange(systolicThreshold, systolicVariance);

              thresholdData.thresholds.systolic = {
                value: systolic,
                threshold: systolicThreshold,
                variance: systolicVariance,
                range: normalRange,
              };
            }

            if (diastolicThreshold && diastolicVariance && diastolic) {
              const normalRange = getRange(diastolicThreshold, diastolicVariance);

              thresholdData.thresholds.diastolic = {
                value: diastolic,
                threshold: diastolicThreshold,
                variance: diastolicVariance,
                range: normalRange,
              };
            }
          }

          const warningUsers = getFilteredUsers(false);
          console.log(`Sending warning notifications to ${warningUsers.length} staff members`);

          for (const user of warningUsers) {
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

          console.log('Warning emailCalls : ', emailCalls.length > 0 ? await Promise.allSettled(emailCalls) : []);
          console.log(
            'Warning communicationAPICalls : ',
            communicationAPICalls.length > 0 ? await Promise.allSettled(communicationAPICalls) : []
          );
        }

        // Send Critical notifications
        if (isCritical && message?.length > 0) {
          const communicationAPICalls: any[] = [];
          const emailCalls: any[] = [];
          let topicText = '';
          const alertType = 'CRITICAL';

          if (isWS) topicText = `${alertType}: Weight Baseline Alert for ${patientName}`;
          if (isBG) topicText = `${alertType}: Glucose Baseline Alert for ${patientName}`;
          if (isBP) topicText = `${alertType}: Blood Pressure Baseline Alert for ${patientName}`;

          let thresholdData: any = {};

          if (isWS) {
            const weightThreshold = getCmpVal(payload, 'weight-threshold');
            const weightCriticalVariance = getCmpVal(payload, 'weight-critical-variance');
            let weight = getCmpVal(payload, 'wt');
            weight = weight ? weight * 0.00220462 : null;

            if (weightThreshold && weightCriticalVariance && weight) {
              const criticalRange = getRange(weightThreshold, weightCriticalVariance);

              thresholdData = {
                ...thresholdData,
                deviceType: 'WS',
                thresholds: {
                  weight: {
                    value: weight,
                    threshold: weightThreshold,
                    variance: weightCriticalVariance,
                    range: criticalRange,
                  },
                },
              };
            }
          } else if (isBG) {
            const glucoseThreshold = getCmpVal(payload, 'glucose-threshold');
            const glucoseCriticalVariance = getCmpVal(payload, 'glucose-critical-variance');
            const glucose = getCmpVal(payload, 'data');

            if (glucoseThreshold && glucoseCriticalVariance && glucose) {
              const criticalRange = getRange(glucoseThreshold, glucoseCriticalVariance);

              thresholdData = {
                ...thresholdData,
                deviceType: 'BG',
                thresholds: {
                  glucose: {
                    value: glucose,
                    threshold: glucoseThreshold,
                    variance: glucoseCriticalVariance,
                    range: criticalRange,
                  },
                },
              };
            }
          } else if (isBP) {
            const systolicThreshold = getCmpVal(payload, 'systolic-threshold');
            const systolicCriticalVariance = getCmpVal(payload, 'systolic-critical-variance');
            const systolic = getCmpVal(payload, 'sys');
            const diastolicThreshold = getCmpVal(payload, 'diastolic-threshold');
            const diastolicCriticalVariance = getCmpVal(payload, 'diastolic-critical-variance');
            const diastolic = getCmpVal(payload, 'dia');

            thresholdData = {
              ...thresholdData,
              deviceType: 'BP',
              thresholds: {},
            };

            if (systolicThreshold && systolicCriticalVariance && systolic) {
              const criticalRange = getRange(systolicThreshold, systolicCriticalVariance);

              thresholdData.thresholds.systolic = {
                value: systolic,
                threshold: systolicThreshold,
                variance: systolicCriticalVariance,
                range: criticalRange,
              };
            }

            if (diastolicThreshold && diastolicCriticalVariance && diastolic) {
              const criticalRange = getRange(diastolicThreshold, diastolicCriticalVariance);
              thresholdData.thresholds.diastolic = {
                value: diastolic,
                threshold: diastolicThreshold,
                variance: diastolicCriticalVariance,
                range: criticalRange,
              };
            }
          }

          const criticalUsers = getFilteredUsers(true);
          console.log('Critical Users :', JSON.stringify(criticalUsers, null, 2));
          console.log(`Sending critical notifications to ${criticalUsers.length} users (providers and staff)`);

          for (const user of criticalUsers) {
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

          console.log('Critical emailCalls : ', emailCalls.length > 0 ? await Promise.allSettled(emailCalls) : []);
          console.log(
            'Critical communicationAPICalls : ',
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
