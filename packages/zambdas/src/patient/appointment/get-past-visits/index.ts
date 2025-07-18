import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Location, Patient, Schedule } from 'fhir/r4b';
import {
  AppointmentInformationIntake,
  AppointmentStatus,
  appointmentTypeMap,
  createOystehrClient,
  getParticipantIdFromAppointment,
  GetPastVisitsResponse,
  getPatientsForUser,
  getSecret,
  getTimezone,
  getVisitStatus,
  mapStatusToTelemed,
  SecretsKeys,
  TIMEZONE_EXTENSION_URL,
  TIMEZONES,
} from 'utils';
import { checkOrCreateM2MClientToken, getUser, wrapHandler, ZambdaInput } from '../../../shared';
import { getFhirResources, mapEncountersToAppointmentIds } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

const ZAMBDA_NAME = 'get-past-visits';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let oystehrToken: string;

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { patientId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    oystehrToken = await checkOrCreateM2MClientToken(oystehrToken, secrets);
    const fhirAPI = getSecret(SecretsKeys.FHIR_API, secrets);
    const projectAPI = getSecret(SecretsKeys.PROJECT_API, secrets);
    const oystehr = createOystehrClient(oystehrToken, fhirAPI, projectAPI);
    console.log('getting user');

    const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
    console.log('getting patients for user');
    const patients = await getPatientsForUser(user, oystehr);
    console.log('getPatientsForUser awaited');
    const patientIDs = patients.map((patient) => `Patient/${patient.id}`);

    if (patientId && !patientIDs.includes(`Patient/${patientId}`)) {
      throw new Error('Not authorized to get this patient');
    }

    if (!patientIDs.length && !patientId) {
      console.log('returned empty appointments');
      return {
        statusCode: 200,
        body: JSON.stringify({ appointments: [] }),
      };
    }

    console.log('awaiting allResources');
    const allResources = await getFhirResources(oystehr, patientIDs, patientId);

    const scheduleResource = allResources.filter((resource) => {
      if (resource.resourceType !== 'Schedule') return false;
      const extensionTemp = (resource as { extension?: Array<{ url: string }> }).extension;
      const extensionSchedule = extensionTemp?.find((extension) => extension.url === TIMEZONE_EXTENSION_URL);
      return !!extensionSchedule;
    })[0] as Schedule | undefined;

    console.log('allResources awaited');

    const locations = allResources.filter((resource) => resource.resourceType === 'Location') as Location[];
    const encountersMap = mapEncountersToAppointmentIds(allResources);
    const appointments: AppointmentInformationIntake[] = [];
    const pastVisitStatuses = ['fulfilled', 'cancelled'];

    allResources
      .filter((resourceTemp) => resourceTemp.resourceType === 'Appointment')
      .forEach((appointmentTemp) => {
        const fhirAppointment = appointmentTemp as Appointment;

        if (!fhirAppointment.id) return;
        if (!pastVisitStatuses.includes(fhirAppointment.status)) return;

        const patient = allResources.find(
          (resourceTemp) => resourceTemp.id === getParticipantIdFromAppointment(fhirAppointment, 'Patient')
        ) as Patient;
        const encounter = encountersMap[fhirAppointment.id];

        if (!encounter) {
          console.log('No encounter for appointment: ' + fhirAppointment.id);
          return;
        }

        const stateId = encounter?.location?.[0]?.location?.reference?.split('/')?.[1];
        const stateCode = locations.find((location) => location.id === stateId)?.address?.state;
        const timezone = scheduleResource ? getTimezone(scheduleResource) : TIMEZONES[0];
        const appointmentTypeTag = fhirAppointment.meta?.tag?.find((tag) => tag.code && tag.code in appointmentTypeMap);
        const appointmentType = appointmentTypeTag?.code ? appointmentTypeMap[appointmentTypeTag.code] : 'Unknown';

        let status: AppointmentStatus | undefined;
        if (appointmentType === 'Telemedicine') {
          status = mapStatusToTelemed(encounter.status, fhirAppointment.status);
        } else if (appointmentType === 'In-Person') {
          status = getVisitStatus(fhirAppointment, encounter);
        }

        if (!status) {
          console.log('No visit status for appointment');
          return;
        }

        console.log(`build appointment resource for appointment with id ${fhirAppointment.id}`);

        const appointment: AppointmentInformationIntake = {
          id: fhirAppointment.id || 'Unknown',
          start: fhirAppointment.start,
          patient: {
            id: patient?.id || '',
            firstName: patient?.name?.[0]?.given?.[0],
            lastName: patient?.name?.[0].family,
          },
          appointmentStatus: fhirAppointment.status,
          status: status,
          state: { code: stateCode, id: stateId },
          timezone: timezone,
          type: appointmentType,
        };
        appointments.push(appointment);
      });

    const response: GetPastVisitsResponse = {
      appointments: appointments.sort((a, b) => new Date(b.start || '').getTime() - new Date(a.start || '').getTime()),
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.log('error', error, error.issue);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal error' }),
    };
  }
});
