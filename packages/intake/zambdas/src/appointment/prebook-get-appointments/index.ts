import { wrapHandler } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Encounter, Appointment as FhirAppointment, Location, Patient, QuestionnaireResponse, Slot } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  NO_READ_ACCESS_TO_PATIENT_ERROR,
  SLUG_SYSTEM,
  VisitStatusLabel,
  getPatientsForUser,
  getVisitStatus,
} from 'utils';
import { ZambdaInput } from 'zambda-utils';
import { Secrets, topLevelCatch } from 'zambda-utils';
import '../../../instrument.mjs';
import { captureSentryException, configSentry, getAuth0Token } from '../../shared';
import { getUser } from '../../shared/auth';
import { checkPaperworkComplete, createOystehrClient } from '../../shared/helpers';
import { validateRequestParameters } from './validateRequestParameters';

export interface GetPatientsInput {
  patientID?: string;
  dateRange?: { greaterThan: string; lessThan: string }; // if no date range is passed, all appointment from today onwards will be returned
  secrets: Secrets | null;
}

interface Appointment {
  id: string;
  patientID: string;
  firstName: string;
  middleName: string;
  lastName: string;
  start: string;
  status: string;
  location: { name: string; slug: string; state: string; timezone: string };
  paperworkComplete: boolean;
  checkedIn: boolean;
  visitType: string;
  visitStatus: VisitStatusLabel | undefined;
}

// Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
let zapehrToken: string;

export const index = wrapHandler(async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  configSentry('get-appointments', input.secrets);
  console.log(`Input: ${JSON.stringify(input)}`);
  try {
    console.group('validateRequestParameters');
    const validatedParameters = validateRequestParameters(input);
    const { patientID, dateRange, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');
    const now = DateTime.now().setZone('UTC');

    if (!zapehrToken) {
      console.log('getting token');
      zapehrToken = await getAuth0Token(secrets);
    } else {
      console.log('already have token');
    }

    const oystehr = createOystehrClient(zapehrToken, secrets);
    console.log('getting user');
    const user = await getUser(input.headers.Authorization.replace('Bearer ', ''), secrets);

    console.log('getting patients for user');
    const patients = await getPatientsForUser(user, oystehr);
    if (!patients.length) {
      const response = {
        message: 'No patients for this user',
        appointments: [],
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }
    const patientIDs = patients.map((patient) => `Patient/${patient.id}`);
    if (patientID && !patientIDs.includes(`Patient/${patientID}`)) {
      throw NO_READ_ACCESS_TO_PATIENT_ERROR;
    }

    const params = [
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
    ];

    if (patientID) {
      params.push({
        name: 'patient',
        value: `Patient/${patientID}`,
      });
    } else {
      params.push(
        {
          name: 'patient',
          value: patientIDs.join(','),
        },
        {
          name: 'status:not',
          value: 'fulfilled',
        }
      );
    }

    if (dateRange) {
      const dateLowerFormatted = DateTime.fromISO(dateRange.greaterThan).setZone('UTC').toISO();
      console.log('dateLowerFormatted', dateLowerFormatted);
      const dateUpperFormatted = DateTime.fromISO(dateRange.lessThan).setZone('UTC').toISO();
      console.log('dateUpperFormatted', dateUpperFormatted);
      params.push(
        { name: 'date', value: `ge${dateLowerFormatted}` },
        { name: 'date', value: `le${dateUpperFormatted}` }
      );
    } else {
      params.push({
        name: 'date',
        value: `ge${now.setZone('UTC').startOf('day').toISO()}`,
      });
    }

    console.log('getting all appointment resources');
    const allResources = (
      await oystehr.fhir.search<FhirAppointment | Encounter | Patient | QuestionnaireResponse | Slot>({
        resourceType: 'Appointment',
        params,
      })
    ).unbundle();
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
            (resource) => (resource as Encounter).appointment?.[0].reference === `Appointment/${appointmentTemp.id}`
          ) as Encounter;
        const questionnaireResponse = allResources
          .filter((resourceTemp) => resourceTemp.resourceType === 'QuestionnaireResponse')
          .find(
            (resource) => (resource as QuestionnaireResponse).encounter?.reference === `Encounter/${encounter?.id}`
          ) as QuestionnaireResponse;
        const patient = allResources.find((resourceTemp) => resourceTemp.id === patientID) as Patient | undefined;
        const location = allResources.find((resourceTemp) => resourceTemp.id === locationID) as Location | undefined;
        console.log(`build appointment resource for appointment with id ${fhirAppointment.id}`);
        const appointment: Appointment = {
          id: fhirAppointment.id || 'Unknown',
          patientID: patient?.id || 'Unknown',
          firstName: patient?.name?.[0]?.given?.[0] || 'Unknown',
          middleName: patient?.name?.[0]?.given?.[1] || '',
          lastName: patient?.name?.[0].family || 'Unknown',
          start: fhirAppointment.start || 'Unknown',
          status: fhirAppointment?.status,
          location: {
            name: location?.name || 'Unknown',
            slug:
              location?.identifier?.find((identifierTemp) => identifierTemp.system === SLUG_SYSTEM)?.value || 'Unknown',
            state: location?.address?.state?.toLocaleLowerCase() || 'Unknown',
            timezone:
              location?.extension?.find((extTemp) => extTemp.url === 'http://hl7.org/fhir/StructureDefinition/timezone')
                ?.valueString || 'Unknown',
          },
          paperworkComplete: checkPaperworkComplete(questionnaireResponse),
          checkedIn: fhirAppointment.status !== 'booked',
          visitType: fhirAppointment.appointmentType?.text || 'Unknown',
          visitStatus: getVisitStatus(fhirAppointment, encounter),
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
    return topLevelCatch('get-appointments', error, input.secrets, captureSentryException);
  }
});
