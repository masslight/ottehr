import Oystehr from '@oystehr/sdk';
import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Location, Patient, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { DATETIME_FULL_NO_YEAR } from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets, SecretsKeys, getSecret, topLevelCatch } from 'zambda-utils';
import '../../instrument.mjs';
import { captureSentryException, configSentry, getAuth0Token } from '../shared';
import { getMessageRecipientForAppointment } from '../shared/communication';
import { createOystehrClient } from '../shared/helpers';

let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('send-message-cron', input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  const { secrets } = input;
  if (!zapehrToken) {
    zapehrToken = await getAuth0Token(secrets);
  }
  try {
    const oystehr = createOystehrClient(zapehrToken, secrets);
    const nowUTC = DateTime.now().toUTC();
    const startTime = roundToNearestQuarterHour(nowUTC.plus({ hour: 1 })); // round times to an even quarter minute
    console.log(
      `Getting booked appointments between ${startTime.toISO()} and ${startTime
        .plus({ minute: 45 })
        .toISO()} and the related patients and location resources`
    );
    const allResources = (
      await oystehr.fhir.search<Appointment | Encounter | Location | Patient | QuestionnaireResponse>({
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
            name: '_revinclude',
            value: 'Encounter:appointment',
          },
          {
            name: '_revinclude:iterate',
            value: 'QuestionnaireResponse:encounter',
          },
        ],
      })
    ).unbundle();
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
        await sendAutomatedText(fhirAppointment, oystehr, secrets, message);
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
      // startTime is initalized to 1 hour from now, and adding 30 minutes approximately equals the visit time for appointments created 90 minutes from now
      if (startTime.plus({ minutes: 30 }).diff(created, 'minutes').minutes > 120 && !isPaperworkComplete) {
        console.log(
          'send reminder for appointment with incomplete paperwork scheduled within the next 90 minutes and created 2 hours before visit time'
        );
        const patientID = fhirAppointment.participant
          .find((participantTemp) => participantTemp.actor?.reference?.startsWith('Patient/'))
          ?.actor?.reference?.split('/')[1];
        const fhirPatient = allResources.find((resourceTemp) => resourceTemp.id === patientID) as Patient;
        const WEBSITE_URL = getSecret(SecretsKeys.WEBSITE_URL, secrets);
        const message = `To prevent delays, please complete your paperwork prior to arrival. For ${fhirPatient.name?.[0].given?.[0]}, click here: ${WEBSITE_URL}/paperwork/${fhirAppointment?.id}`;
        await sendAutomatedText(fhirAppointment, oystehr, secrets, message);
      }
    });

    const appointmentPromises = [...nextHourAppointmentPromises, ...next90MinuteAppointmentPromises];

    await Promise.all(appointmentPromises);

    return {
      statusCode: 200,
      body: JSON.stringify({ status: 'hola' }),
    };
  } catch (error: any) {
    return topLevelCatch('send-message-cron', error, input.secrets, captureSentryException);
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
  secrets: Secrets | null,
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
      // should we alert slack in this instance ?
    }
  } catch (e) {
    console.log('error trying to send message: ', e, JSON.stringify(e));
    // should we alert slack in this instance ?
  }
}
