import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment } from 'fhir/r4b';
import { AppointmentTypeCount, DailyVisitCount, OTTEHR_MODULE, VisitsOverviewReportZambdaOutput } from 'utils';
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
    // Fetch all appointments with proper FHIR pagination
    let allAppointments: Appointment[] = [];
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
        name: '_count',
        value: pageSize.toString(),
      },
    ];

    let searchBundle = await oystehr.fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
    });

    let pageCount = 1;
    console.log(`Fetching page ${pageCount} of appointments...`);

    // Get appointments from first page
    let pageAppointments = searchBundle.unbundle();
    allAppointments = allAppointments.concat(pageAppointments);
    console.log(`Page ${pageCount}: Found ${pageAppointments.length} appointments`);

    // Follow pagination links to get all pages
    while (searchBundle.link?.find((link) => link.relation === 'next')) {
      offset += pageSize;
      pageCount++;
      console.log(`Fetching page ${pageCount} of appointments...`);

      searchBundle = await oystehr.fhir.search<Appointment>({
        resourceType: 'Appointment',
        params: [...baseSearchParams, { name: '_offset', value: offset.toString() }],
      });

      pageAppointments = searchBundle.unbundle();
      allAppointments = allAppointments.concat(pageAppointments);

      console.log(`Page ${pageCount}: Found ${pageAppointments.length} appointments`);

      // Safety check to prevent infinite loops
      if (pageCount > 100) {
        console.warn('Reached maximum pagination limit (100 pages). Stopping search.');
        break;
      }
    }

    const appointments = allAppointments;
    console.log(`Total appointments found across ${pageCount} pages: ${appointments.length}`);

    if (appointments.length === 0) {
      const response: VisitsOverviewReportZambdaOutput = {
        message: 'No appointments found for the specified date range',
        totalAppointments: 0,
        appointmentTypes: [
          { type: 'In-Person', count: 0, percentage: 0 },
          { type: 'Telemed', count: 0, percentage: 0 },
        ],
        dailyVisits: [],
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
