import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, HealthcareService, Location, Patient, Practitioner, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  getPatientContactEmail,
  getPatientFirstName,
  getSecret,
  OTTEHR_MODULE,
  SecretsKeys,
  TaskStatus,
  TelemedConfirmationTemplateData,
  VisitType,
} from 'utils';
import { getNameForOwner } from '../../../ehr/schedules/shared';
import {
  createOystehrClient,
  getAuth0Token,
  getEmailClient,
  makeCancelVisitUrl,
  makeJoinVisitUrl,
  makePaperworkUrl,
  sendInPersonMessages,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../../shared';
import { patchTaskStatus } from '../../helpers';
import { validateRequestParameters } from '../validateRequestParameters';

let oystehrToken: string;
const ZAMBDA_NAME = 'sub-confirmation-messages';

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
    let fhirAppointment: Appointment | undefined,
      fhirSchedule: Location | HealthcareService | Practitioner | undefined,
      fhirPatient: Patient | undefined,
      fhirRelatedPerson: RelatedPerson | undefined;
    const allResources = (
      await oystehr.fhir.search<Appointment | Location | HealthcareService | Practitioner | Patient | RelatedPerson>({
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
            value: 'Appointment:actor:HealthcareService',
          },
          {
            name: '_include',
            value: 'Appointment:actor:Practitioner',
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
        fhirSchedule = resource as Location;
      }
      if (resource.resourceType === 'HealthcareService') {
        fhirSchedule = resource as HealthcareService;
      }
      if (resource.resourceType === 'Practitioner') {
        fhirSchedule = resource as Practitioner;
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
    if (!fhirSchedule) missingResources.push('location, healthcare service, or practitioner');
    if (!fhirPatient) missingResources.push('patient');

    if (!fhirAppointment || !fhirSchedule || !fhirPatient) {
      throw new Error(`missing the following vital resources: ${missingResources.join(';')}`);
    }

    const timezone = fhirSchedule.extension?.find(
      (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
    )?.valueString;
    const visitType = fhirAppointment.appointmentType?.text ?? 'Unknown';

    console.log('sending confirmation messages for new appointment');
    const startTime = visitType === VisitType.WalkIn ? DateTime.now() : DateTime.fromISO(fhirAppointment.start ?? '');

    sendMessages: if (fhirAppointment.id && startTime.isValid) {
      const isTelemed = Boolean(fhirAppointment.meta?.tag?.find((tag) => tag.code === OTTEHR_MODULE.TM));
      const patientEmail = getPatientContactEmail(fhirPatient);
      if (!patientEmail) {
        // todo: slack notification or sentry error for this?
        console.log('no patient email found, cannot send messages');
        break sendMessages;
      }
      try {
        if (isTelemed) {
          const emailClient = getEmailClient(secrets);
          const ownerName = getNameForOwner(fhirSchedule);
          const templateData: TelemedConfirmationTemplateData = {
            location: ownerName,
            'cancel-visit-url': makeCancelVisitUrl(fhirAppointment.id, secrets),
            'paperwork-url': makePaperworkUrl(fhirAppointment.id, secrets),
            'join-visit-url': makeJoinVisitUrl(fhirAppointment.id, secrets),
          };
          await emailClient.sendVirtualConfirmationEmail(patientEmail, templateData);
          console.log('telemed confirmation email sent');
          taskStatusToUpdate = 'completed';
          statusReasonToUpdate = 'telemed confirmation email sent';
        } else {
          await sendInPersonMessages({
            email: patientEmail,
            firstName: getPatientFirstName(fhirPatient),
            messageRecipient: `RelatedPerson/${fhirRelatedPerson?.id}`,
            startTime: startTime.setZone(timezone),
            secrets,
            scheduleResource: fhirSchedule,
            appointmentID: fhirAppointment.id,
            appointmentType: fhirAppointment.appointmentType?.text || '',
            language: 'en', // todo: pass this in from somewhere
            token: oystehrToken,
          });
        }
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
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('sub-confirmation-messages', error, ENVIRONMENT);
  }
});
