import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, HealthcareService, Location, Patient, Practitioner, RelatedPerson } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  BRANDING_CONFIG,
  DATETIME_FULL_NO_YEAR,
  getAddressStringForScheduleResource,
  getNameFromScheduleResource,
  getPatientContactEmail,
  getPatientFirstName,
  getSecret,
  InPersonConfirmationTemplateData,
  isTelemedAppointment,
  SecretsKeys,
  TaskStatus,
  TelemedConfirmationTemplateData,
  VisitType,
} from 'utils';
import {
  createOystehrClient,
  getAuth0Token,
  getEmailClient,
  makeCancelVisitUrl,
  makeJoinVisitUrl,
  makePaperworkUrl,
  makeVisitLandingUrl,
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
    const startTime = (
      visitType === VisitType.WalkIn ? DateTime.now() : DateTime.fromISO(fhirAppointment.start ?? '')
    ).setZone(timezone);
    const readableTime = startTime.toFormat(DATETIME_FULL_NO_YEAR);

    let emailOutcome: 'success' | 'failed' | 'skipped' = 'skipped';
    let smsOutcome: 'success' | 'failed' | 'skipped' = 'skipped';

    if (fhirAppointment.id && startTime.isValid) {
      const isTelemed = isTelemedAppointment(fhirAppointment);
      const patientEmail = getPatientContactEmail(fhirPatient);
      const firstName = getPatientFirstName(fhirPatient);
      let ownerName = getNameFromScheduleResource(fhirSchedule);
      try {
        if (isTelemed) {
          if (patientEmail) {
            try {
              const emailClient = getEmailClient(secrets);
              if (!ownerName) {
                if (emailClient.getFeatureFlag()) {
                  throw new Error('Location is required to send reminder email');
                } else {
                  ownerName = 'Test Location'; // placeholder location for local dev when email sending is disabled
                }
              }
              const templateData: TelemedConfirmationTemplateData = {
                location: ownerName,
                'cancel-visit-url': makeCancelVisitUrl(fhirAppointment.id, secrets),
                'paperwork-url': makePaperworkUrl(fhirAppointment.id, secrets),
                'join-visit-url': makeJoinVisitUrl(fhirAppointment.id, secrets),
              };
              await emailClient.sendVirtualConfirmationEmail(patientEmail, templateData);
              console.log('telemed confirmation email sent');
              emailOutcome = 'success';
            } catch (e) {
              console.log('telemed confirmation email send error: ', JSON.stringify(e));
              emailOutcome = 'failed';
            }
          }
          try {
            if (!ownerName) {
              throw new Error('Location with name is required to send confirmation message');
            }
            const url = makeVisitLandingUrl(fhirAppointment.id, secrets);
            const prep = fhirSchedule.resourceType === 'Location' ? 'at' : 'with';
            const message = `You're confirmed! Thanks for choosing ${BRANDING_CONFIG.projectName}! Your check-in time for ${firstName} ${prep} ${ownerName} is ${readableTime}. Use this URL ${url} to: 1. Complete your pre-visit paperwork 2. Once you've completed the paperwork, you may join the session.`;
            const messageRecipient = `RelatedPerson/${fhirRelatedPerson?.id}`;
            const commId = await oystehr.transactionalSMS.send({
              message,
              resource: messageRecipient,
            });
            console.log('message send successful', commId);
            smsOutcome = 'success';
          } catch (e) {
            console.log('message send error: ', JSON.stringify(e));
            smsOutcome = 'failed';
          }
        } else {
          if (patientEmail) {
            try {
              console.log('in person confirmation email sent');
              emailOutcome = 'success';
              const emailClient = getEmailClient(secrets);
              const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
              // todo handle these when scheduleResource is a healthcare service or a practitioner
              let address = getAddressStringForScheduleResource(fhirSchedule);
              if (!address) {
                if (emailClient.getFeatureFlag()) {
                  throw new Error('Address is required to send reminder email');
                } else {
                  address = '123 Main St, Anytown, USA'; // placeholder address for local dev when email sending is disabled
                }
              }
              if (!ownerName) {
                if (emailClient.getFeatureFlag()) {
                  throw new Error('Location is required to send reminder email');
                } else {
                  ownerName = 'Test Location'; // placeholder location for local dev when email sending is disabled
                }
              }

              const rescheduleUrl = `${WEBSITE_URL}/visit/${appointmentID}/reschedule`;
              const templateData: InPersonConfirmationTemplateData = {
                time: readableTime,
                location: ownerName,
                address,
                'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI(address || '')}`,
                'modify-visit-url': rescheduleUrl,
                'cancel-visit-url': `${WEBSITE_URL}/visit/${appointmentID}/cancel`,
                'paperwork-url': `${WEBSITE_URL}/paperwork/${appointmentID}`,
              };
              await emailClient.sendInPersonConfirmationEmail(patientEmail, templateData);
            } catch (e) {
              console.log('in person confirmation email send error: ', JSON.stringify(e));
              emailOutcome = 'failed';
            }
          }

          try {
            const appointmentType = fhirAppointment.appointmentType?.text || '';
            const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
            const firstName = getPatientFirstName(fhirPatient);
            const prep = fhirSchedule.resourceType === 'Location' ? 'at' : 'with';
            const messageAll = `Thanks for choosing ${BRANDING_CONFIG.projectName}! Your check-in time for ${firstName} ${prep} ${ownerName} is ${readableTime}. Please save time at check-in by completing your pre-visit paperwork`;
            const message =
              appointmentType === 'walkin' || appointmentType === 'posttelemed'
                ? `${messageAll}: ${WEBSITE_URL}/paperwork/${appointmentID}`
                : `You're confirmed! ${messageAll}, or modify/cancel your visit: ${WEBSITE_URL}/visit/${appointmentID}`;

            const messageRecipient = `RelatedPerson/${fhirRelatedPerson?.id}`;
            const commId = await oystehr.transactionalSMS.send({
              message,
              resource: messageRecipient,
            });
            console.log('message send successful', commId);
            smsOutcome = 'success';
          } catch (e) {
            console.log('message send error: ', JSON.stringify(e));
            smsOutcome = 'failed';
          }
        }
        if (emailOutcome === 'failed' || smsOutcome === 'failed') {
          taskStatusToUpdate = 'failed';
        } else {
          taskStatusToUpdate = 'completed';
        }
      } catch (err) {
        console.log('failed to send messages', err, JSON.stringify(err));
        taskStatusToUpdate = 'failed';
      } finally {
        statusReasonToUpdate = `send email status: ${emailOutcome}; send sms status: ${smsOutcome}`;
      }
    } else {
      console.log('invalid appointment ID or start time. skipping sending confirmation messages.');
      taskStatusToUpdate = 'failed';
      statusReasonToUpdate = 'Appointment Id or start time missing/invalid';
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
