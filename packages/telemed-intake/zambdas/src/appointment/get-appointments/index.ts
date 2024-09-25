import { APIGatewayProxyResult } from 'aws-lambda';
import { validateRequestParameters } from './validateRequestParameters';
import { createFhirClient } from '../../../../../utils/lib/helpers/helpers';
import { Appointment, Patient } from 'fhir/r4';
import { checkOrCreateToken } from '../lib/utils';
import {
  getSecret,
  GetTelemedAppointmentsResponse,
  SecretsKeys,
  TelemedAppointmentInformation,
  ZambdaInput,
} from 'ottehr-utils';
import { filterTelemedVideoEncounters, getFhirResources } from './helpers';
import { mapStatusToTelemed } from '../../shared/appointment/helpers';
import { getPatientsForUser, getUser } from '../../shared';

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { patientId, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    zapehrToken = await checkOrCreateToken(zapehrToken, secrets);
    const fhirClient = createFhirClient(zapehrToken);
    console.log('getting user');
    console.log('input', input);

    const user = await getUser(input.headers.Authorization.replace('Bearer ', ''));
    console.log('getting patients for user');
    const patients = await getPatientsForUser(user, fhirClient);
    const patientIDs = patients.map((patient) => `Patient/${patient.id}`);
    if (patientId && !patientIDs.includes(`Patient/${patientId}`)) {
      throw new Error('Not authorized to get this patient');
    }

    const allResources = await getFhirResources(fhirClient, patientIDs, patientId);
    const encountersMap = filterTelemedVideoEncounters(allResources);
    const appointments: TelemedAppointmentInformation[] = [];
    allResources
      .filter((resourceTemp) => resourceTemp.resourceType === 'Appointment')
      .forEach((appointmentTemp) => {
        const fhirAppointment = appointmentTemp as Appointment;
        if (!fhirAppointment.id) return;
        const patient = allResources.find((resourceTemp) => resourceTemp.id === patientId) as Patient;
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

        console.log(`build appointment resource for appointment with id ${fhirAppointment.id}`);
        const appointment: TelemedAppointmentInformation = {
          id: fhirAppointment.id || 'Unknown',
          start: fhirAppointment.start,
          patient: {
            id: patient?.id,
            firstName: patient?.name?.[0]?.given?.[0],
            lastName: patient?.name?.[0].family,
          },
          appointmentStatus: fhirAppointment.status,
          telemedStatus: telemedStatus,
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
