import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Location, Patient } from 'fhir/r4b';
import {
  AppointmentInformationIntake,
  AppointmentStatus,
  appointmentTypeMap,
  createOystehrClient,
  getAppointmentTimezone,
  getParticipantIdFromAppointment,
  GetPastVisitsResponse,
  getPatientsForUser,
  getVisitStatus,
  mapStatusToTelemed,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { getSecret, SecretsKeys } from 'zambda-utils';
import { checkOrCreateM2MClientToken, getUser } from '../../shared';
import { getFhirResources, mapEncountersToAppointmentIds } from './helpers';
import { validateRequestParameters } from './validateRequestParameters';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { patientId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    zapehrToken = await checkOrCreateM2MClientToken(zapehrToken, secrets);
    const fhirAPI = getSecret(SecretsKeys.FHIR_API, secrets);
    const projectAPI = getSecret(SecretsKeys.PROJECT_API, secrets);
    const oystehr = createOystehrClient(zapehrToken, fhirAPI, projectAPI);
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

    console.log('allResources awaited');
    const allAppointments = allResources.filter((resource) => resource.resourceType === 'Appointment') as Appointment[];
    const relevantParticipants = Array.from(
      // Sometimes there are duplicate participants in the appointments, so we use a Set to deduplicate
      new Set(
        allAppointments.flatMap((appointment) =>
          appointment.participant
            .filter((participant) => {
              const reference = participant.actor?.reference;
              if (!reference) return false;

              return (
                reference.startsWith('Location/') ||
                reference.startsWith('HealthcareService/') ||
                reference.startsWith('Practitioner/')
              );
            })
            .map((participant) => participant.actor?.reference)
            .filter(Boolean)
        )
      )
    );

    const relevantResources = allResources.filter((resource) => {
      console.log('resource', resource.resourceType, resource.id);
      return relevantParticipants.includes(`${resource.resourceType}/${resource.id}`);
    });

    console.log('relevantResources', relevantResources);
    const locations = allResources.filter((resource) => resource.resourceType === 'Location') as Location[];
    const encountersMap = mapEncountersToAppointmentIds(allResources);
    const appointments: AppointmentInformationIntake[] = [];
    const pastVisitStatuses = ['fulfilled', 'cancelled'];

    const appointmentPromises = allAppointments.map(async (appointmentTemp) => {
      const fhirAppointment = appointmentTemp as Appointment;

      if (!fhirAppointment.id) return Promise.resolve(null);
      if (!pastVisitStatuses.includes(fhirAppointment.status)) return Promise.resolve(null);

      const patient = allResources.find(
        (resourceTemp) => resourceTemp.id === getParticipantIdFromAppointment(fhirAppointment, 'Patient')
      ) as Patient;
      const encounter = encountersMap[fhirAppointment.id];

      if (!encounter) {
        console.log('No encounter for appointment: ' + fhirAppointment.id);
        return Promise.resolve(null);
      }

      const stateId = encounter?.location?.[0]?.location?.reference?.split('/')?.[1];
      const stateCode = locations.find((location) => location.id === stateId)?.address?.state;

      const timezone = await getAppointmentTimezone(oystehr, fhirAppointment);
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
        return null;
      }
      console.log(`build appointment resource for appointment with id ${fhirAppointment.id}`);
      return {
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
    });

    const resolvedAppointments = (await Promise.all(appointmentPromises)).filter(
      Boolean
    ) as AppointmentInformationIntake[];
    appointments.push(...resolvedAppointments);

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
};
