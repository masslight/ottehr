import { captureException } from '@sentry/aws-serverless';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Encounter, Location, Practitioner } from 'fhir/r4b';
import {
  AppointmentTypeCount,
  DailyVisitCount,
  getAdmitterPractitionerId,
  getAttendingPractitionerId,
  getSecret,
  isInPersonAppointment,
  isTelemedAppointment,
  LocationVisitCount,
  OTTEHR_MODULE,
  PractitionerVisitCount,
  SecretsKeys,
  VisitsOverviewReportZambdaOutput,
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

const ZAMBDA_NAME = 'visits-overview-report';

export const index = wrapHandler(ZAMBDA_NAME, async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  let validatedParameters;
  try {
    validatedParameters = validateRequestParameters(input);
    const { dateRange } = validatedParameters;

    // Get M2M token for FHIR access
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, validatedParameters.secrets);
    const oystehr = createOystehrClient(m2mToken, validatedParameters.secrets);

    console.log('Searching for appointments in date range:', dateRange);

    // Search for appointments within the date range
    // Fetch all appointments, locations, encounters, and practitioners with proper FHIR pagination
    let allResources: (Appointment | Location | Encounter | Practitioner)[] = [];
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
        name: '_tag',
        value: `${OTTEHR_MODULE.TM},${OTTEHR_MODULE.IP}`,
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
        name: '_count',
        value: pageSize.toString(),
      },
    ];

    let searchBundle = await oystehr.fhir.search<Appointment | Location | Encounter | Practitioner>({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });

    let pageCount = 1;
    console.log(`Fetching page ${pageCount} of appointments and locations...`);

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
      console.log(`Fetching page ${pageCount} of appointments and locations...`);

      searchBundle = await oystehr.fhir.search<Appointment | Location | Encounter | Practitioner>({
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

    // Separate resources by type
    const appointments = allResources.filter(
      (resource): resource is Appointment => resource.resourceType === 'Appointment'
    );
    const locations = allResources.filter((resource): resource is Location => resource.resourceType === 'Location');
    const encounters = allResources.filter((resource): resource is Encounter => resource.resourceType === 'Encounter');
    const practitioners = allResources.filter(
      (resource): resource is Practitioner => resource.resourceType === 'Practitioner'
    );

    console.log(
      `Total resources found across ${pageCount} pages: ${allResources.length} (${appointments.length} appointments, ${locations.length} locations, ${encounters.length} encounters, ${practitioners.length} practitioners)`
    );

    if (appointments.length === 0) {
      const response: VisitsOverviewReportZambdaOutput = {
        message: 'No appointments found for the specified date range',
        totalAppointments: 0,
        appointmentTypes: [
          { type: 'In-Person', count: 0, percentage: 0 },
          { type: 'Telemed', count: 0, percentage: 0 },
        ],
        dailyVisits: [],
        locationVisits: [],
        practitionerVisits: [],
        dateRange,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

    // Count appointments by type and by date
    const typeCounts = {
      'In-Person': 0,
      Telemed: 0,
    };

    // Group appointments by date and type for chart data
    const dailyVisitsMap = new Map<string, { inPerson: number; telemed: number }>();

    appointments.forEach((appointment) => {
      // Determine appointment type based on meta tags
      const isTelemedicine = isTelemedAppointment(appointment);
      const isInPerson = isInPersonAppointment(appointment);

      // Extract date from appointment
      let appointmentDate = 'unknown';
      if (appointment.start) {
        try {
          // extract date
          const appointmentDateTime = new Date(appointment.start);
          const localDate = appointmentDateTime.toLocaleDateString('en-US'); // en-US gives YYYY-MM-DD format
          appointmentDate = localDate;
        } catch (error) {
          console.warn('Failed to parse appointment date:', appointment.start, error);
          captureException(error);
          appointmentDate = 'unknown';
        }
      }

      // Initialize date entry if it doesn't exist
      if (!dailyVisitsMap.has(appointmentDate)) {
        dailyVisitsMap.set(appointmentDate, { inPerson: 0, telemed: 0 });
      }

      const dayData = dailyVisitsMap.get(appointmentDate)!;

      if (isTelemedicine) {
        typeCounts.Telemed++;
        dayData.telemed++;
      } else if (isInPerson) {
        typeCounts['In-Person']++;
        dayData.inPerson++;
      }
      // Note: Skip appointments that don't have a clear type - they won't be counted
    });

    const totalAppointments = appointments.length;

    // Process location-based visit counts
    const locationVisitsMap = new Map<string, { locationId: string; inPerson: number; telemed: number }>();

    appointments.forEach((appointment) => {
      // Get location reference from appointment
      const participantWithLocation = appointment.participant?.find((p) => p.actor?.reference?.startsWith('Location/'));

      // Check if appointment is telemedicine or in-person (using same logic as daily visits)
      const isTelemedicine = isTelemedAppointment(appointment);
      const isInPerson = isInPersonAppointment(appointment);

      let locationKey = 'Unknown Location';
      let locationId = 'unknown';

      if (participantWithLocation?.actor?.reference) {
        locationId = participantWithLocation.actor.reference.replace('Location/', '');
        // Find the location resource by ID
        const location = locations.find((loc) => loc.id === locationId);
        locationKey = location?.name || 'Unknown Location';
      }

      const currentData = locationVisitsMap.get(locationKey) || { locationId, inPerson: 0, telemed: 0 };

      if (isTelemedicine) {
        currentData.telemed++;
      } else if (isInPerson) {
        currentData.inPerson++;
      }
      // Note: Skip appointments that don't have a clear type - they won't be counted

      locationVisitsMap.set(locationKey, currentData);
    });

    console.log(
      'Location visits summary:',
      Array.from(locationVisitsMap.entries()).map(
        ([location, data]) =>
          `${location}: ${data.inPerson} in-person, ${data.telemed} telemed, total: ${data.inPerson + data.telemed}`
      )
    );

    // Convert location visits map to sorted array
    const locationVisits: LocationVisitCount[] = Array.from(locationVisitsMap.entries())
      .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
      .map(([locationName, data]) => ({
        locationName,
        locationId: data.locationId,
        inPerson: data.inPerson,
        telemed: data.telemed,
        total: data.inPerson + data.telemed,
      }));

    // Process practitioner-based visit counts
    const practitionerVisitsMap = new Map<
      string,
      { practitionerId: string; role: 'Attending Provider' | 'Intake Performer'; inPerson: number; telemed: number }
    >();

    // Create maps for quick lookups
    const encounterMap = new Map<string, Encounter>();
    encounters.forEach((encounter) => {
      const appointmentRef = encounter.appointment?.[0]?.reference;
      if (appointmentRef && encounter.id) {
        encounterMap.set(appointmentRef, encounter);
      }
    });

    const practitionerMap = new Map<string, Practitioner>();
    practitioners.forEach((practitioner) => {
      if (practitioner.id) {
        practitionerMap.set(practitioner.id, practitioner);
      }
    });

    appointments.forEach((appointment) => {
      if (!appointment.id) return;

      // Check if appointment is telemedicine or in-person (using same logic as daily visits)
      const isTelemedicine = isTelemedAppointment(appointment);
      const isInPerson = isInPersonAppointment(appointment);

      // Skip appointments without clear type
      if (!isTelemedicine && !isInPerson) return;

      // Find the encounter for this appointment
      const encounter = encounterMap.get(`Appointment/${appointment.id}`);
      if (!encounter) return;

      // Get attending provider and intake performer
      const attendingProviderId = getAttendingPractitionerId(encounter);
      const admitterProviderId = getAdmitterPractitionerId(encounter);

      // For telemed encounters, practitioners may not have specific role types (Attender/Admitter)
      // In this case, find any practitioner participant
      let telemedPractitionerId: string | undefined;
      if (isTelemedicine && !attendingProviderId && !admitterProviderId) {
        const practitionerParticipant = encounter.participant?.find(
          (part) => part.individual?.reference?.includes('Practitioner/')
        );
        if (practitionerParticipant?.individual?.reference) {
          telemedPractitionerId = practitionerParticipant.individual.reference.replace('Practitioner/', '');
        }
      }

      // Process attending provider
      if (attendingProviderId) {
        const key = `${attendingProviderId}-Attending Provider`;
        const currentData = practitionerVisitsMap.get(key) || {
          practitionerId: attendingProviderId,
          role: 'Attending Provider' as const,
          inPerson: 0,
          telemed: 0,
        };

        if (isTelemedicine) {
          currentData.telemed++;
        } else if (isInPerson) {
          currentData.inPerson++;
        }

        practitionerVisitsMap.set(key, currentData);
      }

      // Process intake performer
      if (admitterProviderId && admitterProviderId !== attendingProviderId) {
        const key = `${admitterProviderId}-Intake Performer`;
        const currentData = practitionerVisitsMap.get(key) || {
          practitionerId: admitterProviderId,
          role: 'Intake Performer' as const,
          inPerson: 0,
          telemed: 0,
        };

        if (isTelemedicine) {
          currentData.telemed++;
        } else if (isInPerson) {
          currentData.inPerson++;
        }

        practitionerVisitsMap.set(key, currentData);
      }

      // Process telemed practitioner if no attending/admitter found
      if (telemedPractitionerId) {
        const key = `${telemedPractitionerId}-Attending Provider`;
        const currentData = practitionerVisitsMap.get(key) || {
          practitionerId: telemedPractitionerId,
          role: 'Attending Provider' as const,
          inPerson: 0,
          telemed: 0,
        };

        currentData.telemed++;
        practitionerVisitsMap.set(key, currentData);
      }
    });

    // Convert practitioner visits map to sorted array
    const practitionerVisits: PractitionerVisitCount[] = Array.from(practitionerVisitsMap.entries())
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([_key, data]) => {
        const practitioner = practitionerMap.get(data.practitionerId);
        const practitionerName = practitioner?.name?.[0]
          ? `${practitioner.name[0].given?.join(' ') || ''} ${practitioner.name[0].family || ''}`.trim()
          : 'Unknown Provider';

        return {
          practitionerId: data.practitionerId,
          practitionerName,
          role: data.role,
          inPerson: data.inPerson,
          telemed: data.telemed,
          total: data.inPerson + data.telemed,
        };
      });

    // Convert daily visits map to sorted array
    const dailyVisits: DailyVisitCount[] = Array.from(dailyVisitsMap.entries())
      .filter(([date]) => date !== 'unknown') // Filter out appointments without valid dates
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB)) // Sort by date
      .map(([date, counts]) => ({
        date,
        inPerson: counts.inPerson,
        telemed: counts.telemed,
        unknown: 0, // Always 0 since we're not tracking unknown appointments
        total: counts.inPerson + counts.telemed,
      }));

    // Calculate percentages and create response
    const appointmentTypes: AppointmentTypeCount[] = Object.entries(typeCounts).map(([type, count]) => ({
      type: type as 'In-Person' | 'Telemed',
      count,
      percentage: totalAppointments > 0 ? Math.round((count / totalAppointments) * 100) : 0,
    }));

    const response: VisitsOverviewReportZambdaOutput = {
      message: `Found ${totalAppointments} appointments: ${typeCounts['In-Person']} in-person, ${typeCounts.Telemed} telemed`,
      totalAppointments,
      appointmentTypes,
      dailyVisits,
      locationVisits,
      practitionerVisits,
      dateRange,
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
