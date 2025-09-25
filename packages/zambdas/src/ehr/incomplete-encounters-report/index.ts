import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Patient } from 'fhir/r4b';
import { getPatientFirstName, getPatientLastName, getVisitStatus, IncompleteEncountersReportZambdaOutput } from 'utils';
import {
  checkOrCreateM2MClientToken,
  createOystehrClient,
  topLevelCatch,
  wrapHandler,
  ZambdaInput,
} from '../../shared';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

const ZAMBDA_NAME = 'incomplete-encounters-report';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let validatedParameters: any;
  try {
    console.group('validateRequestParameters');
    validatedParameters = validateRequestParameters(input);
    const { dateRange, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    // Get M2M token for FHIR access
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.log('Searching for encounters in date range:', dateRange);

    // Search for encounters created within the date range and include appointments
    const encounterSearchResult = await oystehr.fhir.search<Encounter | Appointment | Patient>({
      resourceType: 'Encounter',
      params: [
        {
          name: '_lastUpdated',
          value: `ge${dateRange.start}`,
        },
        {
          name: '_lastUpdated',
          value: `le${dateRange.end}`,
        },
        {
          name: '_include',
          value: 'Encounter:appointment',
        },
        {
          name: '_include',
          value: 'Encounter:patient',
        },
        {
          name: '_sort',
          value: '-_lastUpdated',
        },
        {
          name: '_count',
          value: '1000',
        },
      ],
    });

    // Unbundle the FHIR search results to get array of resources
    const allResources = encounterSearchResult.unbundle();
    console.log(`Found ${allResources.length} total resources`);

    // Separate resources by type
    const encounters = allResources.filter((resource): resource is Encounter => resource.resourceType === 'Encounter');
    const appointments = allResources.filter(
      (resource): resource is Appointment => resource.resourceType === 'Appointment'
    );
    const patients = allResources.filter((resource): resource is Patient => resource.resourceType === 'Patient');

    console.log(`Encounters: ${encounters.length}, Appointments: ${appointments.length}, Patients: ${patients.length}`);

    // Create lookup maps
    const appointmentMap = new Map<string, Appointment>();
    appointments.forEach((apt) => {
      if (apt.id) {
        appointmentMap.set(`Appointment/${apt.id}`, apt);
      }
    });

    const patientMap = new Map<string, Patient>();
    patients.forEach((patient) => {
      if (patient.id) {
        patientMap.set(`Patient/${patient.id}`, patient);
      }
    });

    // Filter encounters to only include those that are not in terminal states
    const incompleteEncounters = encounters.filter((encounter) => {
      // Find the corresponding appointment
      const appointmentRef = encounter.appointment?.[0]?.reference;
      const appointment = appointmentRef ? appointmentMap.get(appointmentRef) : undefined;

      if (!appointment) {
        console.log(`No appointment found for encounter ${encounter.id}`);
        return false;
      }

      // Get visit status
      const visitStatus = getVisitStatus(appointment, encounter);

      // Terminal states that should be excluded from the report
      const terminalStates = ['completed', 'cancelled', 'no-show'];

      return !terminalStates.includes(visitStatus);
    });

    console.log(`Found ${incompleteEncounters.length} incomplete encounters`);

    // Build the response data
    const encounterItems = incompleteEncounters.map((encounter) => {
      const appointmentRef = encounter.appointment?.[0]?.reference;
      const appointment = appointmentRef ? appointmentMap.get(appointmentRef) : undefined;
      const patientRef = encounter.subject?.reference;
      const patient = patientRef ? patientMap.get(patientRef) : undefined;

      const visitStatus = appointment ? getVisitStatus(appointment, encounter) : 'unknown';

      return {
        encounterId: encounter.id || '',
        appointmentId: appointment?.id || '',
        patientId: patient?.id || '',
        patientName: patient ? `${getPatientFirstName(patient)} ${getPatientLastName(patient)}`.trim() : 'Unknown',
        dateOfBirth: patient?.birthDate || '',
        visitStatus,
        appointmentStart: appointment?.start || '',
        appointmentEnd: appointment?.end || '',
        location: appointment?.serviceCategory?.[0]?.text || '',
        reason: encounter.reasonCode?.[0]?.text || appointment?.appointmentType?.text || '',
      };
    });

    const response: IncompleteEncountersReportZambdaOutput = {
      message: `Found ${encounterItems.length} incomplete encounters`,
      encounters: encounterItems,
    };

    console.log('Response:', response);

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    await topLevelCatch(ZAMBDA_NAME, error, validatedParameters?.secrets || input.secrets);
    console.log('Error occurred:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
});
