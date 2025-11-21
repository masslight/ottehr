import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Location, Patient, Practitioner } from 'fhir/r4b';
import {
  getAttendingPractitionerId,
  getInPersonVisitStatus,
  getPatientFirstName,
  getPatientLastName,
  getSecret,
  IncompleteEncountersReportZambdaInput,
  IncompleteEncountersReportZambdaOutput,
  isInPersonAppointment,
  isTelemedAppointment,
  OTTEHR_MODULE,
  Secrets,
  SecretsKeys,
} from 'utils';
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
  let validatedParameters: IncompleteEncountersReportZambdaInput & { secrets: Secrets };
  try {
    console.group('validateRequestParameters');
    validatedParameters = validateRequestParameters(input);
    const { dateRange, secrets } = validatedParameters;
    console.groupEnd();
    console.debug('validateRequestParameters success');

    // Get M2M token for FHIR access
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.log('Searching for appointments in date range:', dateRange);

    // Search for appointments within the date range with proper pagination
    // Fetch all appointments, encounters, patients, locations, and practitioners with proper FHIR pagination
    let allResources: (Appointment | Encounter | Patient | Location | Practitioner)[] = [];
    let offset = 0;
    const pageSize = 1000;

    const baseSearchParams = [
      {
        name: 'date',
        value: `ge${dateRange.start}`,
      },
      {
        name: 'date',
        value: `le${dateRange.end}`,
      },
      {
        name: 'status',
        value: 'proposed,pending,booked,arrived,fulfilled,checked-in,waitlist',
      },
      {
        name: '_tag',
        value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}`,
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
        name: '_include:iterate',
        value: 'Encounter:participant:Practitioner',
      },
      {
        name: '_sort',
        value: 'date',
      },
      {
        name: '_count',
        value: pageSize.toString(),
      },
    ];

    let searchBundle = await oystehr.fhir.search<Appointment | Encounter | Patient | Location | Practitioner>({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });

    let pageCount = 1;
    console.log(`Fetching page ${pageCount} of incomplete encounters...`);

    // Get resources from first page
    let pageResources = searchBundle.unbundle();
    allResources = allResources.concat(pageResources);
    const pageAppointments = pageResources.filter(
      (resource): resource is Appointment => resource.resourceType === 'Appointment'
    );
    console.log(
      `Page ${pageCount}: Found ${pageResources.length} total resources (${pageAppointments.length} appointments)`
    );

    // Follow pagination links to get all pages
    while (searchBundle.link?.find((link) => link.relation === 'next')) {
      offset += pageSize;
      pageCount++;
      console.log(`Fetching page ${pageCount} of incomplete encounters...`);

      searchBundle = await oystehr.fhir.search<Appointment | Encounter | Patient | Location | Practitioner>({
        resourceType: 'Appointment',
        params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
      });

      pageResources = searchBundle.unbundle();
      allResources = allResources.concat(pageResources);
      const pageAppointmentsCount = pageResources.filter(
        (resource): resource is Appointment => resource.resourceType === 'Appointment'
      ).length;

      console.log(
        `Page ${pageCount}: Found ${pageResources.length} total resources (${pageAppointmentsCount} appointments)`
      );

      // Safety check to prevent infinite loops
      if (pageCount > 100) {
        console.warn('Reached maximum pagination limit (100 pages). Stopping search.');
        break;
      }
    }

    console.log(`Found ${allResources.length} total resources across ${pageCount} pages`);

    // Separate resources by type
    const encounters = allResources.filter((resource): resource is Encounter => resource.resourceType === 'Encounter');
    const appointments = allResources.filter(
      (resource): resource is Appointment => resource.resourceType === 'Appointment'
    );
    const patients = allResources.filter((resource): resource is Patient => resource.resourceType === 'Patient');
    const locations = allResources.filter((resource): resource is Location => resource.resourceType === 'Location');
    const practitioners = allResources.filter(
      (resource): resource is Practitioner => resource.resourceType === 'Practitioner'
    );

    console.log(
      `Encounters: ${encounters.length}, Appointments: ${appointments.length}, Patients: ${patients.length}, Locations: ${locations.length}, Practitioners: ${practitioners.length}`
    );

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

    const locationMap = new Map<string, Location>();
    locations.forEach((location) => {
      if (location.id) {
        locationMap.set(`Location/${location.id}`, location);
      }
    });

    const practitionerMap = new Map<string, Practitioner>();
    practitioners.forEach((practitioner) => {
      if (practitioner.id) {
        practitionerMap.set(practitioner.id, practitioner);
      }
    });

    // Filter encounters to only include those that are not in terminal states
    // Only encounters that have appointments within our date range will be included
    const incompleteEncounters = encounters.filter((encounter) => {
      // Find the corresponding appointment
      const appointmentRef = encounter.appointment?.[0]?.reference;
      const appointment = appointmentRef ? appointmentMap.get(appointmentRef) : undefined;

      if (!appointment) {
        console.log(`No appointment found for encounter ${encounter.id}`);
        return false;
      }

      // Get visit status
      const visitStatus = getInPersonVisitStatus(appointment, encounter, true);

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

      // Get location name from Location resource
      const locationRef = appointment?.participant?.find((p) => p.actor?.reference?.startsWith('Location/'))?.actor
        ?.reference;
      const location = locationRef ? locationMap.get(locationRef) : undefined;
      const locationName = location?.name || 'Unknown';
      const locationId = locationRef ? locationRef.replace('Location/', '') : undefined;

      // Get attending practitioner name
      const attendingPractitionerId = getAttendingPractitionerId(encounter);
      const attendingPractitioner = attendingPractitionerId ? practitionerMap.get(attendingPractitionerId) : undefined;
      const attendingProviderName = attendingPractitioner
        ? `${attendingPractitioner.name?.[0]?.given?.[0] || ''} ${attendingPractitioner.name?.[0]?.family || ''}`.trim()
        : 'Unknown';

      // Determine visit type based on appointment meta tags
      const visitType = isTelemedAppointment(appointment)
        ? 'Telemed'
        : isInPersonAppointment(appointment)
        ? 'In-Person'
        : 'Unknown';

      const visitStatus = appointment ? getInPersonVisitStatus(appointment, encounter, true) : 'unknown';

      return {
        appointmentId: appointment?.id || '',
        patientId: patient?.id || '',
        patientName: patient ? `${getPatientFirstName(patient)} ${getPatientLastName(patient)}`.trim() : 'Unknown',
        dateOfBirth: patient?.birthDate || '',
        visitStatus,
        appointmentStart: appointment?.start || '',
        appointmentEnd: appointment?.end || '',
        location: locationName || 'Unknown',
        locationId,
        attendingProvider: attendingProviderName,
        visitType,
        reason: encounter.reasonCode?.[0]?.text || appointment?.appointmentType?.text || '',
      };
    });

    const response: IncompleteEncountersReportZambdaOutput = {
      message: `Found ${encounterItems.length} incomplete encounters`,
      encounters: encounterItems,
    };

    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error: unknown) {
    const ENVIRONMENT = getSecret(SecretsKeys.ENVIRONMENT, input.secrets);
    return topLevelCatch(ZAMBDA_NAME, error, ENVIRONMENT);
  }
});
