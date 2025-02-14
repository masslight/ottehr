import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Location, Patient } from 'fhir/r4b';
import {
  createOystehrClient,
  getParticipantIdFromAppointment,
  getPatientsForUser,
  GetTelemedAppointmentsResponse,
  mapStatusToTelemed,
  TelemedAppointmentInformationIntake,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { getSecret, SecretsKeys } from 'zambda-utils';
import { checkOrCreateM2MClientToken, getUser } from '../../shared';
import { filterTelemedVideoEncounters, getFhirResources } from './helpers';
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
    const locations = allResources.filter((resource) => resource.resourceType === 'Location') as Location[];
    const encountersMap = filterTelemedVideoEncounters(allResources);
    const appointments: TelemedAppointmentInformationIntake[] = [];
    allResources
      .filter((resourceTemp) => resourceTemp.resourceType === 'Appointment')
      .forEach((appointmentTemp) => {
        const fhirAppointment = appointmentTemp as Appointment;
        if (!fhirAppointment.id) return;
        const patient = allResources.find(
          (resourceTemp) => resourceTemp.id === getParticipantIdFromAppointment(fhirAppointment, 'Patient')
        ) as Patient;
        const encounter = encountersMap[fhirAppointment.id];

        if (!encounter) {
          console.log('No encounter for appointment: ' + fhirAppointment.id);
          return;
        }

        const telemedStatus = mapStatusToTelemed(encounter.status, fhirAppointment.status);
        if (!telemedStatus) {
          console.log('No telemed status for appointment');
          return;
        }

        const stateId = encounter?.location?.[0]?.location?.reference?.split('/')?.[1];

        const stateCode = locations.find((location) => location.id === stateId)?.address?.state;

        console.log(`build appointment resource for appointment with id ${fhirAppointment.id}`);
        const appointment: TelemedAppointmentInformationIntake = {
          id: fhirAppointment.id || 'Unknown',
          start: fhirAppointment.start,
          patient: {
            id: patient?.id || '',
            firstName: patient?.name?.[0]?.given?.[0],
            lastName: patient?.name?.[0].family,
          },
          appointmentStatus: fhirAppointment.status,
          telemedStatus: telemedStatus,
          state: { code: stateCode, id: stateId },
        };
        appointments.push(appointment);
      });

    const response: GetTelemedAppointmentsResponse = {
      appointments,
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
