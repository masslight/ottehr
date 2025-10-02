import { randomUUID } from 'crypto';
import { Appointment, Location, Patient, Slot } from 'fhir/r4b';
import fs from 'fs';
import { DateTime } from 'luxon';
import {
  DATETIME_FULL_NO_YEAR,
  ErrorReportTemplateData,
  getAddressString,
  getFullName,
  getServiceModeFromSlot,
  InPersonCancelationTemplateData,
  InPersonCompletionTemplateData,
  InPersonConfirmationTemplateData,
  InPersonReminderTemplateData,
  ServiceMode,
  TelemedCancelationTemplateData,
  TelemedCompletionTemplateData,
  TelemedConfirmationTemplateData,
  TelemedInvitationTemplateData,
} from 'utils';
import { createOystehrClient, getAuth0Token, getEmailClient } from '../shared';
const randomVisitId = randomUUID();

const inPersonConfirmationTestInput = (
  env: any,
  appointmentData: AppointmentData
): InPersonConfirmationTemplateData => ({
  location: `${appointmentData.locationName}`,
  time: `${appointmentData.startTime ?? DateTime.now().toFormat(DATETIME_FULL_NO_YEAR)}`,
  address: `${appointmentData.locationAddress}`,
  'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI(appointmentData.locationAddress)}`,
  'modify-visit-url': `${env['WEBSITE_URL']}/visit/${appointmentData.id ?? randomVisitId}/reschedule`,
  'cancel-visit-url': `${env['WEBSITE_URL']}/visit/${appointmentData.id ?? randomVisitId}/cancel`,
  'paperwork-url': `${env['WEBSITE_URL']}/paperwork/${appointmentData.id ?? randomVisitId}`,
});

const inPersonCancelationTestInput = (env: any, appointmentData: AppointmentData): InPersonCancelationTemplateData => ({
  location: `${appointmentData.locationName}`,
  time: `${appointmentData.startTime ?? DateTime.now().toFormat(DATETIME_FULL_NO_YEAR)}`,
  address: `${appointmentData.locationAddress}`,
  'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI(appointmentData.locationAddress)}`,
  'book-again-url': `${env['WEBSITE_URL']}/visit/${appointmentData.id ?? randomVisitId}/book-again`,
});

const inPersonCompletionTestInput = (env: any, appointmentData: AppointmentData): InPersonCompletionTemplateData => ({
  location: `${appointmentData.locationName}`,
  time: `${appointmentData.startTime ?? DateTime.now().toFormat(DATETIME_FULL_NO_YEAR)}`,
  address: `${appointmentData.locationAddress}`,
  'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI(appointmentData.locationAddress)}`,
  'visit-note-url': `${env['WEBSITE_URL']}/visit/${appointmentData.id ?? randomVisitId}/note`, // todo: confirm actual note url
});

const inPersonReminderTemplateData = (env: any, appointmentData: AppointmentData): InPersonReminderTemplateData => ({
  location: `${appointmentData.locationName}`,
  time: `${appointmentData.startTime ?? DateTime.now().toFormat(DATETIME_FULL_NO_YEAR)}`,
  address: `${appointmentData.locationAddress}`,
  'address-url': `https://www.google.com/maps/search/?api=1&query=${encodeURI(appointmentData.locationAddress)}`,
  'modify-visit-url': `${env['WEBSITE_URL']}/visit/${appointmentData.id ?? randomVisitId}/reschedule`,
  'cancel-visit-url': `${env['WEBSITE_URL']}/visit/${appointmentData.id ?? randomVisitId}/cancel`,
  'paperwork-url': `${env['WEBSITE_URL']}/paperwork/${appointmentData.id ?? randomVisitId}`,
});

const telemedConfirmationTestInput = (env: any, appointmentData: AppointmentData): TelemedConfirmationTemplateData => ({
  location: `${appointmentData.locationName}`,
  'cancel-visit-url': `${env['WEBSITE_URL']}/visit/${appointmentData.id ?? randomVisitId}/cancel`,
  'paperwork-url': `${env['WEBSITE_URL']}/paperwork/${appointmentData.id ?? randomVisitId}`,
  'join-visit-url': `${env['WEBSITE_URL']}/visit/${appointmentData.id ?? randomVisitId}/join`,
});
const telemedCancelationTestInput = (env: any, appointmentData: AppointmentData): TelemedCancelationTemplateData => ({
  location: `${appointmentData.locationName}`,
  'book-again-url': `${env['WEBSITE_URL']}/visit/${appointmentData.id ?? randomVisitId}/book-again`,
});

const telemedCompletionTestInput = (env: any, appointmentData: AppointmentData): TelemedCompletionTemplateData => ({
  location: `${appointmentData.locationName}`,
  'visit-note-url': `${env['WEBSITE_URL']}/visit/${appointmentData.id ?? randomVisitId}/note`, // todo: confirm actual note url
});

const telemedInvitationTestInput = (env: any, appointmentData: AppointmentData): TelemedInvitationTemplateData => ({
  'join-visit-url': `${env['WEBSITE_URL']}/visit/${appointmentData.id ?? randomVisitId}/join`,
  'patient-name': appointmentData.patientName ?? 'John Doe',
});

