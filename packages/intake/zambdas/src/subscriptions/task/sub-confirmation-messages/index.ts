import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Location, Patient, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { DATETIME_FULL_NO_YEAR, TaskStatus, VisitType, getPatientContactEmail, getPatientFirstName } from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { topLevelCatch } from 'zambda-utils';
import '../../../../instrument.mjs';
import { captureSentryException, configSentry, getAuth0Token, sendInPersonMessages } from '../../../shared';
import { createOystehrClient } from '../../../shared/helpers';
import { patchTaskStatus } from '../../helpers';
import { validateRequestParameters } from '../validateRequestParameters';

let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('sub-confirmation-messages', input.secrets);
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

    const timezone = fhirLocation.extension?.find(
      (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
    )?.valueString;
    const visitType = fhirAppointment.appointmentType?.text ?? 'Unknown';

    console.log('sending confirmation messages for new appointment');
    const startTime = visitType === VisitType.WalkIn ? DateTime.now() : DateTime.fromISO(fhirAppointment.start ?? '');

    if (fhirAppointment.id && startTime.isValid) {
      try {
        await sendInPersonMessages(
          getPatientContactEmail(fhirPatient),
          getPatientFirstName(fhirPatient),
          `RelatedPerson/${fhirRelatedPerson?.id}`,
          startTime.setZone(timezone).toFormat(DATETIME_FULL_NO_YEAR),
          secrets,
          fhirLocation,
          fhirAppointment.id,
          visitType,
          'en', // todo: pass this in from somewhere
          zapehrToken
        );
        console.log('messages sent successfully');
        taskStatusToUpdate = 'completed';
        statusReasonToUpdate = 'messages sent successfully';
      } catch (err) {
        console.log('failed to send messages', err, JSON.stringify(err));
        taskStatusToUpdate = 'failed';
        statusReasonToUpdate = 'sending messages failed';
      }
    } else {
      console.log('invalid appointment ID or start time. skipping sending confirmation messages.');
      taskStatusToUpdate = 'failed';
      statusReasonToUpdate = 'sending messages failed';
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
    return topLevelCatch('sub-confirmation-messages', error, input.secrets, captureSentryException);
  }
});
