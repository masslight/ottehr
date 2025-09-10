import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Location, Patient, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DATETIME_FULL_NO_YEAR,
  getAddressStringForScheduleResource,
  getNameFromScheduleResource,
  getPatientContactEmail,
  getSecret,
  Secrets,
  SecretsKeys,
  TaskStatus,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getEmailClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { validateRequestParameters } from '../validateRequestParameters';

export interface TaskSubscriptionInput {
  task: Task;
  secrets: Secrets | null;
}

let oystehrToken: string;
const ZAMBDA_NAME = 'sub-cancellation-email';
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
    const startTime = DateTime.fromISO(fhirAppointment?.start || '').setZone(timezone);
    if (email) {
      console.group('sendCancellationEmail');
      try {
        const emailClient = getEmailClient(secrets);
        const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
        const readableTime = startTime.toFormat(DATETIME_FULL_NO_YEAR);

        const address = getAddressStringForScheduleResource(fhirLocation);
        if (!address) {
          throw new Error('Address is required to send reminder email');
        }
        const location = getNameFromScheduleResource(fhirLocation);
        if (!location) {
          throw new Error('Location is required to send reminder email');
        }

        const templateData = {
          time: readableTime,
          location,
          address,
          'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI(address || '')}`,
          'book-again-url': `${WEBSITE_URL}/home`,
        };
        await emailClient.sendInPersonCancelationEmail(email, templateData);
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
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('sub-cancellation-email', error, ENVIRONMENT);
  }
});
