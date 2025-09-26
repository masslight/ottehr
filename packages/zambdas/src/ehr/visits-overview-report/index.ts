import { APIGatewayProxyResult } from 'aws-lambda';
import { Appointment } from 'fhir/r4b';
import { AppointmentTypeCount, OTTEHR_MODULE, VisitsOverviewReportZambdaOutput } from 'utils';
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
    const appointmentSearchResult = await oystehr.fhir.search<Appointment>({
      resourceType: 'Appointment',
      params: [
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
          value: '1000',
        },
      ],
    });

    // Get all appointments
    const appointments = appointmentSearchResult.unbundle();
    console.log(`Found ${appointments.length} appointments`);

    if (appointments.length === 0) {
      const response: VisitsOverviewReportZambdaOutput = {
        message: 'No appointments found for the specified date range',
        totalAppointments: 0,
        appointmentTypes: [
          { type: 'In-Person', count: 0, percentage: 0 },
          { type: 'Telemed', count: 0, percentage: 0 },
          { type: 'Unknown', count: 0, percentage: 0 },
        ],
        dateRange,
      };

      return {
        statusCode: 200,
        body: JSON.stringify(response),
      };
    }

    // Count appointments by type
    const typeCounts = {
      'In-Person': 0,
      Telemed: 0,
      Unknown: 0,
    };

    appointments.forEach((appointment) => {
      // Determine appointment type based on meta tags
      const isTelemedicine = appointment?.meta?.tag?.some((tag) => tag.code === OTTEHR_MODULE.TM);
      const isInPerson = appointment?.meta?.tag?.some((tag) => tag.code === OTTEHR_MODULE.IP);

      if (isTelemedicine) {
        typeCounts.Telemed++;
      } else if (isInPerson) {
        typeCounts['In-Person']++;
      } else {
        typeCounts.Unknown++;
      }
    });

    const totalAppointments = appointments.length;

    // Calculate percentages and create response
    const appointmentTypes: AppointmentTypeCount[] = Object.entries(typeCounts).map(([type, count]) => ({
      type: type as 'In-Person' | 'Telemed' | 'Unknown',
      count,
      percentage: totalAppointments > 0 ? Math.round((count / totalAppointments) * 100) : 0,
    }));

    const response: VisitsOverviewReportZambdaOutput = {
      message: `Found ${totalAppointments} appointments: ${typeCounts['In-Person']} in-person, ${typeCounts.Telemed} telemed, ${typeCounts.Unknown} unknown`,
      totalAppointments,
      appointmentTypes,
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
