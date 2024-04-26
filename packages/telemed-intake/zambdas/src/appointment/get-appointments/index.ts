import { APIGatewayProxyResult } from 'aws-lambda';
import { validateRequestParameters } from './validateRequestParameters';
import { createFhirClient } from '../../../../../utils/lib/helpers/helpers';
import { DateTime } from 'luxon';
import { Encounter, Appointment as FhirAppointment, Location, Patient, QuestionnaireResponse, Resource } from 'fhir/r4';
import { getUser } from '../../shared/auth';
import { getPatientsForUser } from '../../shared/patients';
import { checkOrCreateToken } from '../lib/utils';
import { Secrets, ZambdaInput, SecretsKeys, getSecret } from 'ottehr-utils';

export interface GetPatientsInput {
  secrets: Secrets | null;
}

interface Appointment {
  id: string;
  firstName: string;
  lastName: string;
  start: string;
  location: { name: string; slug: string; timezone: string };
  paperworkComplete: boolean;
  checkedIn: boolean;
  visitType: string;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    const now = DateTime.now().setZone('UTC');

    zapehrToken = await checkOrCreateToken(zapehrToken, secrets);

    const fhirAPI = getSecret(SecretsKeys.FHIR_API, secrets);
    const fhirClient = createFhirClient(zapehrToken, fhirAPI);
    console.log('getting user');
    const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);
    console.log('getting patients for user');
    const patients = await getPatientsForUser(user, fhirClient);
    console.log('getting all appointment resources');
    const allResources: Resource[] = await fhirClient?.searchResources({
      resourceType: 'Appointment',
      searchParams: [
        {
          name: 'patient',
          value: patients.map((patient) => `Patient/${patient.id}`).join(','),
        },
        {
          name: 'date',
          value: `ge${now.setZone('UTC').startOf('day').toISO()}`,
        },
        {
          name: '_include',
          value: 'Appointment:slot',
        },
        {
          name: '_include',
          value: 'Appointment:patient',
        },
        {
          name: '_include',
          value: 'Appointment:location',
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
          name: 'status:not',
          value: 'cancelled',
        },
        {
          name: 'status:not',
          value: 'noshow',
        },
        {
          name: '_sort',
          value: 'date',
        },
        {
          name: '_count',
          value: '1000',
        },
      ],
    });
    console.log('successfully retrieved appointment resources');
    const appointments: Appointment[] = allResources
      .filter((resourceTemp) => resourceTemp.resourceType === 'Appointment')
      .map((appointmentTemp) => {
        const fhirAppointment = appointmentTemp as FhirAppointment;
        const patientID = fhirAppointment.participant
          .find((participantTemp) => participantTemp.actor?.reference?.startsWith('Patient/'))
          ?.actor?.reference?.split('/')[1];
        const locationID = fhirAppointment.participant
          .find((participantTemp) => participantTemp.actor?.reference?.startsWith('Location/'))
          ?.actor?.reference?.split('/')[1];
        const encounter = allResources
          .filter((resourceTemp) => resourceTemp.resourceType === 'Encounter')
          .find(
            (resource) => (resource as Encounter).appointment?.[0].reference === `Appointment/${appointmentTemp.id}`,
          ) as Encounter;
        const questionnaireResponse = allResources
          .filter((resourceTemp) => resourceTemp.resourceType === 'QuestionnaireResponse')
          .find(
            (resource) => (resource as QuestionnaireResponse).encounter?.reference === `Encounter/${encounter?.id}`,
          ) as QuestionnaireResponse;
        const patient = allResources.find((resourceTemp) => resourceTemp.id === patientID) as Patient;
        const location = allResources.find((resourceTemp) => resourceTemp.id === locationID) as Location;
        console.log(`build appointment resource for appointment with id ${fhirAppointment.id}`);
        const appointment: Appointment = {
          id: fhirAppointment.id || 'Unknown',
          firstName: patient?.name?.[0]?.given?.[0] || 'Unknown',
          lastName: patient?.name?.[0].family || 'Unknown',
          start: fhirAppointment.start || 'Unknown',
          location: {
            name: location?.name || 'Unknown',
            slug:
              location.identifier?.find((identifierTemp) => identifierTemp.system === 'https://fhir.ottehr.com/r4/slug')
                ?.value || 'Unknown',
            timezone:
              location.extension?.find((extTemp) => extTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone')
                ?.valueString || 'Unknown',
          },
          paperworkComplete:
            questionnaireResponse?.status === 'completed' || questionnaireResponse?.status === 'amended',
          checkedIn: fhirAppointment.status !== 'booked',
          visitType: fhirAppointment.appointmentType?.text || 'Unknown',
        };
        return appointment;
      });

    const response = {
      message: 'Successfully retrieved all appointments',
      appointments: appointments,
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