const errorReportTestInput = (env: any): ErrorReportTemplateData => ({
  'error-message': 'Test error message',
  environment: env['ENVIRONMENT'],
  timestamp: DateTime.now().toFormat(DATETIME_FULL_NO_YEAR),
});

interface AppointmentData {
  serviceMode: ServiceMode;
  locationName: string;
  locationAddress: string;
  id?: string;
  patientName?: string;
  startTime?: string;
}
const testEmails = async (envConfig: any, to: string, appointmentData: AppointmentData): Promise<void> => {
  try {
    const emailClient = getEmailClient(envConfig);
    if (appointmentData.serviceMode === 'in-person') {
      await emailClient.sendInPersonConfirmationEmail(to, inPersonConfirmationTestInput(envConfig, appointmentData));
      await emailClient.sendInPersonCancelationEmail(to, inPersonCancelationTestInput(envConfig, appointmentData));
      await emailClient.sendInPersonCompletionEmail(to, inPersonCompletionTestInput(envConfig, appointmentData));
      await emailClient.sendInPersonReminderEmail(to, inPersonReminderTemplateData(envConfig, appointmentData));
    } else {
      await emailClient.sendVirtualConfirmationEmail(to, telemedConfirmationTestInput(envConfig, appointmentData));
      await emailClient.sendVirtualCancelationEmail(to, telemedCancelationTestInput(envConfig, appointmentData));
      await emailClient.sendVirtualCompletionEmail(to, telemedCompletionTestInput(envConfig, appointmentData));
      await emailClient.sendVideoChatInvitationEmail(to, telemedInvitationTestInput(envConfig, appointmentData));
    }
    await emailClient.sendErrorEmail(to, errorReportTestInput(envConfig));
  } catch (e) {
    console.log('email test threw error:', e);
  }
};

const main = async (): Promise<void> => {
  const env = process.argv[2];
  const to = process.argv[3];
  const serviceModeArg = process.argv[4];
  const appointmentID = process.argv[5];

  let envConfig = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));

  try {
    envConfig = JSON.parse(fs.readFileSync(`.env/${env}.json`, 'utf8'));
  } catch (error) {
    console.error(`Error parsing secrets for ENV '${env}'. Error: ${JSON.stringify(error)}`);
  }

  const serviceMode = serviceModeArg === 'in-person' ? ServiceMode['in-person'] : ServiceMode.virtual;
  const locationName = serviceMode === ServiceMode['in-person'] ? 'Manassas' : 'Telemed VA';
  const locationAddress = serviceMode === ServiceMode['in-person'] ? '123 Main St, Manassas, VA 20110' : '';

  let appointmentData: AppointmentData = { serviceMode, locationName, locationAddress };
  console.log(`env: ${env}, send to: ${to}, appointmentID: ${appointmentID}, serviceMode: ${serviceModeArg}`);
  if (appointmentID) {
    const token = await getAuth0Token(envConfig);
    if (!token) {
      throw new Error('Failed to fetch auth token.');
    }
    const oystehr = createOystehrClient(token, envConfig);
    const appointmentBundle = (
      await oystehr.fhir.search<Appointment | Patient | Slot | Location>({
        resourceType: 'Appointment',
        params: [
          {
            name: '_id',
            value: appointmentID,
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
            name: '_include',
            value: 'Appointment:location',
          },
        ],
      })
    ).unbundle();

    const appointment: Appointment | undefined = appointmentBundle.find(
      (resource) => resource.resourceType === 'Appointment'
    );
    const patient: Patient | undefined = appointmentBundle.find((resource) => resource.resourceType === 'Patient');
    const slot: Slot | undefined = appointmentBundle.find((resource) => resource.resourceType === 'Slot');
    const location: Location | undefined = appointmentBundle.find((resource) => resource.resourceType === 'Location');
    if (!appointment) {
      console.log(`exiting, no appointment found with that ID in this env\n`);
      process.exit(1);
    }
    if (!patient) {
      console.log(`exiting, no patient found for that appointment in this env\n`);
      process.exit(1);
    }
    if (!location) {
      console.log(`exiting, no location found for that appointment in this env\n`);
      process.exit(1);
    }
    const patientName = getFullName(patient);
    const serviceMode = slot ? getServiceModeFromSlot(slot) ?? ServiceMode.virtual : ServiceMode.virtual;
    const startTime = appointment.start
      ? DateTime.fromISO(appointment.start).toFormat(DATETIME_FULL_NO_YEAR)
      : undefined;
    const locationName = location?.name ?? (serviceMode === ServiceMode.virtual ? 'Telemed VA' : 'Manassas');
    const locationAddress =
      getAddressString(location?.address) ??
      (serviceMode === ServiceMode.virtual ? '' : '123 Main St, Manassas, VA 20110');
    appointmentData = { serviceMode, id: appointmentID, patientName, startTime, locationName, locationAddress };
    console.log(`found appointment with service mode ${serviceMode} for ${patientName}`);
  } else if (serviceModeArg == undefined) {
    throw new Error('Must provide either appointment ID or service mode as argument.');
  }
  await testEmails(envConfig, to, appointmentData);
};

main().catch((error) => {
  console.log('error', error);
  throw error;
});
