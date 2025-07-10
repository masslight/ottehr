import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Location, Patient, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  addWaitingMinutesToAppointment,
  DATETIME_FULL_NO_YEAR,
  getPatientContactEmail,
  getSecret,
  getWaitingMinutesAtSchedule,
  SecretsKeys,
  TaskStatus,
} from 'utils';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { patchTaskStatus } from '../../helpers';
import { validateRequestParameters } from '../validateRequestParameters';

let oystehrToken: string;
const ZAMBDA_NAME = 'sub-update-appointments';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { task, secrets } = validatedParameters;
    console.log('task ID', task.id);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!oystehrToken) {
      console.log('getting token');
      oystehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(oystehrToken, secrets);

    const taskCodingList = task.code?.coding ?? [];
    console.log('taskCodingList', JSON.stringify(taskCodingList));

    let taskStatusToUpdate: TaskStatus;
    let statusReasonToUpdate: string | undefined;

    console.log('getting appointment Id from the task');
    const appointmentID =
      task.focus?.type === 'Appointment' ? task.focus?.reference?.replace('Appointment/', '') : undefined;
    console.log('appointment ID parsed: ', appointmentID);

    console.log('searching for appointment, location and patient resources related to this task');
    let fhirAppointment: Appointment | undefined, fhirLocation: Location | undefined, fhirPatient: Patient | undefined;
    const allResources = (
      await oystehr.fhir.search<Appointment | Location | Patient | RelatedPerson>({
        resourceType: 'Appointment',
        params: [
          {
            name: '_id',
            value: appointmentID || '',
          },
          {
            name: '_include',
            value: 'Appointment:location',
          },
          {
            name: '_include',
            value: 'Appointment:patient',
          },
          {
            name: '_revinclude:iterate',
            value: 'RelatedPerson:patient',
          },
        ],
      })
    ).unbundle();
    console.log(`number of resources returned ${allResources.length}`);

    allResources.forEach((resource) => {
      if (resource.resourceType === 'Appointment') {
        fhirAppointment = resource as Appointment;
      }
      if (resource.resourceType === 'Location') {
        fhirLocation = resource as Location;
      }
      if (resource.resourceType === 'Patient') {
        fhirPatient = resource as Patient;
      }
    });

    const missingResources = [];
    if (!fhirAppointment) missingResources.push('appointment');
    if (!fhirLocation) missingResources.push('location');
    if (!fhirPatient) missingResources.push('patient');

    if (!fhirAppointment || !fhirLocation || !fhirPatient) {
      throw new Error(`missing the following vital resources: ${missingResources.join(',')}`);
    }

    console.log('formatting information included in email');
    const email = getPatientContactEmail(fhirPatient);
    const timezone = fhirLocation.extension?.find(
      (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
    )?.valueString;
    const startTime = DateTime.fromISO(fhirAppointment?.start || '')
      .setZone(timezone)
      .toFormat(DATETIME_FULL_NO_YEAR);
    const visitType = fhirAppointment.appointmentType?.text ?? 'Unknown';
    console.log('info', email, timezone, startTime, visitType);

    const nowForTimezone = DateTime.now().setZone(timezone);
    const waitingMinutes = await getWaitingMinutesAtSchedule(oystehr, nowForTimezone, fhirLocation);

    try {
      console.log('making patch request to record waiting time');
      await addWaitingMinutesToAppointment(fhirAppointment, waitingMinutes, oystehr);
      taskStatusToUpdate = 'completed';
      statusReasonToUpdate = `patch made to stamp waiting estimate: ${waitingMinutes.toString()}`;
    } catch (e) {
      console.log('appointment patch request failed');
      taskStatusToUpdate = 'failed';
      statusReasonToUpdate = `could not complete appointment patch to stamp waiting estimate: ${waitingMinutes.toString()}`;
    }

    if (!taskStatusToUpdate) {
      console.log('no task was attempted');
      taskStatusToUpdate = 'failed';
      statusReasonToUpdate = 'no task was attempted';
    }

    // update task status and status reason
    console.log('making patch request to update task status');
    const patchedTask = await patchTaskStatus({ task, taskStatusToUpdate, statusReasonToUpdate }, oystehr);

    console.log('successfully patched task');
    console.log(JSON.stringify(patchedTask));

    const response = {
      taskStatus: taskStatusToUpdate,
      statusReason: statusReasonToUpdate,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('sub-update-appointments', error, ENVIRONMENT);
  }
});
