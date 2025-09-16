import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Location, Patient, QuestionnaireResponse, Schedule, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  DATETIME_FULL_NO_YEAR,
  getAddressStringForScheduleResource,
  getPatientContactEmail,
  getSecret,
  getTimezone,
  InPersonReminderTemplateData,
  isNonPaperworkQuestionnaireResponse,
  SecretsKeys,
} from 'utils';
import { getNameForOwner } from '../../ehr/schedules/shared';
import { createOystehrClient, getAuth0Token, sendErrors, topLevelCatch, wrapHandler, ZambdaInput } from '../../shared';
import {
  getEmailClient,
  getMessageRecipientForAppointment,
  makeAddressUrl,
  makeCancelVisitUrl,
  makeModifyVisitUrl,
  makePaperworkUrl,
} from '../../shared/communication';

let oystehrToken: string;

export const index = wrapHandler('send-message-cron', async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  console.log(`Input: ${JSON.stringify(input)}`);
  const { secrets } = input;
  if (!oystehrToken) {
    oystehrToken = await getAuth0Token(secrets);
  }
  try {
    const oystehr = createOystehrClient(oystehrToken, secrets);
    const nowUTC = DateTime.now().toUTC();
    const startTime = roundToNearestQuarterHour(nowUTC.plus({ hour: 1 })); // round times to an even quarter minute
    console.log(
      `Getting booked appointments between ${startTime.toISO()} and ${startTime
        .plus({ minute: 45 })
        .toISO()} and the related patients and location resources`
    );
    const allResources = (
      await oystehr.fhir.search<Appointment | Encounter | Location | Patient | QuestionnaireResponse | Slot | Schedule>(
        {
          resourceType: 'Appointment',
          params: [
            { name: 'status', value: 'booked' },
            { name: 'date', value: `ge${startTime.toISO()}` },
            { name: 'date', value: `lt${startTime.plus({ minute: 45 }).toISO()}` },
            { name: '_sort', value: 'date' },
            {
              name: '_include',
              value: 'Appointment:location',
            },
            {
              name: '_include',
              value: 'Appointment:patient',
            },
            {
              name: '_include',
              value: 'Appointment:slot',
            },
            {
              name: '_revinclude',
              value: 'Encounter:appointment',
            },
            {
              name: '_revinclude:iterate',
              value: 'QuestionnaireResponse:encounter',
            },
            {
              name: '_include:iterate',
              value: 'Slot:schedule',
            },
          ],
        }
      )
    )
      .unbundle()
      .filter((resource) => isNonPaperworkQuestionnaireResponse(resource) === false);
    console.log('successfully retrieved resources');

    const appointments = allResources.filter(
      (resourceTemp) => resourceTemp.resourceType === 'Appointment'
    ) as Appointment[];

    const next90MinuteAppointments = appointments.filter((appointment) => {
      return (
        appointment.start &&
        appointment.start >= (startTime.plus({ minute: 30 }).toISO() || '') &&
        appointment.start < (startTime.plus({ minute: 45 }).toISO() || '')
      );
    });
    if (next90MinuteAppointments.length === 0) console.log('no appointments to remind in the next 90 minutes');

    const nextHourAppointments = appointments.filter((appointment) => {
      return appointment.start && appointment.start < (startTime.plus({ minute: 15 }).toISO() || '');
    });
    if (nextHourAppointments.length === 0) console.log('no appointments to remind in the next hour');

    const nextHourAppointmentPromises = nextHourAppointments.map(async (appointment) => {
      const fhirAppointment = appointment as Appointment;
      const created = DateTime.fromISO(fhirAppointment.created || '');

      // only send reminders for appointments created more than 2 hours before start time
      if (startTime.diff(created, 'minutes').minutes > 120) {
        const locationID = fhirAppointment.participant
          .find((participantTemp) => participantTemp.actor?.reference?.startsWith('Location/'))
          ?.actor?.reference?.split('/')[1];
        const fhirLocation = allResources.find((resourceTemp) => resourceTemp.id === locationID) as Location;
        const timezone = fhirLocation.extension?.find(
          (extensionTemp) => extensionTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone'
        )?.valueString;
        const startTimeFormatted = DateTime.fromISO(fhirAppointment.start || '')
          ?.setZone(timezone)
          .toFormat(DATETIME_FULL_NO_YEAR);
        const message = `Your check-in time at ${fhirLocation.name} is ${startTimeFormatted}. See you soon!`;
        /*`${i18n.t('textComms.checkIn1')} ${fhirLocation.name} ${i18n.t(
          'textComms.checkIn2'
        )} ${startTimeFormatted}${i18n.t('textComms.checkIn3')}`;*/
        const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
        await sendAutomatedText(fhirAppointment, oystehr, ENVIRONMENT, message);
      }
    });

    const encounterResources = allResources.filter(
      (resourceTemp) => resourceTemp.resourceType === 'Encounter'
    ) as Encounter[];
    const questionnaireResponseResources = allResources.filter(
      (resourceTemp) => resourceTemp.resourceType === 'QuestionnaireResponse'
    ) as QuestionnaireResponse[];

    const next90MinuteAppointmentPromises = next90MinuteAppointments.map(async (appointment) => {
      const fhirAppointment = appointment as Appointment;
      const created = DateTime.fromISO(fhirAppointment.created || '');
      const encounter = encounterResources.find(
        (resource) => (resource as Encounter).appointment?.[0].reference === `Appointment/${fhirAppointment?.id}`
      ) as Encounter;
      const questionnaireResponse = questionnaireResponseResources.find(
        (resource) => (resource as QuestionnaireResponse).encounter?.reference === `Encounter/${encounter?.id}`
      ) as QuestionnaireResponse;

      console.log('paperwork status: ', questionnaireResponse.status);
      const isPaperworkComplete =
        questionnaireResponse.status == 'completed' || questionnaireResponse.status == 'amended';
      // only send reminders for appointments scheduled within the next 90 minutes whose paperwork is incomplete and for appointments created more than 2 hours before visit time
      // startTime is initialized to 1 hour from now, and adding 30 minutes approximately equals the visit time for appointments created 90 minutes from now
      if (startTime.plus({ minutes: 30 }).diff(created, 'minutes').minutes > 120 && !isPaperworkComplete) {
        console.log(
          'send reminder for appointment with incomplete paperwork scheduled within the next 90 minutes and created 2 hours before visit time'
        );
        const patientID = fhirAppointment.participant
          .find((participantTemp) => participantTemp.actor?.reference?.startsWith('Patient/'))
          ?.actor?.reference?.split('/')[1];
        const fhirPatient = allResources.find((resourceTemp) => resourceTemp.id === patientID) as Patient;
        const patientEmail = getPatientContactEmail(fhirPatient);

        const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
        const message = `To prevent delays, please complete your paperwork prior to arrival. For ${fhirPatient.name?.[0].given?.[0]}, click here: ${WEBSITE_URL}/paperwork/${fhirAppointment?.id}`;
        const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, secrets);
        await sendAutomatedText(fhirAppointment, oystehr, ENVIRONMENT, message);

        const location: Location | undefined = allResources.find((res) => res.resourceType === 'Location');
        const schedule: Schedule | undefined = allResources.find((res) => res.resourceType === 'Schedule');

        let address = '';
        let locationName = '';
        let prettyStartTime = '';

        if (schedule && fhirAppointment.start) {
          const tz = getTimezone(schedule);
          prettyStartTime = DateTime.fromISO(fhirAppointment.start).setZone(tz).toFormat(DATETIME_FULL_NO_YEAR);
        }

        if (location) {
          locationName = getNameForOwner(location);
          address = getAddressStringForScheduleResource(location) || '';
        }

        const missingData: string[] = [];
        if (!patientEmail) missingData.push('patient email');
        if (!fhirAppointment.id) missingData.push('appointment ID');
        if (!locationName) missingData.push('location name');
        if (!address) missingData.push('address');
        if (!prettyStartTime) missingData.push('appointment time');
        if (missingData.length === 0 && patientEmail && fhirAppointment.id) {
          const templateData: InPersonReminderTemplateData = {
            location: locationName,
            time: prettyStartTime,
            'address-url': makeAddressUrl(address),
            'modify-visit-url': makeModifyVisitUrl(fhirAppointment.id, secrets),
            'cancel-visit-url': makeCancelVisitUrl(fhirAppointment.id, secrets),
            'paperwork-url': makePaperworkUrl(fhirAppointment.id, secrets),
            address,
          };
          const emailClient = getEmailClient(secrets);
          await emailClient.sendInPersonReminderEmail(patientEmail, templateData);
        } else {
          console.log(`not sending email, missing data: ${missingData.join(', ')}`);
        }
      }
    });

    const appointmentPromises = [...nextHourAppointmentPromises, ...next90MinuteAppointmentPromises];

    await Promise.all(appointmentPromises);

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'hola' }),
    };
  } catch (error: any) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch('send-message-cron', error, ENVIRONMENT);
  }
});

function roundToNearestQuarterHour(date: DateTime): DateTime {
  const roundedDateTime = date.startOf('hour').plus({
    minutes: Math.round(date.minute / 15) * 15,
  });
  return roundedDateTime;
}

async function sendAutomatedText(
  fhirAppointment: Appointment,
  oystehr: Oystehr,
  ENVIRONMENT: string,
  message: string
): Promise<void> {
  try {
    console.log('getting conversationSID for appointment', fhirAppointment.id);
    const messageInput = await getMessageRecipientForAppointment(fhirAppointment, oystehr);
    if (messageInput) {
      const { resource } = messageInput;
      await oystehr.transactionalSMS.send({
        resource,
        message,
      });
    } else {
      console.log('no conversationSID returned for appointment:', fhirAppointment.id);
      void sendErrors('no conversationSID when sending automated text', ENVIRONMENT);
    }
  } catch (e) {
    console.log('error trying to send message: ', e, JSON.stringify(e));
  }
}
