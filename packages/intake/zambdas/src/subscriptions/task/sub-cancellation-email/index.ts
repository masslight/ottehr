import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Location, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { DATETIME_FULL_NO_YEAR, TaskStatus, getPatientContactEmail } from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets, topLevelCatch } from 'zambda-utils';
import '../../../../instrument.mjs';
import { captureSentryException, configSentry, getAuth0Token, sendInPersonCancellationEmail } from '../../../shared';
import { createOystehrClient } from '../../../shared/helpers';
import { validateRequestParameters } from '../validateRequestParameters';

export interface TaskSubscriptionInput {
  task: Task;
  secrets: Secrets | null;
}

let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('sub-cancellation-email', input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { task, secrets } = validatedParameters;
    console.log('task ID', task.id);
    console.groupEnd();
    console.debug('validateRequestParameters success');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);

    let taskStatusToUpdate: TaskStatus;
    let statusReasonToUpdate: string | undefined;

    console.log('getting appointment Id from the task');
    const appointmentID =
      task.focus?.type === 'Appointment' ? task.focus?.reference?.replace('Appointment/', '') : undefined;
    console.log('appointment ID parsed: ', appointmentID);

    console.log('searching for appointment, location and patient resources related to this task');
    let fhirAppointment: Appointment | undefined, fhirLocation: Location | undefined, fhirPatient: Patient | undefined;
    const allResources = (
      await oystehr.fhir.search<Appointment | Location | Patient>({
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
    console.log(`number of reasources returned ${allResources.length}`);

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

    if (email) {
      console.group('sendCancellationEmail');
      try {
        await sendInPersonCancellationEmail({
          email,
          startTime,
          secrets,
          scheduleResource: fhirLocation,
          visitType,
          language: 'en',
        });
        taskStatusToUpdate = 'completed';
        statusReasonToUpdate = 'email sent successfully';
        console.groupEnd();
      } catch (error: any) {
        console.error('error sending email', error);
        console.groupEnd();
      }
    } else {
      taskStatusToUpdate = 'failed';
      statusReasonToUpdate = 'could not find email for patient';
      console.log('No email found. Skipping sending email.');
    }

    if (!taskStatusToUpdate) {
      console.log('no task was attempted');
      taskStatusToUpdate = 'failed';
      statusReasonToUpdate = 'no task was attempted';
    }

    // update task status and status reason
    console.log('making patch request to update task status');
    const patchedTask = await oystehr.fhir.patch({
      resourceType: 'Task',
      id: task.id || '',
      operations: [
        {
          op: 'replace',
          path: '/status',
          value: taskStatusToUpdate,
        },
        {
          op: 'add',
          path: '/statusReason',
          value: {
            coding: [
              {
                system: 'status-reason',
                code: statusReasonToUpdate || 'no reason given',
              },
            ],
          },
        },
      ],
    });

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
    return topLevelCatch('sub-cancellation-email', error, input.secrets, captureSentryException);
  }
});
