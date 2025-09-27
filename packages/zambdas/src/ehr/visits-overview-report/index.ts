import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment, Location } from 'fhir/r4b';
import {
  AppointmentTypeCount,
  DailyVisitCount,
  LocationVisitCount,
  OTTEHR_MODULE,
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
    // Fetch all appointments and locations with proper FHIR pagination
    let allResources: (Appointment | Location)[] = [];
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
        name: '_count',
        value: pageSize.toString(),
      },
    ];

    let searchBundle = await oystehr.fhir.search<Appointment | Location>({
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

      searchBundle = await oystehr.fhir.search<Appointment | Location>({
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

      // Check if we got fewer appointments than requested, indicating last page
      const hasMoreResults = pageAppointmentsCount === pageSize;

      // Safety check to prevent infinite loops
      if (pageCount > 100) {
        console.warn('Reached maximum pagination limit (100 pages). Stopping search.');
        break;
      }

      if (!hasMoreResults) {
        break;
      }
    }

    // Separate resources by type
    const appointments = allResources.filter(
      (resource): resource is Appointment => resource.resourceType === 'Appointment'
    );
    const locations = allResources.filter((resource): resource is Location => resource.resourceType === 'Location');

    console.log(
      `Total resources found across ${pageCount} pages: ${allResources.length} (${appointments.length} appointments, ${locations.length} locations)`
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
      const isTelemedicine = appointment?.meta?.tag?.some((tag) => tag.code === OTTEHR_MODULE.TM);
      const isInPerson = appointment?.meta?.tag?.some((tag) => tag.code === OTTEHR_MODULE.IP);

      // Extract date from appointment start time in local timezone (America/New_York)
      let appointmentDate = 'unknown';
      if (appointment.start) {
        try {
          // Convert UTC appointment time to America/New_York timezone and extract date
          const appointmentDateTime = new Date(appointment.start);
          const localDate = appointmentDateTime.toLocaleDateString('en-CA', {
            timeZone: 'America/New_York',
          }); // en-CA gives YYYY-MM-DD format
          appointmentDate = localDate;
        } catch (error) {
          console.warn('Failed to parse appointment date:', appointment.start, error);
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
      const isTelemedicine = appointment?.meta?.tag?.some((tag) => tag.code === OTTEHR_MODULE.TM);
      const isInPerson = appointment?.meta?.tag?.some((tag) => tag.code === OTTEHR_MODULE.IP);

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
      dateRange,
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
