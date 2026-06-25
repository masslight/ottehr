import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Location, Patient, Schedule } from 'fhir/r4b';
import {
  AppointmentInformationIntake,
  appointmentTypeMap,
  createOystehrClient,
  getInPersonVisitStatus,
  getParticipantIdFromAppointment,
  GetPastVisitsResponse,
  getPatientsForUser,
  getSecret,
  getTimezone,
  NO_READ_ACCESS_TO_PATIENT_ERROR,
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
  console.group('validateRequestParameters');
  const validatedParameters = validateRequestParameters(input);
  const { patientId, secrets } = validatedParameters;
  console.groupEnd();
  console.debug('validateRequestParameters success');
  console.log(`patientId from request: ${patientId ?? '(none)'}`);

  oystehrToken = await checkOrCreateM2MClientToken(oystehrToken, secrets);
  const fhirAPI = getSecret(SecretsKeys.FHIR_API, secrets);
  const projectAPI = getSecret(SecretsKeys.PROJECT_API, secrets);
  const oystehr = createOystehrClient(oystehrToken, fhirAPI, projectAPI);
  console.log('getting user');

  const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
  console.log(`user id: ${user.id}`);
  console.log('getting patients for user');
  const patients = await getPatientsForUser(user, oystehr);
  console.log('getPatientsForUser awaited');
  const patientIDs = patients.map((patient) => `Patient/${patient.id}`);
  console.log(`patient IDs for user: [${patientIDs.join(', ')}]`);

  if (patientId && !patientIDs.includes(`Patient/${patientId}`)) {
    // authenticated but requesting a patient they don't have access to
    throw NO_READ_ACCESS_TO_PATIENT_ERROR;
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
      const status = getInPersonVisitStatus(fhirAppointment, encounter);

      if (!status) {
        console.log(`No visit status for appointment: ${fhirAppointment.id}`);
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

  const sorted = appointments.sort((a, b) => new Date(b.start || '').getTime() - new Date(a.start || '').getTime());
  console.log(`returning ${sorted.length} past visit(s)`);

  const response: GetPastVisitsResponse = {
    appointments: sorted,
  };

  return {
    statusCode: 200,
    body: JSON.stringify(response),
  };
});
