import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Location, Patient, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DATETIME_FULL_NO_YEAR,
  getPatientContactEmail,
  getSecret,
  PROJECT_WEBSITE,
  SecretsKeys,
  TaskStatus,
} from 'utils';
import { createOystehrClient, getAuth0Token, topLevelCatch, wrapHandler, ZambdaInput } from '../../../shared';
import { patchTaskStatus } from '../../helpers';
import { sendText } from '../helpers';
import { validateRequestParameters } from '../validateRequestParameters';

let oystehrToken: string;

export const index = wrapHandler('sub-ready-text', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
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
    let fhirAppointment: Appointment | undefined,
      fhirLocation: Location | undefined,
      fhirPatient: Patient | undefined,
      fhirRelatedPerson: RelatedPerson | undefined;
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
      if (resource.resourceType === 'RelatedPerson') {
        const relatedPerson = resource as RelatedPerson;
        const isUserRelatedPerson = relatedPerson.relationship?.find(
          (relationship) => relationship.coding?.find((code) => code.code === 'user-relatedperson')
        );
        if (isUserRelatedPerson) {
          fhirRelatedPerson = relatedPerson;
        }
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

    if (fhirRelatedPerson) {
      const message = `Please set up access to your patient portal so you can view test results and discharge information: ${PROJECT_WEBSITE}/patient-portal`;
      const { taskStatus, statusReason } = await sendText(message, fhirRelatedPerson, oystehrToken, secrets);
      taskStatusToUpdate = taskStatus;
      statusReasonToUpdate = statusReason;
    } else {
      taskStatusToUpdate = 'failed';
      statusReasonToUpdate = 'could not retrieve related person to get sms number';
      console.log('No related person found. Skipping sending text');
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
    return topLevelCatch('sub-ready-text', error, ENVIRONMENT);
  }
});
